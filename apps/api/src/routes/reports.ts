import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { prisma } from '@stone-gate/db';
import * as ai from '../services/ai-client.js';

const GenerateSchema = z.object({
  opportunityId: z.string(),
  type: z.enum(['IC_MEMO_LONG', 'EXECUTIVE_SUMMARY', 'PRESENTATION_DECK']),
});

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/opportunity/:id', async (req) => {
    const id = (req.params as any).id as string;
    return prisma.report.findMany({
      where: { opportunityId: id },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.post('/generate', async (req, reply) => {
    const parsed = GenerateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await ai.generateReport(parsed.data);
    await req.audit({
      action: 'report.generate',
      entityType: 'Report',
      entityId: result.reportId,
      metadata: parsed.data,
    });
    return result;
  });

  app.get('/:id/download', async (req, reply) => {
    const id = (req.params as any).id as string;
    const report = await prisma.report.findUnique({ where: { id } });
    if (!report || !report.storagePath) return reply.code(404).send({ error: 'Not found' });

    // Resolve the report's storagePath against this service's BLOB_STORAGE_DIR.
    // The path stored by the ai-service is a relative key (e.g.
    // "reports/{oppId}/{uuid}.pdf"); legacy rows may have absolute container
    // paths — both are honoured here.
    const root = process.env.BLOB_STORAGE_DIR ?? './data/blobs';
    let absolute = isAbsolute(report.storagePath)
      ? report.storagePath
      : join(root, report.storagePath);

    // Legacy fallback: an absolute /app/data/blobs/... path from before the
    // path-translation fix. Translate to the host root.
    if (!existsSync(absolute) && report.storagePath.startsWith('/app/data/blobs/')) {
      absolute = join(root, report.storagePath.replace('/app/data/blobs/', ''));
    }

    if (!existsSync(absolute)) {
      req.log.error({ storagePath: report.storagePath, absolute }, 'report file missing on disk');
      return reply.code(404).send({ error: 'Report file not found on disk' });
    }

    const ext = report.format;
    const mime =
      ext === 'pdf'
        ? 'application/pdf'
        : ext === 'pptx'
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : 'application/octet-stream';
    // Suffix the filename with the report type so reviewers can tell which
    // artifact is which when multiple are downloaded for the same deal.
    const typeSuffix: Record<string, string> = {
      IC_MEMO_LONG: 'IC Memorandum',
      EXECUTIVE_SUMMARY: 'Executive Summary',
      PRESENTATION_DECK: 'IC Presentation',
    };
    const suffix = typeSuffix[report.type] ?? report.type;
    const filename = `${report.title} - ${suffix}.${ext}`;
    // Read the whole file as a buffer. createReadStream + reply.send() had
    // Fastify emitting content-length: 0 (the stream wasn't being recognized
    // as a Node Readable on Windows). Reports are <1 MB so a buffer is fine.
    const buffer = readFileSync(absolute);
    reply
      .header('content-type', mime)
      .header('content-disposition', `attachment; filename="${filename}"`)
      .header('content-length', String(buffer.length))
      .send(buffer);
  });
};
