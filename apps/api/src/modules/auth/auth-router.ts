import { Router, type Response } from 'express';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { Env } from '../../env.js';
import type { Logger } from '../../logger.js';
import { createRequireAuth } from './guards.js';
import {
  toAuthUser,
  createSession,
  revokeSession,
  createPasswordResetToken,
  consumePasswordResetToken,
  REMEMBER_ME_TTL_HOURS,
} from './auth-service.js';
import { hashPassword, verifyPasswordOrDummy } from './password.js';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './session.js';

export interface AuthRouterDeps {
  env: Env;
  logger: Logger;
  prisma: PrismaClient;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1, 'Password is required').max(128),
  rememberMe: z.boolean().optional(),
});

// Public self-registration always yields EMPLOYEE (D-043); role is never client-supplied.
const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(150),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
  department: z.string().trim().max(120).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const LOGIN_FAILURE_MESSAGE = 'Invalid email or password';
// Identical body whether or not the email exists — prevents account enumeration.
const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for that email, a password reset link has been sent.';

export function createAuthRouter(deps: AuthRouterDeps): Router {
  const router = Router();
  const { env, logger, prisma } = deps;
  const requireAuth = createRequireAuth(prisma);
  const cookieSecure = env.NODE_ENV === 'production';

  function sendValidationErrors(
    res: Response,
    issues: { path: (string | number)[]; message: string }[],
  ): void {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }

  router.post('/login', async (req, res, next) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationErrors(res, parsed.error.issues);
        return;
      }

      const { email, password, rememberMe } = parsed.data;
      const user = await prisma.user.findUnique({ where: { email } });
      const passwordValid = await verifyPasswordOrDummy(password, user?.passwordHash ?? null);

      if (!user || !user.isActive || !passwordValid) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: LOGIN_FAILURE_MESSAGE },
        });
        return;
      }

      const ttlHours = rememberMe ? REMEMBER_ME_TTL_HOURS : env.SESSION_TTL_HOURS;
      const { token } = await createSession(prisma, user.id, ttlHours);
      setSessionCookie(res, token, ttlHours * 3_600_000, cookieSecure);
      logger.info({ userId: user.id, role: user.role, rememberMe: !!rememberMe }, 'user logged in');
      res.json({ data: toAuthUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/register', async (req, res, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationErrors(res, parsed.error.issues);
        return;
      }

      const { fullName, email, password, department } = parsed.data;
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        res.status(409).json({
          error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists' },
        });
        return;
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: {
          fullName,
          email,
          passwordHash,
          department: department || null,
          role: 'EMPLOYEE',
        },
      });

      const ttlHours = env.SESSION_TTL_HOURS;
      const { token } = await createSession(prisma, user.id, ttlHours);
      setSessionCookie(res, token, ttlHours * 3_600_000, cookieSecure);
      logger.info({ userId: user.id, role: user.role }, 'user registered');
      res.status(201).json({ data: toAuthUser(user) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/forgot-password', async (req, res, next) => {
    try {
      const parsed = forgotPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationErrors(res, parsed.error.issues);
        return;
      }

      const { email } = parsed.data;
      const user = await prisma.user.findUnique({ where: { email } });
      let devResetToken: string | undefined;

      if (user && user.isActive) {
        const { token, expiresAt } = await createPasswordResetToken(prisma, user.id);
        // No mail transport yet: the raw token is returned only outside production
        // so the flow is testable; production logs never include it (D-044).
        if (env.NODE_ENV !== 'production') {
          devResetToken = token;
        }
        logger.info(
          { userId: user.id, expiresAt: expiresAt.toISOString(), env: env.NODE_ENV },
          'password reset requested',
        );
      } else {
        logger.info({ env: env.NODE_ENV }, 'password reset requested for unknown/inactive email');
      }

      res.status(202).json({
        data: devResetToken
          ? { message: FORGOT_PASSWORD_MESSAGE, devResetToken }
          : { message: FORGOT_PASSWORD_MESSAGE },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/reset-password', async (req, res, next) => {
    try {
      const parsed = resetPasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        sendValidationErrors(res, parsed.error.issues);
        return;
      }

      const { token, newPassword } = parsed.data;
      const userId = await consumePasswordResetToken(prisma, token);
      if (!userId) {
        res.status(400).json({
          error: {
            code: 'RESET_TOKEN_INVALID',
            message: 'This reset link is invalid or has expired. Request a new one.',
          },
        });
        return;
      }

      const passwordHash = await hashPassword(newPassword);
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
        // A password change invalidates every live session for safety.
        prisma.session.deleteMany({ where: { userId } }),
      ]);
      logger.info({ userId }, 'password reset completed');
      res.status(204).end();
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
