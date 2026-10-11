import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit';
import type { Env } from '../env.js';

/**
 * General API limiter: generous ceiling for normal app usage.
 * Skipped entirely in the test suite so parallel integration tests
 * do not trip over each other's request volume.
 */
export function createApiLimiter(env: Env): RateLimitRequestHandler | null {
  if (env.NODE_ENV === 'test') return null;
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' },
    },
  });
}

/**
 * Stricter limiter for auth-sensitive endpoints (login, register,
 * forgot-password, reset-password). Also disabled in tests.
 */
export function createAuthLimiter(env: Env): RateLimitRequestHandler | null {
  if (env.NODE_ENV === 'test') return null;
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many authentication attempts, please try again later.',
      },
    },
  });
}
