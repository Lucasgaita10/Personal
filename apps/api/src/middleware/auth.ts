import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Tell @fastify/jwt the shape of our payload — this also re-types
// FastifyRequest['user'] so it stops conflicting with our augmentation.
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string; role: string };
    user: { sub: string; email: string; role: string };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: string[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
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
      req.user = app.jwt.verify(token);
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
