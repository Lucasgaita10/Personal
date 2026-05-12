from app.agents.base import Agent, AgentInput, AgentOutput, render_context
from app.agents._json import parse_json_response
from app.llm.claude import router
from app.prompts.system import RISK_ANALYST_V1


class RiskAnalyst(Agent):
    name = "risk_analyst"
    system = RISK_ANALYST_V1
    model_class = "reasoning"

    async def run(self, inp: AgentInput) -> AgentOutput:
        ctx = render_context(inp.context_chunks)
        cached_ctx = f"## Shared Retrieved Document Context\n\n{ctx}"
        user = (
            "Identify risks across categories: SPONSOR, LEVERAGE, MARKET, CONCENTRATION, "
            "LEGAL, CONSTRUCTION, TENANT, REFINANCE, REGULATORY, ESG, OTHER. "
            "Use the document context provided in the system prompt.\n"
            "Return JSON: {\"risks\": [{category, title, description, severity (LOW|MEDIUM|HIGH|CRITICAL), "
            "likelihood, mitigation, citations: [{document_id, chunk_id, page}]}]}\n\n"
            f"## Instruction\n{inp.instruction}\n\n"
            "Respond with the JSON object only — no prose, no markdown fences, no commentary."
        )
        result = await router.complete(
            klass=self.model_class,
            system=self.system,
            cached_prefix=cached_ctx,
            messages=[{"role": "user", "content": user}],
            max_tokens=8000,
            temperature=0.1,
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
