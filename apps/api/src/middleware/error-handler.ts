import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from '../logger.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
};

interface HttpErrorLike {
  status?: number;
  statusCode?: number;
  expose?: boolean;
  message?: string;
  type?: string;
}

function clientErrorCode(status: number): string {
  if (status === 413) {
    return 'PAYLOAD_TOO_LARGE';
  }
  return 'BAD_REQUEST';
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, _req, res, _next) => {
    if (res.headersSent) {
      logger.error({ err }, 'error after headers sent');
      return;
    }

    const maybeHttpError = err as HttpErrorLike | undefined;
    const status =
      typeof maybeHttpError?.status === 'number'
        ? maybeHttpError.status
        : typeof maybeHttpError?.statusCode === 'number'
          ? maybeHttpError.statusCode
          : undefined;

    // Framework/body-parser client errors (4xx) are safe to surface.
    if (status !== undefined && status >= 400 && status < 500) {
      const rawMessage = maybeHttpError?.message;
      const safeMessage =
        maybeHttpError?.expose === true && typeof rawMessage === 'string'
          ? rawMessage
          : 'Bad request';
      res.status(status).json({
        error: { code: clientErrorCode(status), message: safeMessage },
      });
      return;
    }

    logger.error({ err }, 'unhandled request error');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  };
}
