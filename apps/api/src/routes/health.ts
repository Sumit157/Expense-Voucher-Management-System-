import { Router } from 'express';
import type { AppDeps } from '../app.js';

export function createHealthRouter(deps: AppDeps): Router {
  const router = Router();

  router.get('/healthz', (_req, res) => {
    res.json({
      data: {
        status: 'ok',
        service: 'api',
        uptimeSeconds: Math.round(process.uptime()),
      },
    });
  });

  router.get('/readyz', async (_req, res) => {
    try {
      await deps.db.ping();
      res.json({ data: { status: 'ready', database: 'up' } });
    } catch {
      res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Database unreachable' },
      });
    }
  });

  return router;
}
