import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: string[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user?: { sub: string; email: string; role: string };
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorate('authenticate', async function (req, reply) {
    try {
      let token: string | undefined;
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        token = auth.slice(7).trim();
      } else if ((req as any).cookies?.sg_token) {
        token = (req as any).cookies.sg_token;
      }
      if (!token) {
        return reply.code(401).send({ error: 'Unauthorized', reason: 'no_token' });
      }
      const decoded = app.jwt.verify(token) as {
        sub: string;
        email: string;
        role: string;
      };
      req.user = decoded;
    } catch (err: any) {
      req.log.warn({ err: err.message }, 'jwt verify failed');
      return reply.code(401).send({ error: 'Unauthorized', reason: 'verify_failed' });
    }
  });

  app.decorate('requireRole', function (...roles: string[]) {
    return async (req, reply) => {
      if (!req.user) {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }
      if (!roles.includes(req.user.role)) {
        reply.code(403).send({ error: 'Forbidden' });
      }
    };
  });
});
