"""Anthropic client wrapper with model routing & prompt caching.
Every call is automatically recorded in the LlmCall telemetry table."""
from __future__ import annotations

from dataclasses import dataclass
from typing import AsyncIterator, Iterable, Literal, Sequence

import anthropic
from anthropic.types import MessageParam

from app.config import get_settings
from app.llm.telemetry import now_ms, record_call

ModelClass = Literal["reasoning", "default", "fast"]


# Newer Claude models (4.7 family) reject `temperature` because they use a
# fixed temperature internally (extended-thinking models). Keep this list
# tight — only the models we know reject it.
_TEMPERATURE_REJECTING_PREFIXES = (
    "claude-opus-4-7",
    "claude-sonnet-4-7",
)


def _model_rejects_temperature(model: str) -> bool:
    return any(model.startswith(p) for p in _TEMPERATURE_REJECTING_PREFIXES)


@dataclass
class CompletionResult:
    content: str
    model: str
    input_tokens: int
    output_tokens: int
    stop_reason: str | None
    raw: dict


class ClaudeRouter:
    """Selects Claude model by task class and provides cached system prompts."""

    def __init__(self) -> None:
        s = get_settings()
        # Bump retries to 5 (default is 2). Anthropic's SDK already retries 408,
        # 409, 429, and 5xx with exponential backoff — bumping the count gives
        # transient 529 Overloaded errors more chances to clear.
        self._client = anthropic.AsyncAnthropic(
            api_key=s.anthropic_api_key,
            max_retries=5,
            timeout=300,  # 5 min — long-context Opus calls can take a while
        )
        self._models = {
            "reasoning": s.anthropic_reasoning_model,
            "default": s.anthropic_default_model,
            "fast": s.anthropic_fast_model,
        }
        self._enable_cache = s.enable_prompt_caching

    def model_for(self, klass: ModelClass) -> str:
        return self._models[klass]

    def select(
        self,
        *,
        complexity: float,
        latency_budget_ms: int,
        context_tokens: int,
    ) -> ModelClass:
        """Heuristic model router."""
        if complexity >= 0.75 or context_tokens > 60_000:
            return "reasoning"
        if latency_budget_ms <= 1500 and complexity < 0.3:
            return "fast"
        return "default"

    def _system_blocks(
        self,
        system: str | Sequence[str],
        cached_prefix: str | None = None,
    ) -> list[dict]:
        """Build the `system` content blocks.

        If `cached_prefix` is provided, it is prepended as a single ephemeral-
        cached block. This is the cross-call sharing mechanism: identical
        prefix text → same cache key → cache hit across agents in the same
        Analyze run. The per-agent system text that follows is intentionally
        NOT cached (it varies by agent, no reuse value).
        """
        blocks: list[dict] = []
        if cached_prefix:
            blocks.append(
                {
                    "type": "text",
                    "text": cached_prefix,
                    "cache_control": {"type": "ephemeral"},
                }
            )
        prompts = [system] if isinstance(system, str) else list(system)
        for p in prompts:
            block = {"type": "text", "text": p}
            # Only auto-cache when no shared prefix was provided. Per-agent
            # system text varies across agents and isn't worth caching.
            if cached_prefix is None and self._enable_cache and len(p) > 1024:
                block["cache_control"] = {"type": "ephemeral"}
            blocks.append(block)
        return blocks

    async def complete(
        self,
        *,
        klass: ModelClass = "default",
        system: str | Sequence[str],
        messages: list[MessageParam],
        max_tokens: int = 4096,
        temperature: float = 0.2,
        tools: Iterable[dict] | None = None,
        agent: str | None = None,
        cached_prefix: str | None = None,
    ) -> CompletionResult:
        model = self.model_for(klass)
        kwargs: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "system": self._system_blocks(system, cached_prefix=cached_prefix),
            "messages": messages,
        }
        # `temperature` is deprecated on newer Claude models (Opus 4.7, etc.).
        # Only pass it for models that still accept it.
        if not _model_rejects_temperature(model):
            kwargs["temperature"] = temperature
        if tools:
            kwargs["tools"] = list(tools)

        t0 = now_ms()
        try:
            resp = await self._client.messages.create(**kwargs)
        except Exception as e:
            await record_call(
                model=model,
                input_tokens=0,
                output_tokens=0,
                latency_ms=now_ms() - t0,
                status="error",
                error_message=str(e),
                agent=agent,
            )
            raise

        latency = now_ms() - t0
        usage = resp.usage
        text = "".join(
            getattr(b, "text", "") for b in resp.content if getattr(b, "type", "") == "text"
        )
        await record_call(
            model=model,
            input_tokens=getattr(usage, "input_tokens", 0) or 0,
            output_tokens=getattr(usage, "output_tokens", 0) or 0,
            cache_read_tokens=getattr(usage, "cache_read_input_tokens", 0) or 0,
            cache_write_tokens=getattr(usage, "cache_creation_input_tokens", 0) or 0,
            latency_ms=latency,
            status="ok",
            extra_metadata={"max_tokens": max_tokens, "temperature": temperature, "klass": klass},
            agent=agent,
        )
        return CompletionResult(
            content=text,
            model=model,
            input_tokens=getattr(usage, "input_tokens", 0) or 0,
            output_tokens=getattr(usage, "output_tokens", 0) or 0,
            stop_reason=resp.stop_reason,
            raw=resp.model_dump(),
        )

    async def stream(
        self,
        *,
        klass: ModelClass = "default",
        system: str | Sequence[str],
        messages: list[MessageParam],
        max_tokens: int = 4096,
        temperature: float = 0.2,
        agent: str | None = None,
    ) -> AsyncIterator[str]:
        model = self.model_for(klass)
        t0 = now_ms()
        stream_kwargs: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "system": self._system_blocks(system),
            "messages": messages,
        }
        if not _model_rejects_temperature(model):
            stream_kwargs["temperature"] = temperature
        try:
            async with self._client.messages.stream(**stream_kwargs) as stream:
                async for text in stream.text_stream:
                    yield text
                final = await stream.get_final_message()
        except Exception as e:
            await record_call(
                model=model,
                input_tokens=0,
                output_tokens=0,
                latency_ms=now_ms() - t0,
                status="error",
                error_message=str(e),
                agent=agent,
            )
            raise

        latency = now_ms() - t0
        usage = getattr(final, "usage", None)
        await record_call(
            model=model,
            input_tokens=getattr(usage, "input_tokens", 0) or 0 if usage else 0,
            output_tokens=getattr(usage, "output_tokens", 0) or 0 if usage else 0,
            cache_read_tokens=getattr(usage, "cache_read_input_tokens", 0) or 0 if usage else 0,
            cache_write_tokens=getattr(usage, "cache_creation_input_tokens", 0) or 0 if usage else 0,
            latency_ms=latency,
            status="ok",
            extra_metadata={"streaming": True, "max_tokens": max_tokens, "klass": klass},
            agent=agent,
        )


router = ClaudeRouter()
