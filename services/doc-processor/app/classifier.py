"""Document classifier — heuristic first, LLM fallback."""
from __future__ import annotations

import json
import re

import anthropic

from app.config import get_settings
from app.utils.telemetry import now_ms, record as record_call


CLASSES = [
    "INVESTMENT_MEMO",
    "PITCH_DECK",
    "FINANCIAL_STATEMENT",
    "RENT_ROLL",
    "LEGAL_AGREEMENT",
    "DUE_DILIGENCE_REPORT",
    "MARKET_STUDY",
    "APPRAISAL",
    "CONSTRUCTION_BUDGET",
    "LOAN_AGREEMENT",
    "PHOTO",
    "EMAIL",
    "OTHER",
]

HEURISTICS = [
    ("RENT_ROLL", re.compile(r"rent\s*roll|tenant\s*ledger|unit\s*mix\s*&?\s*rent", re.I)),
    ("LOAN_AGREEMENT", re.compile(r"loan\s*agreement|credit\s*agreement|deed\s*of\s*trust", re.I)),
    ("LEGAL_AGREEMENT", re.compile(r"shareholders\s*agreement|joint\s*venture\s*agreement|lease\s*agreement", re.I)),
    ("APPRAISAL", re.compile(r"appraisal\s*report|RICS\s*valuation|market\s*value\s*estimate", re.I)),
    ("CONSTRUCTION_BUDGET", re.compile(r"construction\s*budget|GC\s*contract|hard\s*cost", re.I)),
    ("MARKET_STUDY", re.compile(r"market\s*stud(?:y|ies)|submarket\s*report|absorption\s*forecast", re.I)),
    ("INVESTMENT_MEMO", re.compile(r"investment\s*memorandum|IC\s*memo|deal\s*memo", re.I)),
    ("PITCH_DECK", re.compile(r"investor\s*deck|pitch\s*deck|teaser", re.I)),
]


async def classify(filename: str, mime: str, sample_text: str) -> tuple[str, float, list[str]]:
    if mime.startswith("image/"):
        return "PHOTO", 0.95, []
    if mime in ("message/rfc822", "application/vnd.ms-outlook"):
        return "EMAIL", 0.95, []

    for cls, pat in HEURISTICS:
        if pat.search(filename) or pat.search(sample_text or ""):
            return cls, 0.85, [cls.lower()]

    s = get_settings()
    if not s.anthropic_api_key or not sample_text:
        return "OTHER", 0.3, []

    prompt = (
        "Classify this real estate investment document. "
        f"Allowed classes: {', '.join(CLASSES)}.\n"
        "Return JSON: {\"class\": \"...\", \"confidence\": 0..1, \"tags\": [\"...\"]}\n\n"
        f"Filename: {filename}\nSample:\n{sample_text[:6000]}"
    )
    t0 = now_ms()
    try:
        client = anthropic.AsyncAnthropic(api_key=s.anthropic_api_key)
        resp = await client.messages.create(
            model=s.anthropic_fast_model,
            max_tokens=400,
            temperature=0.0,
            messages=[{"role": "user", "content": prompt}],
        )
        await record_call(
            endpoint="classify",
            model=s.anthropic_fast_model,
            input_tokens=getattr(resp.usage, "input_tokens", 0) or 0,
            output_tokens=getattr(resp.usage, "output_tokens", 0) or 0,
            latency_ms=now_ms() - t0,
            metadata={"filename": filename, "mime": mime},
        )
        raw = "".join(getattr(b, "text", "") for b in resp.content)
        out = json.loads(raw)
        cls = out.get("class") if out.get("class") in CLASSES else "OTHER"
        return cls, float(out.get("confidence", 0.5)), list(out.get("tags") or [])
    except Exception as e:
        await record_call(
            endpoint="classify",
            model=s.anthropic_fast_model,
            input_tokens=0,
            output_tokens=0,
            latency_ms=now_ms() - t0,
            status="error",
            error_message=str(e),
            metadata={"filename": filename, "mime": mime},
        )
        return "OTHER", 0.3, []
