"""Stone Gate AI service — FastAPI entrypoint."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import uuid
from typing import Any

log = logging.getLogger("stonegate.ai")


def _parse_numeric(value: Any) -> float | None:
    """Robust extraction of a float from arbitrary AI output formats:
       '12,500,000', '$12.5M', '5.6%', '1.5x', 'USD 70m', '-3.2', 0.55, etc.
       Returns None if no number can be extracted."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return None
    s = value.strip().replace(",", "")
    if not s:
        return None
    # Detect a magnitude suffix anywhere in the string (K/M/B/Bn)
    s_low = s.lower()
    multiplier = 1.0
    if "billion" in s_low or re.search(r"\bbn?\b", s_low) or s_low.endswith("b"):
        multiplier = 1_000_000_000
    elif "million" in s_low or s_low.endswith("m") or "mn" in s_low:
        multiplier = 1_000_000
    elif "thousand" in s_low or s_low.endswith("k"):
        multiplier = 1_000
    m = re.search(r"-?\d+(?:\.\d+)?", s)
    if not m:
        return None
    try:
        return float(m.group(0)) * multiplier
    except ValueError:
        return None

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.agents import REGISTRY
from app.agents.base import AgentInput, render_context
from app.config import get_settings
from app.financial.engine import BaseCase, run_case
from app.llm.claude import router as claude
from app.llm.telemetry import set_scope
from app.memory.store import MemoryStore
from app.orchestrator import Orchestrator, OrchestratorRequest
from app.prompts.system import ORCHESTRATOR_V1
from app.rag.retriever import retriever
from app.reporting import render_pdf, render_pptx

app = FastAPI(title="Stone Gate AI Service", version="0.1.0")
orch = Orchestrator()
memory = MemoryStore()


def _engine():
    url = get_settings().database_url.replace("postgresql://", "postgresql+psycopg://")
    return create_async_engine(url, pool_pre_ping=True)


# ─── Models ─────────────────────────────────────────────────────────


class ChatBody(BaseModel):
    opportunityId: str
    threadId: str | None = None
    message: str
    topK: int = 8
    agent: str | None = None


class ScenarioBody(BaseModel):
    opportunityId: str
    scenarioId: str | None = None
    inputs: dict[str, Any]


class ReportBody(BaseModel):
    opportunityId: str
    type: str = Field(..., pattern="^(IC_MEMO_LONG|EXECUTIVE_SUMMARY|PRESENTATION_DECK)$")


class AnalyzeBody(BaseModel):
    opportunityId: str


# ─── Endpoints ──────────────────────────────────────────────────────


@app.get("/healthz")
async def health():
    return {"ok": True, "agents": list(REGISTRY.keys())}


@app.post("/chat")
async def chat(body: ChatBody):
    set_scope(
        endpoint="chat",
        opportunity_id=body.opportunityId,
        thread_id=body.threadId,
        agent=body.agent,
    )
    result = await orch.respond(
        OrchestratorRequest(
            opportunity_id=body.opportunityId,
            thread_id=body.threadId,
            user_message=body.message,
            top_k=body.topK,
            agent_hint=body.agent,
        )
    )
    # Persist assistant message + citations
    eng = _engine()
    async with eng.begin() as conn:
        thread_id = body.threadId
        if not thread_id:
            row = (
                await conn.execute(
                    text(
                        """
                        INSERT INTO "ChatThread" (id, "opportunityId", title, "createdAt", "updatedAt")
                        VALUES (gen_random_uuid()::text, :oid, :title, NOW(), NOW())
                        RETURNING id
                        """
                    ),
                    {"oid": body.opportunityId, "title": body.message[:80]},
                )
            ).scalar_one()
            thread_id = row
        msg_id = (
            await conn.execute(
                text(
                    """
                    INSERT INTO "ChatMessage" (id, "threadId", role, content, agent, model,
                        "inputTokens", "outputTokens", "createdAt")
                    VALUES (gen_random_uuid()::text, :tid, 'ASSISTANT', :c, :a, :m, :it, :ot, NOW())
                    RETURNING id
                    """
                ),
                {
                    "tid": thread_id,
                    "c": result["content"],
                    "a": result["agent"],
                    "m": result["model"],
                    "it": result["input_tokens"],
                    "ot": result["output_tokens"],
                },
            )
        ).scalar_one()
        for c in result.get("citations") or []:
            await conn.execute(
                text(
                    """
                    INSERT INTO "Citation" (id, "messageId", "documentId", "chunkId", page, "createdAt")
                    VALUES (gen_random_uuid()::text, :mid, :did, :cid, :p, NOW())
                    """
                ),
                {"mid": msg_id, "did": c.get("document_id"), "cid": c.get("chunk_id"), "p": c.get("page")},
            )

    return {
        "threadId": thread_id,
        "messageId": msg_id,
        "content": result["content"],
        "citations": result.get("citations") or [],
        "structured": result.get("structured"),
        "model": result["model"],
    }


@app.post("/chat/stream")
async def chat_stream(body: ChatBody):
    set_scope(
        endpoint="chat.stream",
        opportunity_id=body.opportunityId,
        thread_id=body.threadId,
        agent=body.agent,
    )
    chunks = await retriever.retrieve(body.opportunityId, body.message, body.topK)
    ctx = "\n---\n".join(
        f"[chunk:{c.chunk_id} doc:{c.document_id} p.{c.page}]\n{c.content}" for c in chunks
    ) or "(no documents)"
    msgs = [
        {"role": "user", "content": f"## Context\n{ctx}\n\n## Question\n{body.message}"}
    ]

    async def gen():
        yield "event: meta\ndata: " + json.dumps({"chunks": [c.chunk_id for c in chunks]}) + "\n\n"
        # Insights chat uses the reasoning model — understanding is key.
        async for tok in claude.stream(
            klass="reasoning",
            system=ORCHESTRATOR_V1,
            messages=msgs,
            agent="orchestrator",
        ):
            yield "event: token\ndata: " + json.dumps({"t": tok}) + "\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.post("/scenarios/run")
async def scenarios_run(body: ScenarioBody):
    set_scope(endpoint="scenarios.run", opportunity_id=body.opportunityId)
    eng = _engine()
    async with eng.connect() as conn:
        row = (
            await conn.execute(
                text(
                    """
                    SELECT "askingEquity", "totalCapitalization", "targetIrr", "targetMoic",
                           "holdPeriodYears"
                    FROM "Opportunity" WHERE id = :id
                    """
                ),
                {"id": body.opportunityId},
            )
        ).first()
    if not row:
        raise HTTPException(404, "opportunity not found")

    equity = float(row[0] or 0)
    total = float(row[1] or 0)
    loan = max(total - equity, 0.0)
    base = BaseCase(
        purchase_price=total or 100_000_000,
        equity_invested=equity or 30_000_000,
        loan_amount=loan or 70_000_000,
        interest_rate=0.055,
        amortization_years=25,
        hold_years=int(row[4] or 5),
        base_noi=(total or 100_000_000) * 0.06,
        rent_growth=0.03,
        exit_cap=0.06,
    )
    inp = body.inputs or {}
    res = run_case(
        base,
        vacancy=float(inp.get("vacancy", 0.0)),
        rate_shock_bps=float(inp.get("rateShockBps", 0.0)),
        exit_cap_bps=float(inp.get("exitCapBps", 0.0)),
        rent_growth_delta=float(inp.get("rentGrowthDelta", 0.0)),
        refinance_available=bool(inp.get("refinanceAvailable", True)),
        noi_haircut=float(inp.get("noiHaircut", 0.0)),
        capex_overrun=float(inp.get("capexOverrun", 0.0)),
    )
    return {
        "runId": str(uuid.uuid4()),
        "outputs": {
            "irr": res.irr,
            "moic": res.moic,
            "dscrMin": res.dscr_min,
            "cashOnCash": res.cash_on_cash,
            "breakEvenOccupancy": res.break_even_occupancy,
            "notes": res.notes,
        },
        "cashflow": res.cashflow,
    }


_THESIS_PROMPT = """\
You are Stone Gate's investment intelligence orchestrator. Read the
documents and briefing context, then produce a structured opening read of
the opportunity.

Return JSON ONLY with this shape:
{
  "thesis": "3-4 paragraph institutional investment thesis. Concrete, sourced, sober.",
  "executive_summary": "1 dense paragraph, principal-ready. State the opportunity, the deal economics, the headline risk, and a one-line recommendation.",
  "swot": {
    "strengths": ["...", "..."],
    "weaknesses": ["...", "..."],
    "opportunities": ["...", "..."],
    "threats": ["...", "..."]
  },
  "bull_case": ["3-5 bullet points: the optimistic path"],
  "base_case": ["3-5 bullets: realistic central scenario"],
  "bear_case": ["3-5 bullets: realistic downside path"],
  "scores": {
    "opportunity": 0-10,
    "risk": 0-10,
    "confidence": 0-10
  }
}

Scoring guidance:
- opportunity: how attractive is this deal on a risk-adjusted basis (10 = exceptional, 5 = neutral, 0 = avoid)
- risk: severity of risks (10 = high risk, 5 = moderate, 0 = de-risked)
- confidence: how complete is the diligence basis for the analysis (10 = comprehensive, 5 = patchy, 0 = no basis)
"""


@app.post("/analyze/opportunity")
async def analyze_opportunity(body: AnalyzeBody):
    """Run the full deep-read pipeline:
       Thesis + Financial + Risk + Gap agents in parallel, then persist.
    """
    set_scope(endpoint="analyze.opportunity", opportunity_id=body.opportunityId)
    chunks = await retriever.retrieve(
        body.opportunityId,
        "investment thesis risks financials market sponsor",
        32,
    )
    ctx = [
        {
            "chunk_id": c.chunk_id,
            "document_id": c.document_id,
            "page": c.page,
            "content": c.content,
        }
        for c in chunks
    ]

    if not ctx:
        raise HTTPException(
            400,
            "No documents available. Upload and process documents before analysis.",
        )

    briefing_block = await memory.load(body.opportunityId, None)

    # ── Build the four agent calls (run concurrently) ────────────────
    # Render the context the SAME way the other agents do, so the cached
    # system prefix is byte-identical → all four parallel agents (thesis,
    # risk, gap, financial) share one cache entry within the 5-min TTL.
    # market_researcher caches separately because `tools` is part of the
    # cache key.
    cached_ctx = f"## Shared Retrieved Document Context\n\n{render_context(ctx)}"

    # Prime the cache: fire one tiny request that writes the shared-context
    # cache entry, THEN fan out the parallel agents (which now read it
    # instead of each writing their own redundant copy). Without this primer
    # the concurrent agents all race past the cache and each pays a 1.25×
    # write surcharge — net cost goes UP, not down. With the primer we pay
    # one ~$0.07 write and the four no-tools agents read at 0.1× rate.
    # Saves ~$0.19 per Analyze. Adds ~0.5s before the gather.
    try:
        await claude.complete(
            klass="reasoning",
            system="Cache primer. Reply with the single word 'ok'.",
            cached_prefix=cached_ctx,
            messages=[{"role": "user", "content": "ok?"}],
            max_tokens=10,
            temperature=0.0,
            agent="cache_primer",
        )
    except Exception as e:
        log.warning("cache primer failed (%s) — agents will write their own copies", e)

    async def thesis_call():
        return await claude.complete(
            klass="reasoning",
            system=_THESIS_PROMPT,
            cached_prefix=cached_ctx,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"## Briefing & client context\n{briefing_block}\n\n"
                        "Use the retrieved document context provided in the system prompt. "
                        "Produce the JSON now. No prose outside the JSON."
                    ),
                }
            ],
            max_tokens=4000,
            temperature=0.15,
            agent="thesis_writer",
        )

    risk_task = REGISTRY["risk_analyst"].run(
        AgentInput(
            opportunity_id=body.opportunityId,
            instruction=(
                "Enumerate all risks for this opportunity. Weight risks heavily based on the "
                "analyst briefing and client mandate.\n\n" + briefing_block
            ),
            context_chunks=ctx,
        )
    )
    gap_task = REGISTRY["gap_agent"].run(
        AgentInput(
            opportunity_id=body.opportunityId,
            instruction=(
                "Determine diligence gaps. Gaps specific to client preferences "
                "should be flagged HIGH priority.\n\n" + briefing_block
            ),
            context_chunks=ctx,
        )
    )
    # NOTE: financial_analyst is NO LONGER in the parallel batch. It now runs
    # sequentially after the parallel agents complete so it can interpret the
    # numbers in context of risk/market/gap/thesis findings. See further below.
    market_task = REGISTRY["market_researcher"].run(
        AgentInput(
            opportunity_id=body.opportunityId,
            instruction=(
                "Validate the sponsor's market thesis. Use web_search to gather independent "
                "evidence on the submarket, comparable transactions, supply pipeline, "
                "regulatory environment, and sponsor track record.\n\n"
                + briefing_block
            ),
            context_chunks=ctx,
        )
    )

    # Run the four parallel agents (thesis / risk / gap / market) concurrently.
    # financial_analyst runs SEQUENTIALLY below with their outputs in context
    # so it can interpret metrics — not just extract them.
    agent_results = await asyncio.gather(
        thesis_call(),
        risk_task,
        gap_task,
        market_task,
        return_exceptions=True,
    )
    thesis_result, risks_out, gaps_out, market_out = agent_results

    agent_errors: dict[str, str] = {}
    for name, r in zip(
        ["thesis", "risk_analyst", "gap_agent", "market_researcher"],
        agent_results,
    ):
        if isinstance(r, Exception):
            log.error("agent %s failed: %s", name, r)
            agent_errors[name] = type(r).__name__ + ": " + str(r)[:200]

    # If EVERY parallel agent failed, bail with a clear error. The financial
    # analyst needs at least one upstream finding to interpret.
    if len(agent_errors) == len(agent_results):
        raise HTTPException(
            status_code=503,
            detail={
                "error": "All parallel AI agents failed",
                "by_agent": agent_errors,
                "hint": "Anthropic may be overloaded. Try again in a moment.",
            },
        )

    # ── Run financial_analyst SEQUENTIALLY with cross-agent context ──
    set_scope(
        endpoint="analyze.financial",
        opportunity_id=body.opportunityId,
        agent="financial_analyst",
    )

    # Parse thesis early — financial_analyst wants it.
    thesis_data: dict = {}
    if not isinstance(thesis_result, Exception) and thesis_result is not None:
        try:
            thesis_data = json.loads(thesis_result.content)
        except json.JSONDecodeError:
            m = re.search(r"\{.*\}", thesis_result.content, re.DOTALL)
            if m:
                try:
                    thesis_data = json.loads(m.group(0))
                except json.JSONDecodeError:
                    thesis_data = {}

    risks_for_fin = (
        risks_out.structured.get("risks")
        if (not isinstance(risks_out, Exception)
            and risks_out is not None
            and isinstance(getattr(risks_out, "structured", None), dict))
        else None
    )
    gaps_for_fin = (
        gaps_out.structured.get("gaps")
        if (not isinstance(gaps_out, Exception)
            and gaps_out is not None
            and isinstance(getattr(gaps_out, "structured", None), dict))
        else None
    )
    market_text_for_fin = (
        market_out.content
        if (not isinstance(market_out, Exception) and market_out is not None)
        else None
    )

    fin_out = None
    try:
        fin_out = await REGISTRY["financial_analyst"].analyze(
            opportunity_id=body.opportunityId,
            instruction=(
                "Underwrite this opportunity. Produce a verdict, narrative, "
                "sensitivities, weak-assumption callouts, headline metrics, and "
                "the full metric/assumption extraction.\n\n" + briefing_block
            ),
            context_chunks=ctx,
            briefing_block=briefing_block,
            thesis_payload=thesis_data or None,
            risks=risks_for_fin,
            gaps=gaps_for_fin,
            market_research_text=market_text_for_fin,
        )
    except Exception as e:
        log.error("financial_analyst failed: %s", e)
        agent_errors["financial_analyst"] = type(e).__name__ + ": " + str(e)[:200]

    # ── Persist outputs ──────────────────────────────────────────────
    eng = _engine()

    # (thesis_data was parsed above before running financial_analyst)
    scores = thesis_data.get("scores") or {}

    # Clear prior risks/gaps so analysis is idempotent
    async with eng.begin() as conn:
        await conn.execute(
            text('DELETE FROM "Risk" WHERE "opportunityId" = :id'),
            {"id": body.opportunityId},
        )
        await conn.execute(
            text('DELETE FROM "Gap" WHERE "opportunityId" = :id'),
            {"id": body.opportunityId},
        )

    # Risks
    risks_count = 0
    if (
        not isinstance(risks_out, Exception)
        and risks_out is not None
        and risks_out.structured
        and isinstance(risks_out.structured, dict)
    ):
        async with eng.begin() as conn:
            for r in risks_out.structured.get("risks", []):
                await conn.execute(
                    text(
                        """
                        INSERT INTO "Risk" (id, "opportunityId", category, title, description,
                            severity, likelihood, mitigation, "createdAt")
                        VALUES (gen_random_uuid()::text, :oid, :cat, :t, :d, :s, :l, :m, NOW())
                        """
                    ),
                    {
                        "oid": body.opportunityId,
                        "cat": r.get("category", "OTHER"),
                        "t": r.get("title", "")[:255],
                        "d": r.get("description", ""),
                        "s": r.get("severity", "MEDIUM"),
                        "l": r.get("likelihood", "MEDIUM"),
                        "m": r.get("mitigation"),
                    },
                )
                risks_count += 1

    # Gaps + IC readiness
    gaps_count = 0
    ic_score = None
    if (
        not isinstance(gaps_out, Exception)
        and gaps_out is not None
        and gaps_out.structured
        and isinstance(gaps_out.structured, dict)
    ):
        async with eng.begin() as conn:
            for g in gaps_out.structured.get("gaps", []):
                await conn.execute(
                    text(
                        """
                        INSERT INTO "Gap" (id, "opportunityId", category, title, description,
                            priority, rationale, recommendation, "createdAt")
                        VALUES (gen_random_uuid()::text, :oid, :cat, :t, :d, :p, :r, :rec, NOW())
                        """
                    ),
                    {
                        "oid": body.opportunityId,
                        "cat": g.get("category", "data"),
                        "t": g.get("title", "")[:255],
                        "d": g.get("description", ""),
                        "p": g.get("priority", "MEDIUM"),
                        "r": g.get("rationale"),
                        "rec": g.get("recommendation"),
                    },
                )
                gaps_count += 1
            ic_score = gaps_out.structured.get("ic_readiness_score")

    # Financial metrics + assumptions (idempotent: clear any prior AI-extracted ones)
    metrics_count = 0
    if (
        not isinstance(fin_out, Exception)
        and fin_out is not None
        and fin_out.structured
        and isinstance(fin_out.structured, dict)
    ):
        async with eng.begin() as conn:
            await conn.execute(
                text(
                    'DELETE FROM "ExtractedMetric" WHERE "opportunityId" = :id'
                ),
                {"id": body.opportunityId},
            )
            await conn.execute(
                text(
                    'DELETE FROM "FinancialAssumption" WHERE "opportunityId" = :id'
                ),
                {"id": body.opportunityId},
            )
            for m in fin_out.structured.get("metrics", []) or []:
                val = _parse_numeric(m.get("value"))
                if val is None:
                    log.warning(
                        "financial_analyst: skipping unparseable metric value: %r (name=%r)",
                        m.get("value"),
                        m.get("name"),
                    )
                    continue
                await conn.execute(
                    text(
                        """
                        INSERT INTO "ExtractedMetric" (id, "opportunityId", name, value, unit,
                            period, confidence, source, "createdAt")
                        VALUES (gen_random_uuid()::text, :oid, :n, :v, :u, :p, :cf, :src, NOW())
                        """
                    ),
                    {
                        "oid": body.opportunityId,
                        "n": str(m.get("name", "metric"))[:120],
                        "v": val,
                        "u": m.get("unit"),
                        "p": m.get("period"),
                        "cf": float(m.get("confidence") or 0.7),
                        "src": json.dumps(m.get("citation"))[:1000] if m.get("citation") else None,
                    },
                )
                metrics_count += 1
            for a in fin_out.structured.get("assumptions", []) or []:
                val = _parse_numeric(a.get("value"))
                if val is None:
                    log.warning(
                        "financial_analyst: skipping unparseable assumption value: %r (name=%r)",
                        a.get("value"),
                        a.get("name"),
                    )
                    continue
                await conn.execute(
                    text(
                        """
                        INSERT INTO "FinancialAssumption" (id, "opportunityId", name, value, unit,
                            description, "isWeak", rationale, source, "createdAt")
                        VALUES (gen_random_uuid()::text, :oid, :n, :v, :u, :d, :w, :r, :src, NOW())
                        """
                    ),
                    {
                        "oid": body.opportunityId,
                        "n": str(a.get("name", "assumption"))[:120],
                        "v": val,
                        "u": a.get("unit"),
                        "d": a.get("description"),
                        "w": bool(a.get("is_weak", False)),
                        "r": a.get("rationale"),
                        "src": a.get("source"),
                    },
                )

    # ── Synthesis Agent — runs AFTER the parallel agents ────────────
    set_scope(
        endpoint="analyze.synthesis",
        opportunity_id=body.opportunityId,
        agent="synthesis_agent",
    )

    def _safe_structured(r):
        if isinstance(r, Exception) or r is None:
            return None
        return r.structured if isinstance(getattr(r, "structured", None), dict) else None

    def _safe_content(r):
        if isinstance(r, Exception) or r is None:
            return None
        return getattr(r, "content", None)

    risks_struct = _safe_structured(risks_out) or {}
    gaps_struct = _safe_structured(gaps_out) or {}
    fin_struct = _safe_structured(fin_out)

    synthesis = {}
    synthesis_out = None
    try:
        synthesis_out = await REGISTRY["synthesis_agent"].synthesize(
            opportunity_id=body.opportunityId,
            thesis_payload=thesis_data or None,
            risks=risks_struct.get("risks"),
            gaps=gaps_struct.get("gaps"),
            financials=fin_struct,
            market_research_text=_safe_content(market_out),
            briefing_block=briefing_block,
        )
        synthesis = (
            synthesis_out.structured
            if isinstance(synthesis_out.structured, dict)
            else {}
        )
    except Exception as e:
        log.error("synthesis agent failed: %s", e)
        agent_errors["synthesis_agent"] = type(e).__name__ + ": " + str(e)[:200]

    # Update Opportunity with thesis + scores + IC readiness + synthesis
    async with eng.begin() as conn:
        await conn.execute(
            text(
                """
                UPDATE "Opportunity" SET
                    thesis = COALESCE(:thesis, thesis),
                    "executiveSummary" = COALESCE(:exec, "executiveSummary"),
                    swot = COALESCE(CAST(:swot AS jsonb), swot),
                    "bullCase" = COALESCE(CAST(:bull AS jsonb), "bullCase"),
                    "baseCase" = COALESCE(CAST(:base AS jsonb), "baseCase"),
                    "bearCase" = COALESCE(CAST(:bear AS jsonb), "bearCase"),
                    "opportunityScore" = COALESCE(:opp, "opportunityScore"),
                    "riskScore" = COALESCE(:risk, "riskScore"),
                    "confidenceScore" = COALESCE(:conf, "confidenceScore"),
                    "icReadinessScore" = COALESCE(:ic, "icReadinessScore"),
                    "aiVerdict" = :verdict,
                    "aiVerdictRationale" = :verdict_rationale,
                    "aiTopReasonsFor" = CAST(:reasons_for AS jsonb),
                    "aiTopReasonsAgainst" = CAST(:reasons_against AS jsonb),
                    "aiNextSteps" = CAST(:next_steps AS jsonb),
                    "aiCriticalQuestions" = CAST(:critical_q AS jsonb),
                    "aiWatchpoints" = CAST(:watchpoints AS jsonb),
                    "aiMarketResearch" = :market_research,
                    "financialAnalysis" = CAST(:financial_analysis AS jsonb),
                    "updatedAt" = NOW()
                WHERE id = :id
                """
            ),
            {
                "id": body.opportunityId,
                "thesis": thesis_data.get("thesis"),
                "exec": thesis_data.get("executive_summary"),
                "swot": json.dumps(thesis_data.get("swot")) if thesis_data.get("swot") else None,
                "bull": json.dumps(thesis_data.get("bull_case")) if thesis_data.get("bull_case") else None,
                "base": json.dumps(thesis_data.get("base_case")) if thesis_data.get("base_case") else None,
                "bear": json.dumps(thesis_data.get("bear_case")) if thesis_data.get("bear_case") else None,
                "opp": float(scores.get("opportunity")) if scores.get("opportunity") is not None else None,
                "risk": float(scores.get("risk")) if scores.get("risk") is not None else None,
                "conf": float(scores.get("confidence")) if scores.get("confidence") is not None else None,
                "ic": float(ic_score) if ic_score is not None else None,
                # synthesis
                "verdict": synthesis.get("verdict") if synthesis.get("verdict") in (
                    "PROCEED", "PROCEED_WITH_CONDITIONS", "REJECT", "NEED_MORE_INFO"
                ) else None,
                "verdict_rationale": synthesis.get("verdict_rationale"),
                "reasons_for": json.dumps(synthesis.get("top_reasons_for")) if synthesis.get("top_reasons_for") else None,
                "reasons_against": json.dumps(synthesis.get("top_reasons_against")) if synthesis.get("top_reasons_against") else None,
                "next_steps": json.dumps(synthesis.get("next_steps")) if synthesis.get("next_steps") else None,
                "critical_q": json.dumps(synthesis.get("critical_questions")) if synthesis.get("critical_questions") else None,
                "watchpoints": json.dumps(synthesis.get("watchpoints")) if synthesis.get("watchpoints") else None,
                "market_research": market_out.content if market_out else None,
                # Strip the heavy metrics/assumptions arrays before persisting
                # the analysis blob — those live in their own tables already.
                # We keep verdict, rationale, narrative, sensitivity, callouts,
                # and headline_metrics.
                "financial_analysis": json.dumps(
                    {
                        k: v
                        for k, v in (_safe_structured(fin_out) or {}).items()
                        if k in {
                            "verdict",
                            "verdict_rationale",
                            "analysis",
                            "headline_metrics",
                            "sensitivity",
                            "weak_assumption_callouts",
                        }
                    }
                ) if _safe_structured(fin_out) else None,
            },
        )

    def _tok_in(r):
        if isinstance(r, Exception) or r is None:
            return 0
        return getattr(r, "input_tokens", 0) or 0

    def _tok_out(r):
        if isinstance(r, Exception) or r is None:
            return 0
        return getattr(r, "output_tokens", 0) or 0

    return {
        "jobId": str(uuid.uuid4()),
        "summary": {
            "risks": risks_count,
            "gaps": gaps_count,
            "metrics": metrics_count,
            "thesis_generated": bool(thesis_data.get("thesis")),
            "market_research_generated": bool(_safe_content(market_out)),
            "ai_verdict": synthesis.get("verdict"),
            "scores": scores,
        },
        "agent_errors": agent_errors,  # empty dict on success
        "tokens_used": {
            "thesis_in": _tok_in(thesis_result),
            "thesis_out": _tok_out(thesis_result),
            "risk_in": _tok_in(risks_out),
            "risk_out": _tok_out(risks_out),
            "gap_in": _tok_in(gaps_out),
            "gap_out": _tok_out(gaps_out),
            "fin_in": _tok_in(fin_out),
            "fin_out": _tok_out(fin_out),
            "market_in": _tok_in(market_out),
            "market_out": _tok_out(market_out),
            "synthesis_in": _tok_in(synthesis_out),
            "synthesis_out": _tok_out(synthesis_out),
        },
    }


@app.post("/analyze/opportunity/financial-only")
async def analyze_opportunity_financial_only(body: AnalyzeBody):
    """Re-run ONLY the financial analyst + synthesis using the previously
    persisted outputs from risks / gaps / thesis / market_research. Skips the
    4 parallel agents — saves ~$2 per run and ~25s of latency.

    Requires that a full analyze has already been run on this opportunity
    (so risks/gaps/thesis/market_research exist on the Opportunity row).
    """
    set_scope(
        endpoint="analyze.financial_only",
        opportunity_id=body.opportunityId,
        agent="financial_analyst",
    )

    eng = _engine()

    # Load prior outputs from the DB
    async with eng.begin() as conn:
        opp_row = (
            await conn.execute(
                text(
                    """
                    SELECT thesis, "executiveSummary", swot, "bullCase", "baseCase",
                           "bearCase", "opportunityScore", "riskScore",
                           "confidenceScore", "icReadinessScore", "aiMarketResearch"
                    FROM "Opportunity" WHERE id = :id
                    """
                ),
                {"id": body.opportunityId},
            )
        ).mappings().first()
        if not opp_row:
            raise HTTPException(status_code=404, detail="Opportunity not found")

        risks_rows = (
            await conn.execute(
                text(
                    """
                    SELECT category, title, description, severity, likelihood, mitigation
                    FROM "Risk" WHERE "opportunityId" = :id
                    ORDER BY
                      CASE severity
                        WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1
                        WHEN 'MEDIUM' THEN 2 ELSE 3 END
                    """
                ),
                {"id": body.opportunityId},
            )
        ).mappings().all()
        gaps_rows = (
            await conn.execute(
                text(
                    """
                    SELECT category, title, description, priority, rationale, recommendation
                    FROM "Gap" WHERE "opportunityId" = :id
                    """
                ),
                {"id": body.opportunityId},
            )
        ).mappings().all()

    # No prior analysis = nothing to re-run on
    if not risks_rows and not gaps_rows and not opp_row.get("thesis"):
        raise HTTPException(
            status_code=400,
            detail="No prior analysis found. Run the full /analyze/opportunity first.",
        )

    thesis_data = {
        "thesis": opp_row.get("thesis"),
        "executive_summary": opp_row.get("executiveSummary"),
        "swot": opp_row.get("swot"),
        "bull_case": opp_row.get("bullCase"),
        "base_case": opp_row.get("baseCase"),
        "bear_case": opp_row.get("bearCase"),
        # Numeric columns come back from Postgres as Decimal, which json.dumps
        # (used by financial_analyst to build the LLM context) can't serialize.
        # Coerce to float at the boundary.
        "scores": {
            "opportunity": float(opp_row["opportunityScore"]) if opp_row.get("opportunityScore") is not None else None,
            "risk": float(opp_row["riskScore"]) if opp_row.get("riskScore") is not None else None,
            "confidence": float(opp_row["confidenceScore"]) if opp_row.get("confidenceScore") is not None else None,
        },
    }
    scores = thesis_data.get("scores") or {}
    ic_score = float(opp_row["icReadinessScore"]) if opp_row.get("icReadinessScore") is not None else None
    market_research_text = opp_row.get("aiMarketResearch")
    risks_for_fin = [dict(r) for r in risks_rows]
    gaps_for_fin = [dict(g) for g in gaps_rows]

    # Retrieve document chunks (cheap — local vector + bm25 query, no LLM cost)
    chunks = await retriever.retrieve(
        body.opportunityId,
        "investment thesis risks financials market sponsor",
        32,
    )
    ctx = [
        {
            "chunk_id": c.chunk_id,
            "document_id": c.document_id,
            "page": c.page,
            "content": c.content,
        }
        for c in chunks
    ]
    if not ctx:
        raise HTTPException(
            status_code=400,
            detail="No documents available to analyze.",
        )

    briefing_block = await memory.load(body.opportunityId, None)
    agent_errors: dict[str, str] = {}

    # ── Run financial_analyst with cross-agent context ──
    fin_out = None
    try:
        fin_out = await REGISTRY["financial_analyst"].analyze(
            opportunity_id=body.opportunityId,
            instruction=(
                "Underwrite this opportunity. Produce a verdict, narrative, "
                "sensitivities, weak-assumption callouts, headline metrics, and "
                "the full metric/assumption extraction.\n\n" + briefing_block
            ),
            context_chunks=ctx,
            briefing_block=briefing_block,
            thesis_payload=thesis_data or None,
            risks=risks_for_fin,
            gaps=gaps_for_fin,
            market_research_text=market_research_text,
        )
    except Exception as e:
        log.error("financial_analyst failed: %s", e)
        agent_errors["financial_analyst"] = type(e).__name__ + ": " + str(e)[:200]

    # Persist metrics + assumptions (idempotent: clear prior AI-extracted ones)
    metrics_count = 0
    if (
        fin_out is not None
        and isinstance(getattr(fin_out, "structured", None), dict)
    ):
        async with eng.begin() as conn:
            await conn.execute(
                text('DELETE FROM "ExtractedMetric" WHERE "opportunityId" = :id'),
                {"id": body.opportunityId},
            )
            await conn.execute(
                text('DELETE FROM "FinancialAssumption" WHERE "opportunityId" = :id'),
                {"id": body.opportunityId},
            )
            for m in fin_out.structured.get("metrics", []) or []:
                val = _parse_numeric(m.get("value"))
                if val is None:
                    continue
                await conn.execute(
                    text(
                        """
                        INSERT INTO "ExtractedMetric" (id, "opportunityId", name, value, unit,
                            period, confidence, source, "createdAt")
                        VALUES (gen_random_uuid()::text, :oid, :n, :v, :u, :p, :cf, :src, NOW())
                        """
                    ),
                    {
                        "oid": body.opportunityId,
                        "n": str(m.get("name", "metric"))[:120],
                        "v": val,
                        "u": m.get("unit"),
                        "p": m.get("period"),
                        "cf": float(m.get("confidence") or 0.7),
                        "src": json.dumps(m.get("citation"))[:1000] if m.get("citation") else None,
                    },
                )
                metrics_count += 1
            for a in fin_out.structured.get("assumptions", []) or []:
                val = _parse_numeric(a.get("value"))
                if val is None:
                    continue
                await conn.execute(
                    text(
                        """
                        INSERT INTO "FinancialAssumption" (id, "opportunityId", name, value, unit,
                            description, "isWeak", rationale, source, "createdAt")
                        VALUES (gen_random_uuid()::text, :oid, :n, :v, :u, :d, :w, :r, :src, NOW())
                        """
                    ),
                    {
                        "oid": body.opportunityId,
                        "n": str(a.get("name", "assumption"))[:120],
                        "v": val,
                        "u": a.get("unit"),
                        "d": a.get("description"),
                        "w": bool(a.get("is_weak", False)),
                        "r": a.get("rationale"),
                        "src": a.get("source"),
                    },
                )

    # ── Re-run synthesis with the new financial output ──
    set_scope(
        endpoint="analyze.financial_only.synthesis",
        opportunity_id=body.opportunityId,
        agent="synthesis_agent",
    )

    def _safe_structured(r):
        if isinstance(r, Exception) or r is None:
            return None
        return r.structured if isinstance(getattr(r, "structured", None), dict) else None

    fin_struct = _safe_structured(fin_out)

    # Build the risk/gap dicts in the shape synthesize() expects
    risk_dicts = [
        {
            "category": r["category"],
            "title": r["title"],
            "severity": r["severity"],
            "likelihood": r["likelihood"],
            "description": r["description"],
            "mitigation": r["mitigation"],
        }
        for r in risks_for_fin
    ]
    gap_dicts = [
        {
            "category": g["category"],
            "title": g["title"],
            "priority": g["priority"],
            "description": g["description"],
            "recommendation": g["recommendation"],
        }
        for g in gaps_for_fin
    ]

    synthesis: dict = {}
    synthesis_out = None
    try:
        synthesis_out = await REGISTRY["synthesis_agent"].synthesize(
            opportunity_id=body.opportunityId,
            thesis_payload=thesis_data or None,
            risks=risk_dicts,
            gaps=gap_dicts,
            financials=fin_struct,
            market_research_text=market_research_text,
            briefing_block=briefing_block,
        )
        synthesis = (
            synthesis_out.structured
            if isinstance(synthesis_out.structured, dict)
            else {}
        )
    except Exception as e:
        log.error("synthesis agent failed: %s", e)
        agent_errors["synthesis_agent"] = type(e).__name__ + ": " + str(e)[:200]

    # ── Persist financialAnalysis + refreshed synthesis fields ──
    # COALESCE: a failed re-run must NOT wipe previously-good synthesis data.
    async with eng.begin() as conn:
        await conn.execute(
            text(
                """
                UPDATE "Opportunity" SET
                    "aiVerdict" = COALESCE(:verdict, "aiVerdict"),
                    "aiVerdictRationale" = COALESCE(:verdict_rationale, "aiVerdictRationale"),
                    "aiTopReasonsFor" = COALESCE(CAST(:reasons_for AS jsonb), "aiTopReasonsFor"),
                    "aiTopReasonsAgainst" = COALESCE(CAST(:reasons_against AS jsonb), "aiTopReasonsAgainst"),
                    "aiNextSteps" = COALESCE(CAST(:next_steps AS jsonb), "aiNextSteps"),
                    "aiCriticalQuestions" = COALESCE(CAST(:critical_q AS jsonb), "aiCriticalQuestions"),
                    "aiWatchpoints" = COALESCE(CAST(:watchpoints AS jsonb), "aiWatchpoints"),
                    "financialAnalysis" = COALESCE(CAST(:financial_analysis AS jsonb), "financialAnalysis"),
                    "updatedAt" = NOW()
                WHERE id = :id
                """
            ),
            {
                "id": body.opportunityId,
                "verdict": synthesis.get("verdict") if synthesis.get("verdict") in (
                    "PROCEED", "PROCEED_WITH_CONDITIONS", "REJECT", "NEED_MORE_INFO"
                ) else None,
                "verdict_rationale": synthesis.get("verdict_rationale"),
                "reasons_for": json.dumps(synthesis.get("top_reasons_for")) if synthesis.get("top_reasons_for") else None,
                "reasons_against": json.dumps(synthesis.get("top_reasons_against")) if synthesis.get("top_reasons_against") else None,
                "next_steps": json.dumps(synthesis.get("next_steps")) if synthesis.get("next_steps") else None,
                "critical_q": json.dumps(synthesis.get("critical_questions")) if synthesis.get("critical_questions") else None,
                "watchpoints": json.dumps(synthesis.get("watchpoints")) if synthesis.get("watchpoints") else None,
                "financial_analysis": json.dumps(
                    {
                        k: v
                        for k, v in (fin_struct or {}).items()
                        if k in {
                            "verdict",
                            "verdict_rationale",
                            "analysis",
                            "headline_metrics",
                            "sensitivity",
                            "weak_assumption_callouts",
                        }
                    }
                ) if fin_struct else None,
            },
        )

    def _tok_in(r):
        if isinstance(r, Exception) or r is None:
            return 0
        return getattr(r, "input_tokens", 0) or 0

    def _tok_out(r):
        if isinstance(r, Exception) or r is None:
            return 0
        return getattr(r, "output_tokens", 0) or 0

    return {
        "jobId": str(uuid.uuid4()),
        "mode": "financial_only",
        "summary": {
            "metrics": metrics_count,
            "ai_verdict": synthesis.get("verdict"),
            "financial_verdict": (fin_struct or {}).get("verdict"),
            "scores": scores,
            "ic_readiness_score": ic_score,
        },
        "agent_errors": agent_errors,
        "tokens_used": {
            "fin_in": _tok_in(fin_out),
            "fin_out": _tok_out(fin_out),
            "synthesis_in": _tok_in(synthesis_out),
            "synthesis_out": _tok_out(synthesis_out),
        },
    }


@app.post("/analyze/gaps")
async def analyze_gaps(body: AnalyzeBody):
    set_scope(endpoint="analyze.gaps", opportunity_id=body.opportunityId, agent="gap_agent")
    chunks = await retriever.retrieve(body.opportunityId, "missing data assumptions documents", 16)
    ctx = [
        {"chunk_id": c.chunk_id, "document_id": c.document_id, "page": c.page, "content": c.content}
        for c in chunks
    ]
    briefing_block = await memory.load(body.opportunityId, None)
    out = await REGISTRY["gap_agent"].run(
        AgentInput(
            opportunity_id=body.opportunityId,
            instruction=(
                "Assess diligence completeness for IC review. Use the analyst briefing "
                "and client mandate to weight what's missing.\n\n" + briefing_block
            ),
            context_chunks=ctx,
        )
    )
    if isinstance(out.structured, dict):
        return {
            "gaps": out.structured.get("gaps", []),
            "readinessScore": out.structured.get("ic_readiness_score", 5.0),
        }
    return {"gaps": [], "readinessScore": 5.0, "raw": out.content}


@app.post("/reports/generate")
async def reports_generate(body: ReportBody):
    set_scope(endpoint="reports.generate", opportunity_id=body.opportunityId)
    eng = _engine()
    async with eng.connect() as conn:
        opp = (
            await conn.execute(
                text(
                    """
                    SELECT name, sponsor, "propertyType", city, country, "askingEquity",
                           "totalCapitalization", "targetIrr", "targetMoic", "holdPeriodYears",
                           thesis, "executiveSummary", "bullCase", "baseCase", "bearCase",
                           recommendation, "opportunityScore", "riskScore", "confidenceScore",
                           "analysisVersion",
                           "aiVerdict", "aiVerdictRationale", "aiTopReasonsFor",
                           "aiTopReasonsAgainst", "aiNextSteps", "aiCriticalQuestions",
                           "aiWatchpoints", "aiMarketResearch", "financialAnalysis"
                    FROM "Opportunity" WHERE id = :id
                    """
                ),
                {"id": body.opportunityId},
            )
        ).first()
        risks = (
            await conn.execute(
                text(
                    """SELECT category, severity, title, description, mitigation
                       FROM "Risk" WHERE "opportunityId" = :id ORDER BY severity DESC"""
                ),
                {"id": body.opportunityId},
            )
        ).all()
        gaps = (
            await conn.execute(
                text(
                    """SELECT category, priority, title, description, rationale, recommendation
                       FROM "Gap" WHERE "opportunityId" = :id
                       ORDER BY
                         CASE priority
                           WHEN 'BLOCKER' THEN 0 WHEN 'HIGH' THEN 1
                           WHEN 'MEDIUM' THEN 2 ELSE 3 END,
                         "createdAt" ASC"""
                ),
                {"id": body.opportunityId},
            )
        ).all()
        ic_readiness = (
            await conn.execute(
                text('SELECT "icReadinessScore" FROM "Opportunity" WHERE id = :id'),
                {"id": body.opportunityId},
            )
        ).scalar()

    if not opp:
        raise HTTPException(404, "opportunity not found")

    payload = {
        "title": opp[0],
        "sponsor": opp[1] or "",
        "property_type": opp[2] or "",
        "city": opp[3] or "",
        "country": opp[4] or "",
        "asking_equity": f"${float(opp[5] or 0):,.0f}",
        "total_capitalization": f"${float(opp[6] or 0):,.0f}",
        "target_irr": f"{float(opp[7] or 0):.1f}",
        "target_moic": f"{float(opp[8] or 0):.2f}",
        "hold_period_years": opp[9] or 5,
        "thesis": opp[10] or "(thesis pending)",
        "executive_summary": opp[11] or "(executive summary pending)",
        "bull_case": (opp[12] or {}).get("points", []) if isinstance(opp[12], dict) else (opp[12] or []),
        "base_case": (opp[13] or {}).get("points", []) if isinstance(opp[13], dict) else (opp[13] or []),
        "bear_case": (opp[14] or {}).get("points", []) if isinstance(opp[14], dict) else (opp[14] or []),
        # Recommendation: prefer the human decision; fall back to the AI verdict.
        "recommendation": opp[15] or opp[20] or "NEED_MORE_INFO",
        "recommendation_rationale": opp[21] or "See detailed analysis.",
        "opportunity_score": f"{float(opp[16] or 0):.1f}",
        "risk_score": f"{float(opp[17] or 0):.1f}",
        "confidence_score": f"{float(opp[18] or 0):.1f}",
        "risks": [
            {"category": r[0], "severity": r[1], "title": r[2], "description": r[3], "mitigation": r[4]}
            for r in risks
        ],
        "gaps": [
            {
                "category": g[0],
                "priority": g[1],
                "title": g[2],
                "description": g[3],
                "rationale": g[4],
                "recommendation": g[5],
            }
            for g in gaps
        ],
        "ic_readiness_score": (
            f"{float(ic_readiness):.1f}" if ic_readiness is not None else None
        ),
        "market_analysis": opp[27] or "See market analyst output for details.",
        "generated_at": "",
        "analysis_version": int(opp[19] or 1),
        # Synthesis-driven fields
        "ai_verdict": opp[20] or "NEED_MORE_INFO",
        "ai_verdict_rationale": opp[21] or "",
        "ai_top_reasons_for": opp[22] or [],
        "ai_top_reasons_against": opp[23] or [],
        "ai_next_steps": opp[24] or [],
        "ai_critical_questions": opp[25] or [],
        "ai_watchpoints": opp[26] or [],
        # Financial-analyst structured output (rich underwriting view).
        # Shape: { verdict, verdict_rationale, analysis, headline_metrics,
        #          sensitivity, weak_assumption_callouts }
        "financial_analysis": opp[28] or {},
    }

    blob_root = get_settings().blob_storage_dir
    out_dir = os.path.join(blob_root, "reports", body.opportunityId)
    if body.type == "PRESENTATION_DECK":
        absolute_path = render_pptx(payload, out_dir)
        fmt = "pptx"
    else:
        absolute_path = render_pdf(payload, body.type, out_dir)
        fmt = "pdf"
    # Store a relative key so the API on the host can resolve it against
    # its own BLOB_STORAGE_DIR. Use forward slashes for portability.
    path = os.path.relpath(absolute_path, blob_root).replace(os.sep, "/")

    eng = _engine()
    async with eng.begin() as conn:
        rid = (
            await conn.execute(
                text(
                    """
                    INSERT INTO "Report" (id, "opportunityId", type, title, payload,
                        "storagePath", format, "createdAt")
                    VALUES (gen_random_uuid()::text, :oid, :type, :title, :payload, :p, :fmt, NOW())
                    RETURNING id
                    """
                ),
                {
                    "oid": body.opportunityId,
                    "type": body.type,
                    "title": opp[0],
                    "payload": json.dumps(payload, default=str),
                    "p": path,
                    "fmt": fmt,
                },
            )
        ).scalar_one()
    return {"reportId": rid, "storagePath": path}
