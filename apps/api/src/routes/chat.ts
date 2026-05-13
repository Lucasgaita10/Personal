import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@stone-gate/db';
import * as ai from '../services/ai-client.js';

const ChatSchema = z.object({
  threadId: z.string().optional(),
  opportunityId: z.string(),
  message: z.string().min(1),
  topK: z.number().int().min(1).max(50).optional(),
  agent: z.string().optional(),
});

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.get('/threads/:opportunityId', async (req) => {
    const id = (req.params as any).opportunityId as string;
    return prisma.chatThread.findMany({
      where: { opportunityId: id },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  });

  app.get('/thread/:threadId', async (req, reply) => {
    const id = (req.params as any).threadId as string;
    const thread = await prisma.chatThread.findUnique({
      where: { id },
      include: {
        messages: {
          include: { citations: { include: { document: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!thread) return reply.code(404).send({ error: 'Not found' });
    return thread;
  });

  app.post('/send', async (req, reply) => {
    const parsed = ChatSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    // Persist user message ahead of the AI call so it's visible immediately.
    // If the client sent a threadId, verify it still exists — clients can hold
    // a stale id in localStorage after data has been deleted/reset. When that
    // happens, silently fall back to creating a new thread instead of 500-ing
    // on a foreign key violation at ChatMessage.create.
    let threadId = parsed.data.threadId;
    if (threadId) {
      const existing = await prisma.chatThread.findUnique({ where: { id: threadId } });
      if (!existing) threadId = undefined;
    }
    if (!threadId) {
      const t = await prisma.chatThread.create({
        data: {
          opportunityId: parsed.data.opportunityId,
          title: parsed.data.message.slice(0, 80),
        },
      });
      threadId = t.id;
    }
    await prisma.chatMessage.create({
      data: { threadId, role: 'USER', content: parsed.data.message },
    });

    const result = await ai.chat({ ...parsed.data, threadId });
    return { ...result, threadId };
  });

  // Server-Sent Events streaming. Pipes upstream FastAPI stream to client.
  app.post('/stream', async (req, reply) => {
    const parsed = ChatSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const upstream = await ai.streamChat(parsed.data);
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });

    upstream.body.on('data', (chunk: Buffer) => reply.raw.write(chunk));
    upstream.body.on('end', () => reply.raw.end());
    upstream.body.on('error', () => reply.raw.end());
  });

  app.post('/thread/:threadId/pin', async (req) => {
    const id = (req.params as any).threadId as string;
    return prisma.chatThread.update({
      where: { id },
      data: { pinned: true },
    });
  });
};
