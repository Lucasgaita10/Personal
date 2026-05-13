import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@stone-gate/db';

const ClientCreateSchema = z.object({
  name: z.string().min(1),
  type: z.string(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  riskAppetite: z.enum(['CORE', 'CORE_PLUS', 'VALUE_ADD', 'OPPORTUNISTIC']).default('CORE_PLUS'),
  timeHorizonYears: z.number().int().optional(),
  liquidityNeedsNote: z.string().optional(),
  geographyPrefs: z.array(z.string()).default([]),
  sectorPrefs: z.array(z.string()).default([]),
  esgPrefs: z.record(z.unknown()).optional(),
  taxConsiderations: z.string().optional(),
  leverageMaxLtv: z.number().optional(),
  internalNotes: z.string().optional(),
});

export const clientRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/', async () => {
    return prisma.client.findMany({
      include: {
        _count: { select: { opportunities: true, positions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  });

  app.get('/:id', async (req, reply) => {
    const id = (req.params as any).id as string;
    const client = await prisma.client.findUnique({
      where: { id },
      include: { positions: true, opportunities: true, decisions: true },
    });
    if (!client) return reply.code(404).send({ error: 'Not found' });
    return client;
  });

  app.post('/', async (req, reply) => {
    const parsed = ClientCreateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    // Cast to bypass Prisma's strict JSON typing for esgPrefs (Record<string,unknown>
    // vs InputJsonValue mismatch); JSON columns accept arbitrary JSON at runtime.
    const created = await prisma.client.create({ data: parsed.data as any });
    await req.audit({ action: 'client.create', entityType: 'Client', entityId: created.id });
    return created;
  });

  app.patch('/:id', async (req, reply) => {
    const id = (req.params as any).id as string;
    const parsed = ClientCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const updated = await prisma.client.update({ where: { id }, data: parsed.data as any });
    await req.audit({ action: 'client.update', entityType: 'Client', entityId: id });
    return updated;
  });

  app.post('/:id/mandate-summary', async (req, reply) => {
    const id = (req.params as any).id as string;
    // Would call AI service to generate; here we pass through the body for now.
    const body = req.body as { mandateSummary?: string };
    const updated = await prisma.client.update({
      where: { id },
      data: { mandateSummary: body.mandateSummary ?? null },
    });
    await req.audit({ action: 'client.mandate', entityType: 'Client', entityId: id });
    return updated;
  });
};
