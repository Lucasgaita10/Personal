"""Financial Analyst — runs sequentially after the parallel analytical agents.

Reads the document context AND the outputs of the risk / market / gap / thesis
agents so it can interpret metrics in context — not just extract them. Produces
a structured analytical output with a verdict, narrative, sensitivities, weak-
assumption callouts, plus the raw metric/assumption extraction.
"""
from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal

from app.agents.base import Agent, AgentInput, AgentOutput, render_context


def _json_safe(obj):
    """Default encoder for values that json.dumps can't handle natively.
    Postgres NUMERIC → Decimal, timestamps → datetime, etc. — they all
    flow through here when we serialize the cross-agent context."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")
from app.agents._json import parse_json_response
from app.llm.claude import router
from app.prompts.system import FINANCIAL_ANALYST_V1


class FinancialAnalyst(Agent):
    name = "financial_analyst"
    system = FINANCIAL_ANALYST_V1
    model_class = "reasoning"

    async def run(self, inp: AgentInput) -> AgentOutput:
        """Backwards-compat parallel entry point — used only if someone wires
        the analyst into the parallel batch. The richer analysis happens via
        `analyze()` below, which takes cross-agent context."""
        return await self.analyze(
            opportunity_id=inp.opportunity_id,
            instruction=inp.instruction,
            context_chunks=inp.context_chunks,
            briefing_block="",
        )

    async def analyze(
        self,
        *,
        opportunity_id: str,
        instruction: str,
        context_chunks,
        briefing_block: str,
        thesis_payload: dict | None = None,
        risks: list[dict] | None = None,
        gaps: list[dict] | None = None,
        market_research_text: str | None = None,
    ) -> AgentOutput:
        ctx = render_context(context_chunks)
        cached_ctx = f"## Shared Retrieved Document Context\n\n{ctx}"

        digest_parts: list[str] = []

        if thesis_payload:
            slim_thesis = {
                "thesis": thesis_payload.get("thesis"),
                "executive_summary": thesis_payload.get("executive_summary"),
                "scores": thesis_payload.get("scores"),
            }
            digest_parts.append(
                "## Thesis & scores (from Thesis Writer)\n"
                + json.dumps(slim_thesis, indent=2, default=_json_safe)
            )

        if risks:
            slim_risks = [
                {
                    "category": r.get("category"),
                    "title": r.get("title"),
                    "severity": r.get("severity"),
                    "description": r.get("description"),
                }
                for r in risks
            ]
            digest_parts.append(
                f"## Risks (from Risk Analyst — {len(risks)} items)\n"
                + json.dumps(slim_risks, indent=2, default=_json_safe)
            )

        if gaps:
            slim_gaps = [
                {
                    "category": g.get("category"),
                    "title": g.get("title"),
                    "priority": g.get("priority"),
                    "description": g.get("description"),
                }
                for g in gaps
            ]
            digest_parts.append(
                f"## Gaps (from Gap Agent — {len(gaps)} items)\n"
                + json.dumps(slim_gaps, indent=2, default=_json_safe)
            )

        if market_research_text:
            # Truncate defensively — the market narrative can be long.
            digest_parts.append(
                "## Market Research (from Market Researcher — verified via web_search)\n"
                + market_research_text[:8000]
            )

        cross_agent = (
            "\n\n".join(digest_parts) if digest_parts else "(no prior agent outputs)"
        )

        user = (
            "You are doing the FINANCIAL UNDERWRITING REVIEW for this opportunity. "
            "The document context is in the system prompt. Below are the findings "
            "from the other analysts in this Analyze run — use them to interpret "
            "the numbers, not just extract them. Pressure-test the sponsor's "
            "assumptions against the market researcher's findings specifically.\n\n"
            f"## Briefing & client mandate\n{briefing_block or '(none provided)'}\n\n"
            f"## Other agents' findings\n{cross_agent}\n\n"
            f"## Instruction\n{instruction}\n\n"
            "Return JSON only matching the schema in the system prompt. No prose "
            "outside the JSON. No markdown fences."
        )

        result = await router.complete(
            klass=self.model_class,
            system=self.system,
            cached_prefix=cached_ctx,
            messages=[{"role": "user", "content": user}],
            max_tokens=12000,
            temperature=0.1,
            agent=self.name,
        )

        structured = parse_json_response(result.content, agent=self.name)

        return AgentOutput(
            agent=self.name,
            model=result.model,
            content=result.content,
            structured=structured,
            citations=[
                {"document_id": c["document_id"], "chunk_id": c["chunk_id"], "page": c.get("page")}
                for c in (context_chunks or [])
            ],
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
        )
