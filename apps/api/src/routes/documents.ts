import type { FastifyPluginAsync } from 'fastify';
import { unlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { prisma } from '@stone-gate/db';
import { storeBlob, readBlob } from '../lib/blob-store.js';
import { ingestDocument, classifyDocument } from '../services/doc-client.js';

export const documentRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  // Multipart upload — one or more files for an opportunity.
  app.post('/upload/:opportunityId', async (req, reply) => {
    const opportunityId = (req.params as any).opportunityId as string;
    const opp = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true },
    });
    if (!opp) return reply.code(404).send({ error: 'Opportunity not found' });

    const created: any[] = [];
    for await (const part of req.parts()) {
      if (part.type !== 'file') continue;
      const buf = await part.toBuffer();
      const stored = await storeBlob(opportunityId, buf);

      const doc = await prisma.document.create({
        data: {
          opportunityId,
          filename: part.filename,
          mimeType: part.mimetype,
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
          storagePath: stored.storagePath,
          uploadedById: req.user!.sub,
          status: 'PENDING',
        },
      });

      // Fire-and-forget ingestion job to the doc-processor.
      ingestDocument({
        documentId: doc.id,
        opportunityId,
        storagePath: stored.storagePath,
        mimeType: doc.mimeType,
        filename: doc.filename,
      }).catch((err) => req.log.error({ err, documentId: doc.id }, 'ingest failed'));

      await req.audit({
        action: 'document.upload',
        entityType: 'Document',
        entityId: doc.id,
        metadata: { filename: doc.filename, sizeBytes: doc.sizeBytes },
      });
      created.push(doc);
    }
    return { documents: created };
  });

  // Manual class override for a single document.
  app.patch('/:id', async (req, reply) => {
    const id = (req.params as any).id as string;
    const body = req.body as {
      documentClass?: string;
      smartTags?: string[];
    };
    const allowed = [
      'INVESTMENT_MEMO',
      'PITCH_DECK',
      'FINANCIAL_STATEMENT',
      'RENT_ROLL',
      'LEGAL_AGREEMENT',
      'DUE_DILIGENCE_REPORT',
      'MARKET_STUDY',
      'APPRAISAL',
      'CONSTRUCTION_BUDGET',
      'LOAN_AGREEMENT',
      'PHOTO',
      'EMAIL',
      'OTHER',
    ];
    const data: any = {};
    if (body.documentClass) {
      if (!allowed.includes(body.documentClass)) {
        return reply.code(400).send({ error: 'Invalid documentClass' });
      }
      data.documentClass = body.documentClass;
      // Manual overrides are authoritative — confidence 1.0.
      data.classConfidence = 1.0;
    }
    if (body.smartTags) data.smartTags = body.smartTags;

    const updated = await prisma.document.update({
      where: { id },
      data,
      select: {
        id: true,
        documentClass: true,
        classConfidence: true,
        smartTags: true,
      },
    });
    await req.audit({
      action: 'document.class_override',
      entityType: 'Document',
      entityId: id,
      metadata: data,
    });
    return updated;
  });

  app.get('/:id', async (req, reply) => {
    const id = (req.params as any).id as string;
    const doc = await prisma.document.findUnique({
      where: { id },
      include: { chunks: { take: 200, orderBy: { ordinal: 'asc' } } },
    });
    if (!doc) return reply.code(404).send({ error: 'Not found' });
    return doc;
  });

  // Retry ingestion for FAILED / PENDING documents.
  app.post('/retry/:opportunityId', async (req, reply) => {
    const opportunityId = (req.params as any).opportunityId as string;
    const docs = await prisma.document.findMany({
      where: {
        opportunityId,
        status: { in: ['FAILED', 'PENDING'] },
      },
      select: {
        id: true,
        filename: true,
        storagePath: true,
        mimeType: true,
      },
    });
    if (docs.length === 0) return { total: 0, started: 0 };

    await prisma.document.updateMany({
      where: { id: { in: docs.map((d) => d.id) } },
      data: { status: 'PROCESSING', failureReason: null },
    });

    let started = 0;
    for (const d of docs) {
      try {
        await ingestDocument({
          documentId: d.id,
          opportunityId,
          storagePath: d.storagePath,
          mimeType: d.mimeType,
          filename: d.filename,
        });
        started++;
      } catch (err: any) {
        req.log.error({ err, documentId: d.id }, 'retry ingest failed');
        await prisma.document.update({
          where: { id: d.id },
          data: { status: 'FAILED', failureReason: String(err?.message ?? err).slice(0, 1000) },
        });
      }
    }

    await req.audit({
      action: 'document.retry_batch',
      entityType: 'Opportunity',
      entityId: opportunityId,
      metadata: { total: docs.length, started },
    });
    return { total: docs.length, started };
  });

  // Re-run AI classification for every document in an opportunity.
  // Returns a per-document result so the UI can show what changed.
  app.post('/classify/:opportunityId', async (req, reply) => {
    const opportunityId = (req.params as any).opportunityId as string;
    const docs = await prisma.document.findMany({
      where: { opportunityId },
      select: {
        id: true,
        filename: true,
        storagePath: true,
        mimeType: true,
        documentClass: true,
      },
    });
    if (docs.length === 0) return { total: 0, results: [] };

    const results = await Promise.all(
      docs.map(async (d) => {
        try {
          const out = await classifyDocument({
            documentId: d.id,
            storagePath: d.storagePath,
            mimeType: d.mimeType,
            filename: d.filename,
          });
          return {
            id: d.id,
            filename: d.filename,
            ok: true as const,
            previous: d.documentClass,
            documentClass: out.documentClass,
            confidence: out.confidence,
            smartTags: out.smartTags,
          };
        } catch (err: any) {
          return {
            id: d.id,
            filename: d.filename,
            ok: false as const,
            error: err.message ?? 'classification failed',
          };
        }
      }),
    );

    await req.audit({
      action: 'document.classify_batch',
      entityType: 'Opportunity',
      entityId: opportunityId,
      metadata: {
        total: docs.length,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      },
    });

    return { total: docs.length, results };
  });

  app.get('/:id/download', async (req, reply) => {
    const id = (req.params as any).id as string;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return reply.code(404).send({ error: 'Not found' });
    const buf = await readBlob(doc.storagePath);
    reply
      .header('content-type', doc.mimeType)
      .header('content-disposition', `inline; filename="${doc.filename}"`)
      .send(buf);
  });

  app.delete('/:id', async (req, reply) => {
    const id = (req.params as any).id as string;
    const doc = await prisma.document.findUnique({
      where: { id },
      select: { id: true, storagePath: true, filename: true, opportunityId: true },
    });
    if (!doc) return reply.code(404).send({ error: 'Not found' });

    // Cascade-deletes DocumentChunk via Prisma onDelete; Citation rows have
    // their FKs set to NULL.
    await prisma.document.delete({ where: { id } });

    // Remove the encrypted blob from disk (best-effort).
    try {
      const root = process.env.BLOB_STORAGE_DIR ?? './data/blobs';
      const absolute = isAbsolute(doc.storagePath)
        ? doc.storagePath
        : join(root, doc.storagePath);
      await unlink(absolute);
    } catch (err) {
      req.log.warn({ err, storagePath: doc.storagePath }, 'blob unlink failed');
    }

    await req.audit({
      action: 'document.delete',
      entityType: 'Document',
      entityId: id,
      metadata: { filename: doc.filename, opportunityId: doc.opportunityId },
    });
    return { ok: true };
  });
};
