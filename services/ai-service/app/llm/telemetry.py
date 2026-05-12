"""Telemetry recorder — writes one LlmCall row per Anthropic call."""
from __future__ import annotations

import json
import time
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings
from app.llm.pricing import cost_for


# Per-request scope set by FastAPI handlers before invoking the router.
@dataclass
class CallScope:
    endpoint: str = "other"
    opportunity_id: str | None = None
    thread_id: str | None = None
    agent: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


_scope: ContextVar[CallScope] = ContextVar("llm_call_scope", default=CallScope())


def set_scope(
    *,
    endpoint: str,
    opportunity_id: str | None = None,
    thread_id: str | None = None,
    agent: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    _scope.set(
        CallScope(
            endpoint=endpoint,
            opportunity_id=opportunity_id,
            thread_id=thread_id,
            agent=agent,
            metadata=metadata or {},
        )
    )


def current_scope() -> CallScope:
    return _scope.get()


_engine_singleton = None


def _engine():
    global _engine_singleton
    if _engine_singleton is None:
        url = get_settings().database_url.replace("postgresql://", "postgresql+psycopg://")
        _engine_singleton = create_async_engine(url, pool_pre_ping=True, pool_size=4)
    return _engine_singleton


async def record_call(
    *,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_read_tokens: int = 0,
    cache_write_tokens: int = 0,
    latency_ms: int,
    status: str = "ok",
    error_message: str | None = None,
    extra_metadata: dict[str, Any] | None = None,
    agent: str | None = None,
) -> None:
    """Best-effort: never raises. Writes one row to LlmCall.
    `agent` overrides scope.agent — useful for parallel fan-out where each
    task tags its own agent name without mutating the shared scope.
    """
    try:
        scope = current_scope()
        cost = cost_for(
            model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_read_tokens=cache_read_tokens,
            cache_write_tokens=cache_write_tokens,
        )
        meta = dict(scope.metadata)
        if extra_metadata:
            meta.update(extra_metadata)
        async with _engine().begin() as conn:
            await conn.execute(
                text(
                    """
                    INSERT INTO "LlmCall" (id, "createdAt", endpoint, agent, model,
                        "opportunityId", "threadId", "inputTokens", "outputTokens",
                        "cacheReadTokens", "cacheWriteTokens", "latencyMs", "costUsd",
                        status, "errorMessage", metadata)
                    VALUES (gen_random_uuid()::text, NOW(), :endpoint, :agent, :model,
                        :oid, :tid, :it, :ot, :crt, :cwt, :lat, :cost,
                        :status, :err, CAST(:meta AS jsonb))
                    """
                ),
                {
                    "endpoint": scope.endpoint,
                    "agent": agent or scope.agent,
                    "model": model,
                    "oid": scope.opportunity_id,
                    "tid": scope.thread_id,
                    "it": input_tokens,
                    "ot": output_tokens,
                    "crt": cache_read_tokens,
                    "cwt": cache_write_tokens,
                    "lat": latency_ms,
                    "cost": cost,
                    "status": status,
                    "err": error_message[:1000] if error_message else None,
                    "meta": json.dumps(meta) if meta else None,
                },
            )
    except Exception:
        # Telemetry must never break the actual workflow.
        pass


def now_ms() -> int:
    return int(time.monotonic() * 1000)
