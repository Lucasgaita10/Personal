import fp from 'fastify-plugin';
import { prisma } from '@stone-gate/db';

export const auditPlugin = fp(async (app) => {
  app.decorateRequest('audit', async function (
    this: any,
    payload: { action: string; entityType?: string; entityId?: string; metadata?: any },
  ) {
    const req = this;
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user?.sub ?? null,
          action: payload.action,
          entityType: payload.entityType,
          entityId: payload.entityId,
          metadata: payload.metadata,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });
    } catch (err) {
      req.log.warn({ err }, 'audit log failed');
    }
  });
});

declare module 'fastify' {
  interface FastifyRequest {
    audit: (payload: {
      action: string;
      entityType?: string;
      entityId?: string;
      metadata?: any;
    }) => Promise<void>;
  }
}
