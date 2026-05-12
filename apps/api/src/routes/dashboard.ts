import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@stone-gate/db';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/summary', async () => {
    const [pipeline, recent, gaps, alerts, byStage, exposure] = await Promise.all([
      prisma.opportunity.groupBy({
        by: ['stage'],
        _count: { _all: true },
      }),
      prisma.opportunity.findMany({
        take: 8,
        orderBy: { updatedAt: 'desc' },
        include: { client: { select: { name: true } } },
      }),
      prisma.gap.groupBy({
        by: ['priority'],
        _count: { _all: true },
        where: { resolvedAt: null },
      }),
      prisma.opportunity.findMany({
        where: { riskScore: { gte: 7 } },
        take: 5,
        select: { id: true, name: true, riskScore: true, stage: true },
      }),
      prisma.opportunity.count(),
      prisma.portfolioPosition.groupBy({
        by: ['propertyType'],
        _sum: { equityInvested: true },
      }),
    ]);

    return {
      pipelineByStage: pipeline,
      recent,
      openGapsByPriority: gaps,
      highRiskAlerts: alerts,
      totalOpportunities: byStage,
      portfolioExposureByType: exposure,
    };
  });

  app.get('/risk-heatmap', async (req) => {
    const q = req.query as { clientId?: string };
    const where: any = {};
    if (q.clientId) {
      where.opportunity = { clientId: q.clientId };
    }
    return prisma.risk.groupBy({
      by: ['category', 'severity'],
      where,
      _count: { _all: true },
    });
  });
};
