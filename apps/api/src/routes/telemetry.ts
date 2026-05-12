import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@stone-gate/db';

export const telemetryRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  /** Recent LLM calls with filters. */
  app.get('/calls', async (req) => {
    const q = req.query as {
      endpoint?: string;
      model?: string;
      opportunityId?: string;
      status?: string;
      limit?: string;
      cursor?: string;
    };
    const take = Math.min(Number(q.limit ?? 100), 500);
    const where: any = {};
    if (q.endpoint) where.endpoint = q.endpoint;
    if (q.model) where.model = q.model;
    if (q.opportunityId) where.opportunityId = q.opportunityId;
    if (q.status) where.status = q.status;

    const items = await prisma.llmCall.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    return items;
  });

  /** Aggregate summary: totals, breakdown by endpoint/model/agent, last 24h timeline.
   *  Filterable by client and/or opportunity. */
  app.get('/summary', async (req) => {
    const q = req.query as {
      days?: string;
      opportunityId?: string;
      clientId?: string;
    };
    const days = Math.min(Number(q.days ?? 30), 365);
    const since = new Date(Date.now() - days * 86_400_000);
    const baseWhere: any = { createdAt: { gte: since } };
    if (q.opportunityId) {
      baseWhere.opportunityId = q.opportunityId;
    } else if (q.clientId) {
      // Resolve opportunities belonging to this client and scope to them
      const opps = await prisma.opportunity.findMany({
        where: { clientId: q.clientId },
        select: { id: true },
      });
      baseWhere.opportunityId = { in: opps.map((o) => o.id) };
    }
    // Build the SQL scope string + params for the raw daily timeline
    let dailyExtraSql = '';
    const dailyParams: any[] = [since];
    if (q.opportunityId) {
      dailyExtraSql = `AND "opportunityId" = $${dailyParams.length + 1}`;
      dailyParams.push(q.opportunityId);
    } else if (q.clientId && baseWhere.opportunityId?.in?.length) {
      // Inline the opportunity ids — already vetted from Prisma above
      const ids: string[] = baseWhere.opportunityId.in;
      if (ids.length === 0) {
        dailyExtraSql = 'AND 1 = 0';
      } else {
        const placeholders = ids
          .map((_, i) => `$${dailyParams.length + i + 1}`)
          .join(',');
        dailyExtraSql = `AND "opportunityId" IN (${placeholders})`;
        dailyParams.push(...ids);
      }
    }

    const [agg, byEndpoint, byModel, byAgent, byStatus, recent] = await Promise.all([
      prisma.llmCall.aggregate({
        where: baseWhere,
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
        _avg: { latencyMs: true, costUsd: true },
      }),
      prisma.llmCall.groupBy({
        by: ['endpoint'],
        where: baseWhere,
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
        _avg: { latencyMs: true },
        orderBy: { _sum: { costUsd: 'desc' } },
      }),
      prisma.llmCall.groupBy({
        by: ['model'],
        where: baseWhere,
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
        orderBy: { _sum: { costUsd: 'desc' } },
      }),
      prisma.llmCall.groupBy({
        by: ['agent'],
        where: baseWhere,
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
        _avg: { latencyMs: true },
        orderBy: { _sum: { costUsd: 'desc' } },
      }),
      prisma.llmCall.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
      prisma.llmCall.findMany({
        where: baseWhere,
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    // Daily cost timeline (raw SQL for date_trunc) — filter applied by params
    const dailyRaw = await prisma.$queryRawUnsafe<
      { day: Date; calls: bigint; cost: number }[]
    >(
      `SELECT date_trunc('day', "createdAt") AS day,
              count(*)::bigint               AS calls,
              coalesce(sum("costUsd"), 0)    AS cost
         FROM "LlmCall"
        WHERE "createdAt" >= $1::timestamptz
          ${dailyExtraSql}
        GROUP BY 1
        ORDER BY 1`,
      ...dailyParams,
    );
    const daily = dailyRaw.map((d) => ({
      day: d.day instanceof Date ? d.day.toISOString().slice(0, 10) : String(d.day).slice(0, 10),
      calls: Number(d.calls),
      cost: Number(d.cost),
    }));

    return {
      since: since.toISOString(),
      totals: {
        calls: agg._count._all,
        inputTokens: agg._sum.inputTokens ?? 0,
        outputTokens: agg._sum.outputTokens ?? 0,
        costUsd: Number(agg._sum.costUsd ?? 0),
        avgLatencyMs: Number(agg._avg.latencyMs ?? 0),
        avgCostUsd: Number(agg._avg.costUsd ?? 0),
      },
      byEndpoint,
      byModel,
      byAgent,
      byStatus,
      recent,
      daily,
    };
  });
};
