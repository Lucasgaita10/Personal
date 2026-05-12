"""Semantic chunking with token-aware overlap."""
from __future__ import annotations

import re
from dataclasses import dataclass

import tiktoken


_enc = tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    return len(_enc.encode(text))


@dataclass
class Chunk:
    ordinal: int
    page: int | None
    content: str
    tokens: int
    metadata: dict


def chunk_text(
    text: str,
    *,
    page: int | None = None,
    target_tokens: int = 800,
    overlap_tokens: int = 100,
) -> list[Chunk]:
    """Split on paragraph boundaries first; pack into ~target_tokens windows."""
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[Chunk] = []
    buf: list[str] = []
    buf_tokens = 0
    ordinal = 0

    def flush():
        nonlocal buf, buf_tokens, ordinal
        if not buf:
            return
        content = "\n\n".join(buf).strip()
        chunks.append(
            Chunk(
                ordinal=ordinal,
                page=page,
                content=content,
                tokens=count_tokens(content),
                metadata={"paragraphs": len(buf)},
            )
        )
        ordinal += 1
        # carry overlap
        if overlap_tokens > 0 and buf:
            tail_text = buf[-1]
            tail_tokens = count_tokens(tail_text)
            buf = [tail_text] if tail_tokens <= overlap_tokens else []
            buf_tokens = tail_tokens if buf else 0
        else:
            buf = []
            buf_tokens = 0

    for p in paragraphs:
        ptokens = count_tokens(p)
        if ptokens > target_tokens * 1.5:
            # split very long paragraph by sentence
            sentences = re.split(r"(?<=[\.\?\!])\s+", p)
            for s in sentences:
                stokens = count_tokens(s)
                if buf_tokens + stokens > target_tokens:
                    flush()
                buf.append(s)
                buf_tokens += stokens
            continue
        if buf_tokens + ptokens > target_tokens:
            flush()
        buf.append(p)
        buf_tokens += ptokens
    flush()
    return chunks
