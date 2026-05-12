"""Lightweight entity extraction using Anthropic Haiku."""
from __future__ import annotations

import json

import anthropic

from app.config import get_settings
from app.utils.telemetry import now_ms, record as record_call


_PROMPT = """\
Extract real estate entities from the text. Return JSON only:
{
  "properties": [{"name": "...", "address": "...", "type": "..."}],
  "tenants": ["..."],
  "sponsors": ["..."],
  "markets": ["..."],
  "loans": [{"lender": "...", "amount": "...", "terms": "..."}],
  "legal_entities": ["..."]
}
If a list is empty, omit it. Use only what is in the text.
"""


async def extract_entities(text: str) -> dict:
    """Best-effort entity extraction. Returns {} on any failure (no key,
    rate limit, credit balance, parse error). Never raises — entity
    extraction is non-essential for the rest of the ingest pipeline."""
    s = get_settings()
    if not s.anthropic_api_key or not text.strip():
        return {}
    t0 = now_ms()
    try:
        client = anthropic.AsyncAnthropic(api_key=s.anthropic_api_key)
        resp = await client.messages.create(
            model=s.anthropic_fast_model,
            max_tokens=1500,
            temperature=0.0,
            system=_PROMPT,
            messages=[{"role": "user", "content": text[:20_000]}],
        )
        await record_call(
            endpoint="extract_entities",
            model=s.anthropic_fast_model,
            input_tokens=getattr(resp.usage, "input_tokens", 0) or 0,
            output_tokens=getattr(resp.usage, "output_tokens", 0) or 0,
            latency_ms=now_ms() - t0,
        )
        raw = "".join(getattr(b, "text", "") for b in resp.content)
        return json.loads(raw)
    except Exception as e:
        await record_call(
            endpoint="extract_entities",
            model=s.anthropic_fast_model,
            input_tokens=0,
            output_tokens=0,
            latency_ms=now_ms() - t0,
            status="error",
            error_message=str(e),
        )
        return {}
