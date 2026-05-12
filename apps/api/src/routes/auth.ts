import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@stone-gate/db';
import { hashPassword, verifyPassword } from '../lib/password.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['PRINCIPAL', 'ANALYST', 'ACQUISITIONS_DIRECTOR', 'COMPLIANCE', 'ADMIN'])
    .default('ANALYST'),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/login', async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !user.active || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const token = app.jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '12h' },
    );

    reply.setCookie('sg_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 12,
    });

    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  });

  app.post('/logout', async (_req, reply) => {
    reply.clearCookie('sg_token', { path: '/' });
    return { ok: true };
  });

  app.get('/me', { preHandler: [app.authenticate] }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: { id: true, email: true, name: true, role: true },
    });
    return user;
  });

  app.post(
    '/register',
    { preHandler: [app.authenticate, app.requireRole('ADMIN')] },
    async (req, reply) => {
      const parsed = RegisterSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
      if (existing) return reply.code(409).send({ error: 'Email exists' });
      const user = await prisma.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name,
          role: parsed.data.role,
          passwordHash: hashPassword(parsed.data.password),
        },
        select: { id: true, email: true, name: true, role: true },
      });
      return user;
    },
  );
};
