"""Synthesis Agent — runs after the parallel analytical agents.
Reads all their outputs and produces the AI's holistic recommendation."""
from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal

from app.agents.base import Agent, AgentInput, AgentOutput
from app.agents._json import parse_json_response
from app.llm.claude import router
from app.prompts.system import SYNTHESIS_AGENT_V1


def _json_safe(obj):
    """json.dumps default for Postgres Decimal / datetime values pulled from
    the DB. Without this, agent serialization fails as soon as ANY numeric
    column (score, confidence, etc.) reaches the digest."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


class SynthesisAgent(Agent):
    name = "synthesis_agent"
    system = SYNTHESIS_AGENT_V1
    model_class = "reasoning"

    async def synthesize(
        self,
        *,
        opportunity_id: str,
        thesis_payload: dict | None,
        risks: list[dict] | None,
        gaps: list[dict] | None,
        financials: dict | None,
        market_research_text: str | None,
        briefing_block: str,
    ) -> AgentOutput:
        # Build a compact "agent outputs" digest for synthesis context
        digest_parts: list[str] = []

        if thesis_payload:
            digest_parts.append(
                "## Thesis & SWOT (from Thesis call)\n"
                + json.dumps(thesis_payload, indent=2, default=_json_safe)
            )

        if risks:
            digest_parts.append(
                "## Risks (from Risk Analyst — "
                f"{len(risks)} items)\n"
                + json.dumps(
                    [
                        {
                            "category": r.get("category"),
                            "title": r.get("title"),
                            "severity": r.get("severity"),
                            "likelihood": r.get("likelihood"),
                            "description": r.get("description"),
                            "mitigation": r.get("mitigation"),
                        }
                        for r in risks
                    ],
                    indent=2,
                    default=_json_safe,
                )
            )

        if gaps:
            digest_parts.append(
                "## Gaps (from Gap Agent)\n"
                + json.dumps(
                    [
                        {
                            "category": g.get("category"),
                            "title": g.get("title"),
                            "priority": g.get("priority"),
                            "description": g.get("description"),
                            "recommendation": g.get("recommendation"),
                        }
                        for g in gaps
                    ],
                    indent=2,
                    default=_json_safe,
                )
            )

        if financials:
            digest_parts.append(
                "## Financial Analyst output\n"
                + json.dumps(financials, indent=2, default=_json_safe)[:8000]
            )

        if market_research_text:
            digest_parts.append(
                "## Market Researcher output (verified via web_search)\n"
                + market_research_text
            )

        digest = "\n\n".join(digest_parts) if digest_parts else "(no prior agent outputs)"

        user = (
            "Synthesize the agent outputs below into a holistic AI recommendation. "
            "Reconcile contradictions. Be decisive. Reference specific findings.\n\n"
            f"## Briefing & client context\n{briefing_block}\n\n"
            f"## Agent outputs\n{digest}\n\n"
            "Return JSON only matching the schema in your system prompt."
        )

        result = await router.complete(
            klass=self.model_class,
            system=self.system,
            messages=[{"role": "user", "content": user}],
            max_tokens=4000,
            temperature=0.15,
            agent=self.name,
        )

        structured = parse_json_response(result.content, agent=self.name)

        return AgentOutput(
            agent=self.name,
            model=result.model,
            content=result.content,
            structured=structured,
            citations=[],
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
        )
