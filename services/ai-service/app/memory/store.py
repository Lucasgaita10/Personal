"""Per-opportunity conversational memory."""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings


def _engine():
    url = get_settings().database_url.replace("postgresql://", "postgresql+psycopg://")
    return create_async_engine(url, pool_pre_ping=True)


class MemoryStore:
    def __init__(self) -> None:
        self.engine = _engine()

    async def load(self, opportunity_id: str, thread_id: str | None) -> str:
        async with self.engine.connect() as conn:
            briefing_row = (
                await conn.execute(
                    text(
                        """
                        SELECT o."briefingNotes",
                               o."analysisVersion",
                               o.name AS opp_name,
                               o.sponsor,
                               o."propertyType",
                               o.city,
                               o.country,
                               o.size,
                               o.units,
                               o."unitMix",
                               o."vintageYear",
                               o."targetIrr",
                               o."targetMoic",
                               o."holdPeriodYears",
                               c.name AS client_name,
                               c."mandateSummary" AS client_mandate,
                               c."internalNotes" AS client_internal_notes,
                               c."riskAppetite" AS client_risk_appetite,
                               c."geographyPrefs" AS client_geo_prefs,
                               c."sectorPrefs" AS client_sector_prefs,
                               c."leverageMaxLtv" AS client_max_ltv
                        FROM "Opportunity" o
                        LEFT JOIN "Client" c ON c.id = o."clientId"
                        WHERE o.id = :oid
                        """
                    ),
                    {"oid": opportunity_id},
                )
            ).first()
            # Restart events (update_event, reset_event, stage_rollback) — surfaced prominently
            restart_rows = (
                await conn.execute(
                    text(
                        """
                        SELECT kind, content, "createdAt"
                        FROM "OpportunityMemory"
                        WHERE "opportunityId" = :oid
                          AND kind IN ('update_event', 'reset_event', 'stage_rollback')
                        ORDER BY "createdAt" DESC
                        LIMIT 10
                        """
                    ),
                    {"oid": opportunity_id},
                )
            ).all()
            mems = (
                await conn.execute(
                    text(
                        """
                        SELECT kind, content
                        FROM "OpportunityMemory"
                        WHERE "opportunityId" = :oid
                        ORDER BY "createdAt" DESC
                        LIMIT 25
                        """
                    ),
                    {"oid": opportunity_id},
                )
            ).all()
            recent_msgs = []
            if thread_id:
                recent_msgs = (
                    await conn.execute(
                        text(
                            """
                            SELECT role, content
                            FROM "ChatMessage"
                            WHERE "threadId" = :tid
                            ORDER BY "createdAt" DESC
                            LIMIT 12
                            """
                        ),
                        {"tid": thread_id},
                    )
                ).all()

        blocks: list[str] = []

        # 1. Recent restart/update events at the very top — these are the highest-priority
        #    pieces of context the AI must reflect in its current output.
        if restart_rows:
            blocks.append("### Recent update events — analysis MUST reflect these")
            for r in restart_rows:
                ts = r.createdAt.isoformat() if hasattr(r.createdAt, "isoformat") else str(r.createdAt)
                blocks.append(f"- [{ts}] ({r.kind}) {r.content}")

        if briefing_row:
            facts = []
            if briefing_row.opp_name:
                facts.append(f"Opportunity: {briefing_row.opp_name}")
            if briefing_row.analysisVersion and briefing_row.analysisVersion > 1:
                facts.append(f"Analysis version: v{briefing_row.analysisVersion}")
            if briefing_row.sponsor:
                facts.append(f"Sponsor: {briefing_row.sponsor}")
            loc = ", ".join(x for x in [briefing_row.city, briefing_row.country] if x)
            if loc:
                facts.append(f"Location: {loc}")
            if briefing_row.propertyType:
                facts.append(f"Property type: {briefing_row.propertyType}")
            if briefing_row.size:
                facts.append(f"Size: {briefing_row.size}")
            if briefing_row.units is not None:
                facts.append(f"Units: {briefing_row.units}")
            if briefing_row.unitMix:
                facts.append(f"Unit mix: {briefing_row.unitMix}")
            if briefing_row.vintageYear is not None:
                facts.append(f"Vintage: {briefing_row.vintageYear}")
            if briefing_row.targetIrr is not None:
                facts.append(f"Target IRR: {briefing_row.targetIrr}%")
            if briefing_row.targetMoic is not None:
                facts.append(f"Target MOIC: {briefing_row.targetMoic}x")
            if briefing_row.holdPeriodYears is not None:
                facts.append(f"Hold: {briefing_row.holdPeriodYears}y")
            if facts:
                blocks.append("### Opportunity facts")
                blocks.extend(f"- {f}" for f in facts)

            client_lines = []
            if briefing_row.client_name:
                client_lines.append(f"Client: {briefing_row.client_name}")
            if briefing_row.client_mandate:
                client_lines.append(f"Mandate: {briefing_row.client_mandate}")
            if briefing_row.client_risk_appetite:
                client_lines.append(f"Risk appetite: {briefing_row.client_risk_appetite}")
            if briefing_row.client_max_ltv is not None:
                client_lines.append(f"Max LTV: {briefing_row.client_max_ltv}")
            if briefing_row.client_geo_prefs:
                client_lines.append(
                    f"Geography prefs: {', '.join(briefing_row.client_geo_prefs)}"
                )
            if briefing_row.client_sector_prefs:
                client_lines.append(
                    f"Sector prefs: {', '.join(briefing_row.client_sector_prefs)}"
                )
            if client_lines:
                blocks.append("### Client context")
                blocks.extend(f"- {x}" for x in client_lines)

            if briefing_row.client_internal_notes:
                blocks.append("### Client briefing (analyst-written, durable)")
                blocks.append(briefing_row.client_internal_notes.strip())

            if briefing_row.briefingNotes:
                blocks.append("### Opportunity briefing — MUST be considered in analysis")
                blocks.append(briefing_row.briefingNotes.strip())

        if mems:
            blocks.append("### Pinned & summarized memory")
            for m in mems:
                blocks.append(f"- ({m.kind}) {m.content}")
        if recent_msgs:
            blocks.append("### Recent conversation")
            for m in reversed(recent_msgs):
                blocks.append(f"{m.role}: {m.content[:600]}")
        return "\n".join(blocks)

    async def save_summary(self, opportunity_id: str, summary: str) -> None:
        async with self.engine.begin() as conn:
            await conn.execute(
                text(
                    """
                    INSERT INTO "OpportunityMemory" (id, "opportunityId", kind, content, "createdAt")
                    VALUES (gen_random_uuid()::text, :oid, 'summary', :c, NOW())
                    """
                ),
                {"oid": opportunity_id, "c": summary},
            )
