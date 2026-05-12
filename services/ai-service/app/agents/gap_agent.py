from app.agents.base import Agent, AgentInput, AgentOutput, render_context
from app.agents._json import parse_json_response
from app.llm.claude import router
from app.prompts.system import GAP_AGENT_V1


class GapAgent(Agent):
    name = "gap_agent"
    system = GAP_AGENT_V1
    model_class = "reasoning"

    async def run(self, inp: AgentInput) -> AgentOutput:
        ctx = render_context(inp.context_chunks)
        cached_ctx = f"## Shared Retrieved Document Context\n\n{ctx}"
        user = (
            "Enumerate diligence gaps. For each: category (documents|data|assumptions|legal|market), "
            "title, description, priority (LOW|MEDIUM|HIGH|BLOCKER), rationale, recommendation. "
            "Use the document context provided in the system prompt.\n"
            "Also output an ic_readiness_score from 0-10 reflecting completeness for IC review.\n\n"
            f"## Instruction\n{inp.instruction}\n\n"
            'Return JSON only — schema: {"gaps": [...], "ic_readiness_score": <number>}. '
            "No markdown fences, no prose outside the JSON."
        )
        result = await router.complete(
            klass=self.model_class,
            system=self.system,
            cached_prefix=cached_ctx,
            messages=[{"role": "user", "content": user}],
            max_tokens=8000,
            temperature=0.0,
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
