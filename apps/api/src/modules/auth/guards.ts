import type { RequestHandler } from 'express';
import type { PrismaClient, UserRole } from '@prisma/client';
import { resolveSession } from './auth-service.js';
import { readSessionCookie } from './session.js';

export function createRequireAuth(prisma: PrismaClient): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = readSessionCookie(req);
      if (!token) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
        });
        return;
      }
      const auth = await resolveSession(prisma, token);
      if (!auth) {
        res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
        });
        return;
      }
      req.auth = auth;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.auth) {
      res.status(401).json({
        error: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
      });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Insufficient role' },
      });
      return;
    }
    next();
  };
}

export function createCsrfOriginGuard(allowedOrigins: string[]): RequestHandler {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      next();
      return;
    }
    const origin = req.headers.origin;
    // Browsers always attach Origin to cross-site state-changing requests, so
    // a mismatching value is blocked. Non-browser clients may omit it.
    if (origin === undefined) {
      next();
      return;
    }
    if (!allowedOrigins.includes(origin)) {
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Request origin not allowed' },
      });
      return;
    }
    next();
  };
}
