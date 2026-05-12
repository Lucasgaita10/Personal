"""The orchestrator: planner + agent dispatcher + memory weaving."""
from __future__ import annotations

from dataclasses import dataclass

from app.agents import REGISTRY
from app.agents.base import AgentInput, AgentOutput
from app.llm.claude import router
from app.memory.store import MemoryStore
from app.prompts.system import ORCHESTRATOR_V1
from app.rag.retriever import retriever


@dataclass
class OrchestratorRequest:
    opportunity_id: str
    thread_id: str | None
    user_message: str
    top_k: int = 8
    agent_hint: str | None = None  # 'risk', 'financial', 'challenge', 'memo', 'scenario', ...


INTENT_KEYWORDS = {
    "risk_analyst": ["risk", "downside", "concentration", "sponsor risk", "tenant risk"],
    "financial_analyst": ["irr", "moic", "cap rate", "dscr", "cash flow", "debt yield", "noi"],
    "scenario_agent": ["what if", "stress", "scenario", "downside case", "if rates", "if vacancy"],
    "ic_challenger": ["challenge", "devil", "weakest", "reasons to reject", "kill the deal"],
    "ic_writer": ["memo", "executive summary", "ic memo", "draft the"],
    "gap_agent": ["gap", "missing", "what else do we need", "follow-up"],
    "legal_reviewer": ["lease", "loan agreement", "covenant", "guaranty", "legal", "clause"],
    "market_analyst": ["market", "comp", "vacancy rate", "supply", "demand", "absorption"],
    "portfolio_agent": ["portfolio", "exposure", "overlap", "existing positions"],
}


def pick_agent(message: str, hint: str | None) -> str:
    if hint and hint in REGISTRY:
        return hint
    msg = message.lower()
    for agent, kws in INTENT_KEYWORDS.items():
        if any(k in msg for k in kws):
            return agent
    return "orchestrator"


class Orchestrator:
    def __init__(self) -> None:
        self.memory = MemoryStore()

    async def respond(self, req: OrchestratorRequest) -> dict:
        chunks = await retriever.retrieve(
            opportunity_id=req.opportunity_id,
            query=req.user_message,
            top_k=req.top_k,
        )
        context_chunks = [
            {
                "chunk_id": c.chunk_id,
                "document_id": c.document_id,
                "page": c.page,
                "content": c.content,
            }
            for c in chunks
        ]

        memory_blocks = await self.memory.load(req.opportunity_id, req.thread_id)

        agent_name = pick_agent(req.user_message, req.agent_hint)
        if agent_name in REGISTRY:
            agent = REGISTRY[agent_name]
            instruction = (
                f"{req.user_message}\n\n## Conversation memory\n{memory_blocks or '(none)'}"
            )
            out: AgentOutput = await agent.run(
                AgentInput(
                    opportunity_id=req.opportunity_id,
                    instruction=instruction,
                    context_chunks=context_chunks,
                )
            )
            return {
                "agent": out.agent,
                "model": out.model,
                "content": out.content,
                "structured": out.structured,
                "citations": out.citations,
                "input_tokens": out.input_tokens,
                "output_tokens": out.output_tokens,
            }

        # Default: pass through orchestrator persona with the retrieved context.
        # Insights chat → reasoning model (Opus). Understanding the deal is
        # the highest-value path; we pay for the better reasoning here.
        ctx_str = "\n---\n".join(
            f"[chunk:{c['chunk_id']} doc:{c['document_id']} p.{c.get('page')}]\n{c['content']}"
            for c in context_chunks
        ) or "(no documents retrieved)"

        result = await router.complete(
            klass="reasoning",
            system=ORCHESTRATOR_V1,
            agent="orchestrator",
            messages=[
                {
                    "role": "user",
                    "content": f"## Memory\n{memory_blocks}\n\n## Context\n{ctx_str}\n\n## Question\n{req.user_message}",
                }
            ],
            max_tokens=4000,
        )
        return {
            "agent": "orchestrator",
            "model": result.model,
            "content": result.content,
            "structured": None,
            "citations": [
                {"document_id": c["document_id"], "chunk_id": c["chunk_id"], "page": c.get("page")}
                for c in context_chunks
            ],
            "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens,
        }


orchestrator = Orchestrator()
