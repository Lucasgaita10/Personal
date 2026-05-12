"""Base agent contract."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

from app.llm.claude import router, ModelClass


@dataclass
class AgentInput:
    opportunity_id: str
    instruction: str
    context_chunks: Sequence[dict] | None = None
    extra: dict[str, Any] | None = None


@dataclass
class AgentOutput:
    agent: str
    model: str
    content: str
    structured: dict | list | None = None
    citations: list[dict] = None  # type: ignore[assignment]
    input_tokens: int = 0
    output_tokens: int = 0


def render_context(chunks: Sequence[dict] | None) -> str:
    if not chunks:
        return "(no documents retrieved for this query)"
    parts = []
    for c in chunks:
        page = f" p.{c.get('page')}" if c.get("page") else ""
        parts.append(f"[chunk:{c['chunk_id']} doc:{c['document_id']}{page}]\n{c['content']}\n")
    return "\n---\n".join(parts)


class Agent:
    name: str = "agent"
    system: str = ""
    model_class: ModelClass = "default"

    async def run(self, inp: AgentInput) -> AgentOutput:
        ctx = render_context(inp.context_chunks)
        user = f"## Task\n{inp.instruction}\n\n## Retrieved Context\n{ctx}"
        result = await router.complete(
            klass=self.model_class,
            system=self.system,
            messages=[{"role": "user", "content": user}],
            max_tokens=2048,
            agent=self.name,
        )
        cites = [
            {"document_id": c["document_id"], "chunk_id": c["chunk_id"], "page": c.get("page")}
            for c in (inp.context_chunks or [])
        ]
        return AgentOutput(
            agent=self.name,
            model=result.model,
            content=result.content,
            citations=cites,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
        )
