"""Market Researcher agent — uses Anthropic's web_search tool to validate or
challenge the sponsor's market thesis with external public data."""
from __future__ import annotations

from app.agents.base import Agent, AgentInput, AgentOutput, render_context
from app.llm.claude import router
from app.prompts.system import MARKET_ANALYST_V1


class MarketResearcher(Agent):
    name = "market_researcher"
    system = MARKET_ANALYST_V1
    model_class = "reasoning"

    async def run(self, inp: AgentInput) -> AgentOutput:
        ctx = render_context(inp.context_chunks)
        cached_ctx = f"## Shared Retrieved Document Context\n\n{ctx}"
        user = (
            "Research this market using web_search. Validate or challenge the sponsor's "
            "market thesis with external public data. Cite every external claim with a URL. "
            "Use the document context provided in the system prompt as the sponsor's "
            "stated thesis to test against.\n\n"
            f"## Instruction\n{inp.instruction}\n\n"
            "## Output format (strict)\n"
            "Start your response IMMEDIATELY with the first markdown heading. "
            "DO NOT narrate what you are about to do (no 'I'll research…', no "
            "'Let me now compose the analysis', no 'I have substantial market data'). "
            "Structure the output as a memo with markdown:\n"
            "- A `# <Memo title>` line at the top\n"
            "- A `**Headline conclusion:**` paragraph immediately after the title\n"
            "- 4-6 sections, each introduced by a `## <Section title>` heading\n"
            "- Inline citations as `[<url>]` or markdown links `[label](url)`\n"
            "- End with one final line containing the market verdict in the form:\n"
            "  `**Market verdict:** TAILWIND` | `NEUTRAL` | `HEADWIND` — <rationale>"
        )
        # Anthropic web_search tool. Note: because `tools` is part of the
        # cache key, market_researcher writes its OWN cache entry (it cannot
        # share with the other four parallel agents that have no tools). It
        # still benefits from re-runs within the 5-min TTL.
        result = await router.complete(
            klass=self.model_class,
            system=self.system,
            cached_prefix=cached_ctx,
            messages=[{"role": "user", "content": user}],
            max_tokens=8000,
            temperature=0.2,
            agent=self.name,
            tools=[
                {
                    "type": "web_search_20250305",
                    "name": "web_search",
                    "max_uses": 8,
                }
            ],
        )
        return AgentOutput(
            agent=self.name,
            model=result.model,
            content=result.content,
            structured=None,
            citations=[
                {"document_id": c["document_id"], "chunk_id": c["chunk_id"], "page": c.get("page")}
                for c in (inp.context_chunks or [])
            ],
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
        )
