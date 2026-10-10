import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Database } from './db.js';
import type { Env } from './env.js';
import type { Logger } from './logger.js';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createHealthRouter } from './routes/health.js';

export interface AppDeps {
  env: Env;
  logger: Logger;
  db: Database;
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

  app.use(createHealthRouter(deps));

  app.use(notFoundHandler);
  app.use(createErrorHandler(deps.logger));

  return app;
}
