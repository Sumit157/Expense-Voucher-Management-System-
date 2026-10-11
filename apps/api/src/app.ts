import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type Express, type Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Database } from './db.js';
import type { Env } from './env.js';
import type { Logger } from './logger.js';
import { createCsrfOriginGuard } from './modules/auth/guards.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createApiLimiter, createAuthLimiter } from './middleware/rate-limit.js';
import { createHealthRouter } from './routes/health.js';

export interface AppDeps {
  env: Env;
  logger: Logger;
  db: Database;
  authRouter?: Router;
  vouchersRouter?: Router;
  dashboardRouter?: Router;
}

export function createApp(deps: AppDeps): Express {
  const app = express();

  if (deps.env.TRUST_PROXY > 0) {
    app.set('trust proxy', deps.env.TRUST_PROXY);
  }
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: deps.env.APP_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(
    pinoHttp({
      logger: deps.logger,
      genReqId: () => randomUUID(),
      autoLogging: deps.env.NODE_ENV !== 'test',
    }),
  );
  app.use(createCsrfOriginGuard([deps.env.APP_ORIGIN, deps.env.API_ORIGIN]));

  const apiLimiter = createApiLimiter(deps.env);
  if (apiLimiter) {
    app.use('/api/v1', apiLimiter);
  }

  app.use(createHealthRouter(deps));
  if (deps.authRouter) {
    const authLimiter = createAuthLimiter(deps.env);
    if (authLimiter) {
      app.use('/api/v1/auth/login', authLimiter);
      app.use('/api/v1/auth/register', authLimiter);
      app.use('/api/v1/auth/forgot-password', authLimiter);
      app.use('/api/v1/auth/reset-password', authLimiter);
    }
    app.use('/api/v1/auth', deps.authRouter);
  }
  if (deps.vouchersRouter) {
    app.use('/api/v1/vouchers', deps.vouchersRouter);
  }
  if (deps.dashboardRouter) {
    app.use('/api/v1/dashboard', deps.dashboardRouter);
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));

  return app;
}
