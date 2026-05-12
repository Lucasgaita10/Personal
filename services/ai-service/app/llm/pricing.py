"""Anthropic price book — USD per 1M tokens.
Update as Anthropic publishes new pricing.
"""
from __future__ import annotations

# Per-million token prices in USD
PRICING: dict[str, dict[str, float]] = {
    # Opus
    "claude-opus-4-7": {"input": 15.0, "output": 75.0},
    "claude-opus-4-6": {"input": 15.0, "output": 75.0},
    "claude-opus-4-5": {"input": 15.0, "output": 75.0},
    # Sonnet
    "claude-sonnet-4-7": {"input": 3.0, "output": 15.0},
    "claude-sonnet-4-6": {"input": 3.0, "output": 15.0},
    "claude-sonnet-4-5": {"input": 3.0, "output": 15.0},
    # Haiku
    "claude-haiku-4-5-20251001": {"input": 1.0, "output": 5.0},
    "claude-haiku-4-5": {"input": 1.0, "output": 5.0},
}

# Cache pricing (Anthropic prompt caching multipliers)
CACHE_WRITE_MULTIPLIER = 1.25  # cache writes cost 1.25× input
CACHE_READ_MULTIPLIER = 0.10   # cache reads cost 0.10× input


def cost_for(
    model: str,
    *,
    input_tokens: int,
    output_tokens: int,
    cache_read_tokens: int = 0,
    cache_write_tokens: int = 0,
) -> float:
    """Compute USD cost for a single Claude call. Returns 0.0 if model unknown."""
    p = PRICING.get(model)
    if not p:
        # Try to match on prefix (e.g. claude-opus-4-7-20251015 → claude-opus-4-7)
        for key, val in PRICING.items():
            if model.startswith(key):
                p = val
                break
    if not p:
        return 0.0
    inp = p["input"] / 1_000_000
    out = p["output"] / 1_000_000
    cost = (
        input_tokens * inp
        + output_tokens * out
        + cache_read_tokens * inp * CACHE_READ_MULTIPLIER
        + cache_write_tokens * inp * CACHE_WRITE_MULTIPLIER
    )
    return round(cost, 6)
