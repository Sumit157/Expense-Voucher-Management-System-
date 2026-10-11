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
import { createHealthRouter } from './routes/health.js';

export interface AppDeps {
  env: Env;
  logger: Logger;
  db: Database;
  authRouter?: Router;
  vouchersRouter?: Router;
}

export function createApp(deps: AppDeps): Express {
  const app = express();

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

  app.use(createHealthRouter(deps));
  if (deps.authRouter) {
    app.use('/api/v1/auth', deps.authRouter);
  }
  if (deps.vouchersRouter) {
    app.use('/api/v1/vouchers', deps.vouchersRouter);
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));

  return app;
}
