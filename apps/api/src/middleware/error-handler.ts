import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from '../logger.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
};

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, _req, res, _next) => {
    logger.error({ err }, 'unhandled request error');
    if (res.headersSent) {
      return;
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  };
}
