import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@stone-gate/db';
import * as ai from '../services/ai-client.js';

const RunSchema = z.object({
  opportunityId: z.string(),
  scenarioId: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  inputs: z.record(z.union([z.number(), z.boolean()])),
});

export const scenarioRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/opportunity/:id', async (req) => {
    const id = (req.params as any).id as string;
    return prisma.scenario.findMany({
      where: { opportunityId: id },
      include: { runs: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.post('/run', async (req, reply) => {
    const parsed = RunSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    let scenarioId = parsed.data.scenarioId;
    if (!scenarioId) {
      const sc = await prisma.scenario.create({
        data: {
          opportunityId: parsed.data.opportunityId,
          name: parsed.data.name ?? 'Untitled scenario',
          description: parsed.data.description,
          inputs: parsed.data.inputs as any,
        },
      });
      scenarioId = sc.id;
    }

    const result = await ai.runScenario({
      opportunityId: parsed.data.opportunityId,
      scenarioId,
      inputs: parsed.data.inputs,
    });

    const run = await prisma.scenarioRun.create({
      data: {
        scenarioId,
        outputs: result.outputs,
        cashflow: result.cashflow ?? undefined,
      },
    });

    await req.audit({
      action: 'scenario.run',
      entityType: 'Scenario',
      entityId: scenarioId,
      metadata: { inputs: parsed.data.inputs },
    });

    return { scenarioId, run };
  });
};
