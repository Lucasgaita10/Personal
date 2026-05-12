"""Lightweight LlmCall recorder for the doc-processor.
Mirrors the contract used by the ai-service."""
from __future__ import annotations

import json
import time
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings


PRICING: dict[str, dict[str, float]] = {
    "claude-opus-4-7": {"input": 15.0, "output": 75.0},
    "claude-sonnet-4-6": {"input": 3.0, "output": 15.0},
    "claude-haiku-4-5-20251001": {"input": 1.0, "output": 5.0},
    "claude-haiku-4-5": {"input": 1.0, "output": 5.0},
}


def cost_for(model: str, input_tokens: int, output_tokens: int) -> float:
    p = PRICING.get(model)
    if not p:
        for k, v in PRICING.items():
            if model.startswith(k):
                p = v
                break
    if not p:
        return 0.0
    return round(
        input_tokens * p["input"] / 1_000_000
        + output_tokens * p["output"] / 1_000_000,
        6,
    )


_engine_singleton = None


def _engine():
    global _engine_singleton
    if _engine_singleton is None:
        url = get_settings().database_url.replace("postgresql://", "postgresql+psycopg://")
        _engine_singleton = create_async_engine(url, pool_pre_ping=True, pool_size=2)
    return _engine_singleton


def now_ms() -> int:
    return int(time.monotonic() * 1000)


async def record(
    *,
    endpoint: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: int,
    document_id: str | None = None,
    opportunity_id: str | None = None,
    status: str = "ok",
    error_message: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Best-effort: never raises."""
    try:
        meta = dict(metadata or {})
        if document_id:
            meta["documentId"] = document_id
        async with _engine().begin() as conn:
            await conn.execute(
                text(
                    """
                    INSERT INTO "LlmCall" (id, "createdAt", endpoint, model,
                        "opportunityId", "inputTokens", "outputTokens",
                        "latencyMs", "costUsd", status, "errorMessage", metadata)
                    VALUES (gen_random_uuid()::text, NOW(), :endpoint, :model,
                        :oid, :it, :ot, :lat, :cost, :status, :err,
                        CAST(:meta AS jsonb))
                    """
                ),
                {
                    "endpoint": endpoint,
                    "model": model,
                    "oid": opportunity_id,
                    "it": input_tokens,
                    "ot": output_tokens,
                    "lat": latency_ms,
                    "cost": cost_for(model, input_tokens, output_tokens),
                    "status": status,
                    "err": error_message[:1000] if error_message else None,
                    "meta": json.dumps(meta) if meta else None,
                },
            )
    except Exception:
        pass
