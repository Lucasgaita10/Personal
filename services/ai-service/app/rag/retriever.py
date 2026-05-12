"""Hybrid retriever: pgvector dense + BM25 sparse, then RRF fusion."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np
from rank_bm25 import BM25Okapi
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncEngine

from app.config import get_settings
from app.rag.embeddings import get_provider


def _engine() -> AsyncEngine:
    url = get_settings().database_url.replace("postgresql://", "postgresql+psycopg://")
    return create_async_engine(url, pool_pre_ping=True)


@dataclass
class RetrievedChunk:
    chunk_id: str
    document_id: str
    page: int | None
    content: str
    score: float
    metadata: dict | None


class HybridRetriever:
    def __init__(self) -> None:
        self.engine = _engine()
        self.embedder = get_provider()

    async def retrieve(
        self,
        opportunity_id: str,
        query: str,
        top_k: int = 8,
    ) -> list[RetrievedChunk]:
        emb = (await self.embedder.embed([query]))[0]
        emb_literal = "[" + ",".join(f"{x:.6f}" for x in emb) + "]"

        async with self.engine.connect() as conn:
            # Dense via pgvector cosine distance
            dense_rows = (
                await conn.execute(
                    text(
                        """
                        SELECT c.id AS chunk_id, c."documentId" AS document_id,
                               c.page, c.content, c.metadata,
                               (c.embedding <=> CAST(:q AS vector)) AS dist
                        FROM "DocumentChunk" c
                        JOIN "Document" d ON d.id = c."documentId"
                        WHERE d."opportunityId" = :oid
                          AND c.embedding IS NOT NULL
                        ORDER BY c.embedding <=> CAST(:q AS vector)
                        LIMIT :k
                        """
                    ),
                    {"q": emb_literal, "oid": opportunity_id, "k": top_k * 4},
                )
            ).all()

            # Sparse via BM25 over a candidate pool
            sparse_pool = (
                await conn.execute(
                    text(
                        """
                        SELECT c.id AS chunk_id, c."documentId" AS document_id,
                               c.page, c.content, c.metadata
                        FROM "DocumentChunk" c
                        JOIN "Document" d ON d.id = c."documentId"
                        WHERE d."opportunityId" = :oid
                        ORDER BY c."createdAt" DESC
                        LIMIT 4000
                        """
                    ),
                    {"oid": opportunity_id},
                )
            ).all()

        # Build BM25 over the candidate pool
        if sparse_pool:
            corpus = [(r.content or "").lower().split() for r in sparse_pool]
            bm25 = BM25Okapi(corpus)
            scores = bm25.get_scores(query.lower().split())
            sparse_ranked = sorted(
                zip(sparse_pool, scores), key=lambda x: x[1], reverse=True
            )[: top_k * 4]
        else:
            sparse_ranked = []

        # Reciprocal Rank Fusion
        rrf: dict[str, dict] = {}
        K = 60.0
        for rank, row in enumerate(dense_rows):
            cid = row.chunk_id
            rrf.setdefault(cid, {"row": row, "score": 0.0})
            rrf[cid]["score"] += 1 / (K + rank)
        for rank, (row, _) in enumerate(sparse_ranked):
            cid = row.chunk_id
            rrf.setdefault(cid, {"row": row, "score": 0.0})
            rrf[cid]["score"] += 1 / (K + rank)

        ordered = sorted(rrf.values(), key=lambda x: x["score"], reverse=True)[:top_k]
        return [
            RetrievedChunk(
                chunk_id=v["row"].chunk_id,
                document_id=v["row"].document_id,
                page=getattr(v["row"], "page", None),
                content=v["row"].content,
                score=float(v["score"]),
                metadata=getattr(v["row"], "metadata", None),
            )
            for v in ordered
        ]


retriever = HybridRetriever()
