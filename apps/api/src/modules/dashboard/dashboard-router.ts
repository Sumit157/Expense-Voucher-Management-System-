import { Router, type Request, type RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { createRequireAuth, requireRole } from '../auth/guards.js';
import { VoucherError } from '../vouchers/voucher-service.js';
import type { DashboardService } from './dashboard-service.js';

export interface DashboardRouterDeps {
  prisma: PrismaClient;
  service: DashboardService;
}

function actorOf(req: Request): { id: string; role: NonNullable<typeof req.auth>['role'] } {
  if (!req.auth) {
    // Unreachable: every route runs behind requireAuth.
    throw new VoucherError(401, 'UNAUTHENTICATED', 'Authentication required');
  }
  return { id: req.auth.id, role: req.auth.role };
}

/** Wrap async handlers so rejections reach the app error middleware. */
function wrap(
  handler: (req: Request, res: Parameters<RequestHandler>[1]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

export function createDashboardRouter(deps: DashboardRouterDeps): Router {
  const { prisma, service } = deps;
  const router = Router();
  const requireAuth = createRequireAuth(prisma);
  const accountsOnly = requireRole('ACCOUNTS');

  router.use(requireAuth);

  router.get(
    '/accounts',
    accountsOnly,
    wrap(async (req, res) => {
      res.json({ data: await service.getAccountsDashboard(actorOf(req)) });
    }),
  );

  return router;
}
