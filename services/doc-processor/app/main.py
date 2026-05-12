"""Stone Gate doc-processor — ingest → extract → chunk → embed → index."""
from __future__ import annotations

import json
import uuid
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.chunking import chunk_text
from app.classifier import classify
from app.config import get_settings
from app.embeddings import get_provider
from app.extractors.entities import extract_entities
from app.extractors.financial import heuristic_extract
from app.processors.email import extract_email
from app.processors.excel import extract_csv, extract_xlsx
from app.processors.image import extract_image
from app.processors.pdf import extract_pdf
from app.processors.pptx import extract_pptx
from app.processors.word import extract_docx
from app.processors.zip import iter_zip
from app.utils.crypto import decrypt_blob

app = FastAPI(title="Stone Gate Doc Processor", version="0.1.0")


def _engine():
    url = get_settings().database_url.replace("postgresql://", "postgresql+psycopg://")
    return create_async_engine(url, pool_pre_ping=True)


class IngestBody(BaseModel):
    documentId: str
    opportunityId: str
    storagePath: str
    mimeType: str
    filename: str


class ClassifyBody(BaseModel):
    documentId: str
    storagePath: str
    mimeType: str
    filename: str | None = None
    persist: bool = True


@app.get("/healthz")
async def health():
    return {"ok": True}


def _resolve_blob_path(storage_path: str) -> Path:
    """The API stores a relative key (`{oid}/{sha}.bin`). We resolve it
    against this service's BLOB_STORAGE_DIR. Absolute paths from legacy
    rows are still honoured."""
    p = Path(storage_path)
    if p.is_absolute():
        return p
    return Path(get_settings().blob_storage_dir) / storage_path


def _read_blob(path: str) -> bytes:
    raw = _resolve_blob_path(path).read_bytes()
    return decrypt_blob(raw)


def _extract(buf: bytes, mime: str, filename: str) -> tuple[list[tuple[int | None, str]], int, bool]:
    """Return list of (page, text), page_count, ocr_used."""
    fname_l = filename.lower()
    if mime == "application/pdf" or fname_l.endswith(".pdf"):
        pages, count = extract_pdf(buf)
        ocr = any(p.ocr_used for p in pages)
        return [(p.page, p.text) for p in pages], count, ocr
    if fname_l.endswith((".xlsx", ".xlsm")):
        sheets = extract_xlsx(buf)
        return [(None, s.text) for s in sheets], len(sheets), False
    if fname_l.endswith(".csv"):
        s = extract_csv(buf)
        return [(None, s.text)], 1, False
    if fname_l.endswith(".docx"):
        return [(None, extract_docx(buf))], 1, False
    if fname_l.endswith(".pptx"):
        slides, count = extract_pptx(buf)
        return [(s.page, s.text) for s in slides], count, False
    if mime.startswith("image/") or fname_l.endswith((".png", ".jpg", ".jpeg", ".tiff", ".webp")):
        return [(None, extract_image(buf))], 1, True
    if fname_l.endswith(".eml") or mime == "message/rfc822":
        return [(None, extract_email(buf))], 1, False
    # Treat anything else as utf-8 best effort
    try:
        return [(None, buf.decode("utf-8", errors="ignore"))], 1, False
    except Exception:
        return [(None, "")], 1, False


async def _ingest_pipeline(body: IngestBody):
    eng = _engine()
    try:
        await _set_status(eng, body.documentId, "PROCESSING", None)

        # Make the pipeline idempotent — wipe any chunks left over from a
        # prior partial run so retries don't trip the (documentId, ordinal)
        # unique constraint.
        async with eng.begin() as conn:
            await conn.execute(
                text('DELETE FROM "DocumentChunk" WHERE "documentId" = :id'),
                {"id": body.documentId},
            )

        buf = _read_blob(body.storagePath)

        # Recurse zips one level deep
        if body.mimeType in ("application/zip", "application/x-zip-compressed") or body.filename.lower().endswith(".zip"):
            for inner_name, inner_buf in iter_zip(buf):
                # Each inner file becomes its own Document. Skipping for brevity in this scaffold.
                pass

        pages, page_count, ocr_used = _extract(buf, body.mimeType, body.filename)
        full_text = "\n\n".join(t for _, t in pages if t).strip()

        cls, conf, tags = await classify(body.filename, body.mimeType, full_text[:8000])
        entities = await extract_entities(full_text[:30_000]) if full_text else {}
        metrics = heuristic_extract(full_text)

        provider = get_provider()
        chunks_all = []
        for page_no, text_ in pages:
            for ch in chunk_text(text_, page=page_no):
                chunks_all.append(ch)

        if chunks_all:
            embeddings = await provider.embed([c.content for c in chunks_all])
        else:
            embeddings = []

        async with eng.begin() as conn:
            await conn.execute(
                text(
                    """
                    UPDATE "Document" SET "documentClass"=:cls, "classConfidence"=:cf,
                        "pageCount"=:pc, "ocrApplied"=:ocr, "smartTags"=:tags,
                        metadata=:md, status='COMPLETE', "updatedAt"=NOW()
                    WHERE id=:id
                    """
                ),
                {
                    "cls": cls,
                    "cf": conf,
                    "pc": page_count,
                    "ocr": ocr_used,
                    "tags": tags,
                    "md": json.dumps({"entities": entities}),
                    "id": body.documentId,
                },
            )

            for ch, emb in zip(chunks_all, embeddings):
                emb_lit = "[" + ",".join(f"{x:.6f}" for x in emb) + "]"
                # UPSERT — retries / concurrent runs converge to the same row
                # without violating the (documentId, ordinal) unique constraint.
                await conn.execute(
                    text(
                        """
                        INSERT INTO "DocumentChunk" (id, "documentId", ordinal, page, content,
                            "contentTokens", embedding, metadata, "createdAt")
                        VALUES (gen_random_uuid()::text, :did, :o, :p, :c, :ct,
                            CAST(:emb AS vector), :md, NOW())
                        ON CONFLICT ("documentId", ordinal) DO UPDATE SET
                            page = EXCLUDED.page,
                            content = EXCLUDED.content,
                            "contentTokens" = EXCLUDED."contentTokens",
                            embedding = EXCLUDED.embedding,
                            metadata = EXCLUDED.metadata
                        """
                    ),
                    {
                        "did": body.documentId,
                        "o": ch.ordinal,
                        "p": ch.page,
                        "c": ch.content,
                        "ct": ch.tokens,
                        "emb": emb_lit,
                        "md": json.dumps(ch.metadata),
                    },
                )

            for m in metrics:
                await conn.execute(
                    text(
                        """
                        INSERT INTO "ExtractedMetric" (id, "opportunityId", name, value, unit,
                            confidence, source, "createdAt")
                        VALUES (gen_random_uuid()::text, :oid, :n, :v, :u, :cf, :src, NOW())
                        """
                    ),
                    {
                        "oid": body.opportunityId,
                        "n": m.name,
                        "v": m.value,
                        "u": m.unit,
                        "cf": 0.6,
                        "src": m.snippet[:1000],
                    },
                )

    except Exception as e:
        await _set_status(_engine(), body.documentId, "FAILED", str(e)[:1000])


async def _set_status(eng, doc_id: str, status: str, reason: str | None) -> None:
    async with eng.begin() as conn:
        await conn.execute(
            text(
                """UPDATE "Document" SET status=:s, "failureReason"=:r, "updatedAt"=NOW() WHERE id=:id"""
            ),
            {"s": status, "r": reason, "id": doc_id},
        )


@app.post("/ingest")
async def ingest(body: IngestBody, bg: BackgroundTasks):
    bg.add_task(_ingest_pipeline, body)
    return {"jobId": str(uuid.uuid4()), "documentId": body.documentId}


@app.post("/classify")
async def classify_only(body: ClassifyBody):
    """Classify a document. If `persist` is true (default), updates the
    Document row's documentClass / classConfidence / smartTags.
    Uses existing DocumentChunk text when available — avoids re-reading
    the blob on subsequent classifications."""
    eng = _engine()

    # Try to use already-extracted chunks first (much cheaper than re-extracting).
    sample = ""
    filename = body.filename or ""
    async with eng.connect() as conn:
        row = (
            await conn.execute(
                text(
                    """SELECT filename FROM "Document" WHERE id = :id"""
                ),
                {"id": body.documentId},
            )
        ).first()
        if row:
            filename = filename or row.filename
        chunk_rows = (
            await conn.execute(
                text(
                    """SELECT content FROM "DocumentChunk"
                       WHERE "documentId" = :id ORDER BY ordinal LIMIT 6"""
                ),
                {"id": body.documentId},
            )
        ).all()
        if chunk_rows:
            sample = "\n".join(r.content for r in chunk_rows)[:6000]

    if not sample:
        try:
            buf = _read_blob(body.storagePath)
            if body.mimeType == "application/pdf" or filename.lower().endswith(".pdf"):
                pages, _ = extract_pdf(buf)
                sample = "\n".join(p.text for p in pages[:2])[:6000]
            elif filename.lower().endswith((".xlsx", ".xlsm")):
                from app.processors.excel import extract_xlsx

                sheets = extract_xlsx(buf)
                sample = "\n".join(s.text for s in sheets)[:6000]
            elif filename.lower().endswith(".pptx"):
                slides, _ = extract_pptx(buf)
                sample = "\n".join(s.text for s in slides[:5])[:6000]
            elif filename.lower().endswith(".docx"):
                sample = extract_docx(buf)[:6000]
            else:
                sample = buf.decode("utf-8", errors="ignore")[:6000]
        except Exception:
            sample = ""

    cls, conf, tags = await classify(filename or body.documentId, body.mimeType, sample)

    if body.persist:
        async with eng.begin() as conn:
            await conn.execute(
                text(
                    """UPDATE "Document" SET "documentClass" = :cls,
                              "classConfidence" = :cf,
                              "smartTags" = :tags,
                              "updatedAt" = NOW()
                       WHERE id = :id"""
                ),
                {"cls": cls, "cf": conf, "tags": tags, "id": body.documentId},
            )

    return {"documentClass": cls, "confidence": conf, "smartTags": tags}
