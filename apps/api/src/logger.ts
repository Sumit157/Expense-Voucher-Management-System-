import { pino, type Logger } from 'pino';
import type { Env } from './env.js';

export type { Logger };

export function createLogger(env: Env): Logger {
  return pino({
    level: env.LOG_LEVEL,
    base: { service: 'api', env: env.NODE_ENV },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["set-cookie"]',
        'password',
        '*.password',
        'newPassword',
        '*.newPassword',
        'token',
        '*.token',
        'devResetToken',
        '*.devResetToken',
      ],
      censor: '[redacted]',
    },
  });
}
