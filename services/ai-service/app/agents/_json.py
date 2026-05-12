"""Robust JSON extractor for Claude responses.

Models frequently wrap structured output in markdown code fences, prepend
a single line of prose, embed unescaped control characters in strings,
or use smart quotes. This parser layers several increasingly tolerant
strategies and only returns None if all of them fail.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

log = logging.getLogger("stonegate.agents.json")


def _strip_fences(text: str) -> str:
    """Remove a single wrapping ```json … ``` (or just ``` … ```) block."""
    stripped = text.strip()
    m = re.search(r"^```(?:json|JSON)?\s*\n(.*?)\n```\s*$", stripped, re.DOTALL)
    if m:
        return m.group(1).strip()
    return stripped


def _normalize_quotes(text: str) -> str:
    """Replace smart quotes with straight quotes inside the candidate JSON."""
    return (
        text.replace("“", '"')
        .replace("”", '"')
        .replace("‘", "'")
        .replace("’", "'")
    )


def _strip_control_chars(text: str) -> str:
    """Remove unescaped control chars (except whitespace) that break json.loads."""
    return re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)


def _raw_decode_longest_prefix(text: str) -> Any | None:
    """Use json.JSONDecoder(strict=False).raw_decode() to grab the longest
    valid JSON prefix starting at the first `{` or `[`. Tolerates trailing
    garbage AND raw control chars inside strings."""
    s = text.lstrip()
    i = 0
    while i < len(s) and s[i] not in "{[":
        i += 1
    if i >= len(s):
        return None
    try:
        obj, _ = json.JSONDecoder(strict=False).raw_decode(s[i:])
        return obj
    except (json.JSONDecodeError, ValueError):
        return None


def _balanced_prefix(text: str) -> str | None:
    """Walk the text tracking JSON nesting + string state. Return the
    substring spanning the first opener to the last position where depth
    returns to 0. Handles mid-content errors AFTER a complete top-level
    structure has closed (e.g. the model continued with extra prose) and
    is best-effort otherwise."""
    s = text.lstrip()
    start = -1
    for i, c in enumerate(s):
        if c in "{[":
            start = i
            break
    if start < 0:
        return None
    depth = 0
    in_string = False
    escape = False
    last_close = -1
    for j in range(start, len(s)):
        c = s[j]
        if escape:
            escape = False
            continue
        if in_string:
            if c == "\\":
                escape = True
            elif c == '"':
                in_string = False
            continue
        if c == '"':
            in_string = True
        elif c in "{[":
            depth += 1
        elif c in "}]":
            depth -= 1
            if depth == 0:
                last_close = j
                break  # full top-level structure closed
            if depth < 0:
                break
    if last_close <= start:
        return None
    return s[start : last_close + 1]


def parse_json_response(content: str, *, agent: str = "?") -> Any | None:
    """Try increasingly forgiving strategies. Returns None if nothing parses."""
    if not content:
        log.warning("agent=%s parse: empty content", agent)
        return None

    stripped = content.strip()
    starts_json = stripped.startswith("{") or stripped.startswith("[")
    ends_json = stripped.endswith("}") or stripped.endswith("]")
    if starts_json and not ends_json:
        log.warning(
            "agent=%s output appears TRUNCATED (starts with %s but ends with %r). "
            "Increase max_tokens.",
            agent,
            stripped[0],
            stripped[-1] if stripped else "?",
        )

    last_err: str | None = None

    # 1. Straight parse on the original content. strict=False tolerates raw
    #    control chars (literal \n, \t, etc.) inside JSON strings — Claude
    #    frequently emits multi-line prose without escaping the newlines.
    try:
        return json.loads(content, strict=False)
    except json.JSONDecodeError as e:
        last_err = str(e)

    # 2. Strip markdown fences and try again.
    defenced = _strip_fences(content)
    try:
        return json.loads(defenced, strict=False)
    except json.JSONDecodeError as e:
        last_err = str(e)

    # 3. Normalize smart quotes + strip non-whitespace control chars.
    cleaned = _strip_control_chars(_normalize_quotes(defenced))
    try:
        return json.loads(cleaned, strict=False)
    except json.JSONDecodeError as e:
        last_err = str(e)

    # 4. raw_decode — tolerates trailing prose / unbalanced tail.
    obj = _raw_decode_longest_prefix(cleaned)
    if obj is not None:
        log.info("agent=%s parsed via raw_decode prefix fallback", agent)
        return obj

    # 5. Brace-balance recovery — last resort for genuinely malformed output.
    #    Slice the text to the longest depth-balanced span, then retry.
    balanced = _balanced_prefix(cleaned)
    if balanced is not None:
        try:
            obj = json.loads(balanced, strict=False)
            log.info("agent=%s parsed via brace-balance recovery", agent)
            return obj
        except json.JSONDecodeError as e:
            last_err = str(e)

    # All strategies failed — log head, tail, and the last JSONDecodeError.
    n = len(content)
    head = content[:600].replace("\n", "\\n")
    tail = content[-400:].replace("\n", "\\n") if n > 600 else ""
    log.error(
        "agent=%s parse FAILED. len=%d  err=%s  head: %s   …  tail: %s",
        agent,
        n,
        last_err,
        head,
        tail,
    )
    return None
