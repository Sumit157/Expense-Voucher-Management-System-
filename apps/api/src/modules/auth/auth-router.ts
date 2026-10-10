import { Router } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { Env } from '../../env.js';
import type { Logger } from '../../logger.js';
import { createRequireAuth } from './guards.js';
import { toAuthUser, createSession, revokeSession } from './auth-service.js';
import { verifyPasswordOrDummy } from './password.js';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './session.js';

export interface AuthRouterDeps {
  env: Env;
  logger: Logger;
  prisma: PrismaClient;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1, 'Password is required').max(128),
});

const LOGIN_FAILURE_MESSAGE = 'Invalid email or password';

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();
  const { env, logger, prisma } = deps;
  const requireAuth = createRequireAuth(prisma);
  const cookieSecure = env.NODE_ENV === 'production';
  const ttlMs = env.SESSION_TTL_HOURS * 3_600_000;

  router.post('/login', async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid login request',
            details: parsed.error.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message,
            })),
          },
        });
        return;
      }

      const { email, password } = parsed.data;
      const user = await prisma.user.findUnique({ where: { email } });
      const passwordValid = await verifyPasswordOrDummy(password, user?.passwordHash ?? null);

      if (!user || !user.isActive || !passwordValid) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: LOGIN_FAILURE_MESSAGE },
        });
        return;
      }

      const { token } = await createSession(prisma, user.id, env.SESSION_TTL_HOURS);
      setSessionCookie(res, token, ttlMs, cookieSecure);
      logger.info({ userId: user.id, role: user.role }, 'user logged in');
      res.json({ data: toAuthUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', requireAuth, (req, res) => {
    res.json({ data: req.auth });
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const token = readSessionCookie(req);
      if (token) {
        await revokeSession(prisma, token);
      }
      clearSessionCookie(res, cookieSecure);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
