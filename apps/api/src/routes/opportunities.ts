import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@stone-gate/db';
import * as ai from '../services/ai-client.js';
import { computeWorkflowStage } from '../lib/workflow.js';

const StageEnum = z.enum([
  'NEW',
  'INITIAL_SCREENING',
  'UNDER_REVIEW',
  'DUE_DILIGENCE',
  'IC_PREPARATION',
  'APPROVED',
  'REJECTED',
  'CLOSED',
]);

const CreateSchema = z.object({
  clientId: z.string().min(1, 'A client is required'),
  name: z.string().min(1),
  sponsor: z.string().optional(),
  propertyType: z.string().optional(),
  subType: z.string().optional(),
  geography: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  size: z.string().optional(),
  units: z.number().int().optional(),
  unitMix: z.string().optional(),
  vintageYear: z.number().int().optional(),
  askingEquity: z.number().optional(),
  totalCapitalization: z.number().optional(),
  targetIrr: z.number().optional(),
  targetMoic: z.number().optional(),
  holdPeriodYears: z.number().int().optional(),
  stage: StageEnum.default('NEW'),
  briefingNotes: z.string().optional(),
});

export const opportunityRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async (req) => {
    const q = req.query as { stage?: string; clientId?: string; q?: string };
    const where: any = {};
    if (q.stage) where.stage = q.stage;
    if (q.clientId) where.clientId = q.clientId;
    if (q.q) {
      where.OR = [
        { name: { contains: q.q, mode: 'insensitive' } },
        { sponsor: { contains: q.q, mode: 'insensitive' } },
        { city: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    const rows = await prisma.opportunity.findMany({
      where,
      select: {
        id: true,
        name: true,
        sponsor: true,
        propertyType: true,
        city: true,
        country: true,
        stage: true,
        recommendation: true,
        riskScore: true,
        icReadinessScore: true,
        briefingNotes: true,
        thesis: true,
        updatedAt: true,
        client: { select: { id: true, name: true } },
        decision: { select: { id: true } },
        documents: { select: { status: true } },
        _count: {
          select: {
            risks: true,
            gaps: true,
            threads: true,
            scenarios: true,
            reports: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    // Decorate each row with the computed workflow stage
    return rows.map((r) => ({
      ...r,
      workflowStage: computeWorkflowStage(r as any),
    }));
  });

  app.get('/:id', async (req, reply) => {
    const id = (req.params as any).id as string;
    const opp = await prisma.opportunity.findUnique({
      where: { id },
      include: {
        client: true,
        documents: { orderBy: { createdAt: 'desc' } },
        metrics: true,
        assumptions: true,
        risks: { orderBy: { severity: 'desc' } },
        gaps: { orderBy: { priority: 'desc' } },
        scenarios: { include: { runs: true } },
        threads: { include: { _count: { select: { messages: true } } } },
        reports: true,
        decision: true,
      },
    });
    if (!opp) return reply.code(404).send({ error: 'Not found' });
    return opp;
  });

  app.post('/', async (req, reply) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const created = await prisma.opportunity.create({ data: parsed.data });
    await req.audit({
      action: 'opportunity.create',
      entityType: 'Opportunity',
      entityId: created.id,
    });
    return created;
  });

  app.patch('/:id', async (req, reply) => {
    const id = (req.params as any).id as string;
    const parsed = CreateSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = await prisma.opportunity.update({ where: { id }, data: parsed.data });
    await req.audit({
      action: 'opportunity.update',
      entityType: 'Opportunity',
      entityId: id,
    });
    return updated;
  });

  app.get('/:id/events', async (req) => {
    const id = (req.params as any).id as string;
    return prisma.opportunityMemory.findMany({
      where: {
        opportunityId: id,
        kind: { in: ['update_event', 'reset_event', 'stage_rollback'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, kind: true, content: true, createdAt: true },
    });
  });

  app.put('/:id/briefing', async (req, reply) => {
    const id = (req.params as any).id as string;
    const body = z
      .object({ briefingNotes: z.string().nullable().optional() })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const updated = await prisma.opportunity.update({
      where: { id },
      data: { briefingNotes: body.data.briefingNotes ?? null },
      select: { id: true, briefingNotes: true },
    });
    await req.audit({
      action: 'opportunity.briefing_update',
      entityType: 'Opportunity',
      entityId: id,
      metadata: { length: body.data.briefingNotes?.length ?? 0 },
    });
    return updated;
  });

  // Order used to detect "rollback" (going backwards in the lifecycle)
  const STAGE_ORDER: Record<string, number> = {
    NEW: 0,
    INITIAL_SCREENING: 1,
    UNDER_REVIEW: 2,
    DUE_DILIGENCE: 3,
    IC_PREPARATION: 4,
    APPROVED: 5,
    REJECTED: 5,
    CLOSED: 6,
  };

  app.post('/:id/stage', async (req, reply) => {
    const id = (req.params as any).id as string;
    const body = z
      .object({ stage: StageEnum, reason: z.string().optional() })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const current = await prisma.opportunity.findUnique({
      where: { id },
      select: { stage: true },
    });
    if (!current) return reply.code(404).send({ error: 'Not found' });

    const isRollback =
      STAGE_ORDER[body.data.stage] < STAGE_ORDER[current.stage];

    if (isRollback && !body.data.reason) {
      return reply
        .code(400)
        .send({ error: 'Reason is required when rolling back to an earlier stage' });
    }

    const updated = await prisma.opportunity.update({
      where: { id },
      data: { stage: body.data.stage },
    });

    if (isRollback) {
      await prisma.opportunityMemory.create({
        data: {
          opportunityId: id,
          kind: 'stage_rollback',
          content: `Stage rolled back from ${current.stage} → ${body.data.stage}. Reason: ${body.data.reason}`,
        },
      });
    }
    await req.audit({
      action: isRollback ? 'opportunity.stage_rollback' : 'opportunity.stage_change',
      entityType: 'Opportunity',
      entityId: id,
      metadata: { from: current.stage, to: body.data.stage, reason: body.data.reason },
    });
    return updated;
  });

  // ─── Restart-process actions ───────────────────────────────────────

  app.post('/:id/rerun', async (req, reply) => {
    const id = (req.params as any).id as string;
    const body = z
      .object({ reason: z.string().min(3, 'Reason required') })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const opp = await prisma.opportunity.update({
      where: { id },
      data: { analysisVersion: { increment: 1 } },
      select: { analysisVersion: true },
    });
    await prisma.opportunityMemory.create({
      data: {
        opportunityId: id,
        kind: 'update_event',
        content: `[Re-run · v${opp.analysisVersion}] ${body.data.reason}`,
      },
    });
    await req.audit({
      action: 'opportunity.rerun',
      entityType: 'Opportunity',
      entityId: id,
      metadata: { reason: body.data.reason, version: opp.analysisVersion },
    });
    return { ok: true, analysisVersion: opp.analysisVersion };
  });

  app.post('/:id/reset', async (req, reply) => {
    const id = (req.params as any).id as string;
    const body = z
      .object({
        reason: z.string().min(3, 'Reason required'),
        rollbackToStage: StageEnum.optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const current = await prisma.opportunity.findUnique({
      where: { id },
      select: {
        stage: true,
        analysisVersion: true,
        thesis: true,
        executiveSummary: true,
        swot: true,
        bullCase: true,
        baseCase: true,
        bearCase: true,
        opportunityScore: true,
        riskScore: true,
        confidenceScore: true,
        icReadinessScore: true,
        recommendation: true,
      },
    });
    if (!current) return reply.code(404).send({ error: 'Not found' });

    const newStage = body.data.rollbackToStage ?? 'UNDER_REVIEW';

    // Snapshot prior state into memory metadata so we have provenance
    await prisma.opportunityMemory.create({
      data: {
        opportunityId: id,
        kind: 'reset_event',
        content:
          `[Reset · v${current.analysisVersion} → v${current.analysisVersion + 1}] ` +
          `Stage ${current.stage} → ${newStage}. Reason: ${body.data.reason}`,
      },
    });

    // Clear AI outputs, archive risks/gaps by deleting (provenance kept in audit + memory)
    await prisma.$transaction([
      prisma.risk.deleteMany({ where: { opportunityId: id } }),
      prisma.gap.deleteMany({ where: { opportunityId: id } }),
      prisma.opportunity.update({
        where: { id },
        data: {
          analysisVersion: { increment: 1 },
          stage: newStage,
          thesis: null,
          executiveSummary: null,
          swot: undefined as any,
          bullCase: undefined as any,
          baseCase: undefined as any,
          bearCase: undefined as any,
          opportunityScore: null,
          riskScore: null,
          confidenceScore: null,
          icReadinessScore: null,
          recommendation: null,
        },
      }),
    ]);

    await req.audit({
      action: 'opportunity.reset',
      entityType: 'Opportunity',
      entityId: id,
      metadata: {
        reason: body.data.reason,
        prior: current,
        rollbackToStage: newStage,
      },
    });
    return { ok: true, analysisVersion: current.analysisVersion + 1, stage: newStage };
  });

  app.post('/:id/analyze', async (req, _reply) => {
    const id = (req.params as any).id as string;
    const job = await ai.analyzeOpportunity(id);
    await req.audit({
      action: 'opportunity.analyze',
      entityType: 'Opportunity',
      entityId: id,
      metadata: job,
    });
    return job;
  });

  app.post('/:id/analyze/financial-only', async (req, _reply) => {
    const id = (req.params as any).id as string;
    const job = await ai.analyzeOpportunityFinancialOnly(id);
    await req.audit({
      action: 'opportunity.analyze.financial_only',
      entityType: 'Opportunity',
      entityId: id,
      metadata: job,
    });
    return job;
  });

  app.post('/:id/gaps', async (req) => {
    const id = (req.params as any).id as string;
    const result = await ai.gapAnalysis(id);
    return result;
  });

  app.post('/:id/decision', async (req, reply) => {
    const id = (req.params as any).id as string;
    const body = z
      .object({
        decision: z.enum(['PROCEED', 'PROCEED_WITH_CONDITIONS', 'REJECT', 'NEED_MORE_INFO']),
        rationale: z.string().min(1),
        conditions: z.string().optional(),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const decision = await prisma.investmentDecision.upsert({
      where: { opportunityId: id },
      update: { ...body.data, decidedById: req.user!.sub },
      create: { opportunityId: id, ...body.data, decidedById: req.user!.sub },
    });
    await prisma.opportunity.update({
      where: { id },
      data: {
        recommendation: body.data.decision,
        stage: body.data.decision === 'REJECT' ? 'REJECTED' : 'APPROVED',
      },
    });
    await req.audit({
      action: 'opportunity.decision',
      entityType: 'Opportunity',
      entityId: id,
      metadata: body.data,
    });
    return decision;
  });
};
