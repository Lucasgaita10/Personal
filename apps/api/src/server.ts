import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';

import { authRoutes } from './routes/auth.js';
import { clientRoutes } from './routes/clients.js';
import { opportunityRoutes } from './routes/opportunities.js';
import { documentRoutes } from './routes/documents.js';
import { chatRoutes } from './routes/chat.js';
import { scenarioRoutes } from './routes/scenarios.js';
import { reportRoutes } from './routes/reports.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { telemetryRoutes } from './routes/telemetry.js';
import { authPlugin } from './middleware/auth.js';
import { auditPlugin } from './middleware/audit.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    bodyLimit: 50 * 1024 * 1024, // 50 MB JSON; uploads use multipart
  });

  await app.register(cors, {
    origin: (origin, cb) => cb(null, true),
    credentials: true,
  });

  await app.register(cookie);
  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-only-do-not-use-in-prod',
    cookie: { cookieName: 'sg_token', signed: false },
  });

  await app.register(multipart, {
    limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB per file
  });

  await app.register(rateLimit, { max: 600, timeWindow: '1 minute' });

  await app.register(authPlugin);
  await app.register(auditPlugin);

  app.get('/healthz', async () => ({ ok: true, ts: new Date().toISOString() }));

  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(clientRoutes, { prefix: '/v1/clients' });
  await app.register(opportunityRoutes, { prefix: '/v1/opportunities' });
  await app.register(documentRoutes, { prefix: '/v1/documents' });
  await app.register(chatRoutes, { prefix: '/v1/chat' });
  await app.register(scenarioRoutes, { prefix: '/v1/scenarios' });
  await app.register(reportRoutes, { prefix: '/v1/reports' });
  await app.register(dashboardRoutes, { prefix: '/v1/dashboard' });
  await app.register(telemetryRoutes, { prefix: '/v1/telemetry' });

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'request failed');
    const status = (err as any).statusCode ?? 500;
    reply.status(status).send({
      error: err.name,
      message: status >= 500 ? 'Internal server error' : err.message,
    });
  });

  return app;
}
