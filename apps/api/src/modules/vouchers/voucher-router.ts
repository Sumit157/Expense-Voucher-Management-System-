import { Router, type Request, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { PrismaClient, VoucherStatus } from '@prisma/client';
import type { Env } from '../../env.js';
import type { Logger } from '../../logger.js';
import { createRequireAuth, requireRole } from '../auth/guards.js';
import {
  VoucherError,
  isSupportedCategory,
  type Actor,
  type DraftInput,
  type VoucherService,
} from './voucher-service.js';

export interface VoucherRouterDeps {
  env: Env;
  logger: Logger;
  prisma: PrismaClient;
  service: VoucherService;
}

const idSchema = z.string().uuid();

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'is not a valid calendar date');

const amountSchema = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'must be a positive number with up to 2 decimals')
  .refine((value) => Number(value) > 0, 'must be greater than zero');

const draftFieldSchemas = {
  voucherDate: dateSchema,
  expenseDate: dateSchema,
  department: z.string().trim().min(1, 'is required').max(120),
  expenseTitle: z.string().trim().min(1, 'is required').max(200),
  category: z
    .string()
    .refine((value) => isSupportedCategory(value), 'is not a supported expense category'),
  description: z.string().max(5000).nullish(),
  amount: amountSchema,
};

const createDraftSchema = z.object(draftFieldSchemas);

const updateDraftSchema = z
  .object(draftFieldSchemas)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'at least one field is required');

const listQuerySchema = z.object({
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional(),
});

function validationError(
  issues: { path: (string | number)[]; message: string }[],
  message: string,
): VoucherError {
  return new VoucherError(
    400,
    'VALIDATION_ERROR',
    message,
    issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
  );
}

function parseId(raw: unknown): string {
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) {
    throw validationError(
      [{ path: ['id'], message: 'is not a valid voucher id' }],
      'Invalid voucher id',
    );
  }
  return parsed.data;
}

function actorOf(req: Request): Actor {
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

export function createVoucherRouter(deps: VoucherRouterDeps): Router {
  const { env, prisma, service, logger } = deps;
  const router = Router();
  const requireAuth = createRequireAuth(prisma);
  const employeeOnly = requireRole('EMPLOYEE');

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: env.MAX_SIGNATURE_BYTES, files: 1 },
  });

  router.use(requireAuth);

  router.post(
    '/',
    employeeOnly,
    wrap(async (req, res) => {
      const parsed = createDraftSchema.safeParse(req.body);
      if (!parsed.success) {
        throw validationError(parsed.error.issues, 'Invalid voucher');
      }
      const dto = await service.createDraft(actorOf(req), parsed.data as DraftInput);
      res.status(201).json({ data: dto });
    }),
  );

  router.get(
    '/',
    wrap(async (req, res) => {
      const parsed = listQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw validationError(parsed.error.issues, 'Invalid query parameters');
      }
      const { items, total } = await service.listVouchers(actorOf(req), {
        status: parsed.data.status as VoucherStatus | undefined,
      });
      res.json({ data: { items, total } });
    }),
  );

  router.get(
    '/:id',
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      res.json({ data: await service.getVoucher(actorOf(req), id) });
    }),
  );

  router.patch(
    '/:id',
    employeeOnly,
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      const parsed = updateDraftSchema.safeParse(req.body);
      if (!parsed.success) {
        throw validationError(parsed.error.issues, 'Invalid voucher update');
      }
      res.json({ data: await service.updateDraft(actorOf(req), id, parsed.data) });
    }),
  );

  router.delete(
    '/:id',
    employeeOnly,
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      await service.deleteDraft(actorOf(req), id);
      res.status(204).end();
    }),
  );

  router.post(
    '/:id/signature/employee',
    employeeOnly,
    (req, res, next) => {
      upload.single('file')(req, res, (error: unknown) => {
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({
            error: { code: 'FILE_TOO_LARGE', message: 'Signature image exceeds the size limit' },
          });
          return;
        }
        if (error instanceof multer.MulterError) {
          res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid file upload' },
          });
          return;
        }
        next(error);
      });
    },
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      const file = req.file;
      if (!file) {
        throw validationError([{ path: ['file'], message: 'is required' }], 'File is required');
      }
      const dto = await service.attachEmployeeSignature(
        actorOf(req),
        id,
        { buffer: file.buffer, originalName: file.originalname },
        env.MAX_SIGNATURE_BYTES,
      );
      logger.info({ voucherId: id, userId: req.auth?.id }, 'employee signature stored');
      res.status(200).json({ data: dto });
    }),
  );

  router.get(
    '/:id/signatures/employee',
    wrap(async (req, res) => {
      const id = parseId(req.params.id);
      const { buffer, mimeType } = await service.readEmployeeSignature(actorOf(req), id);
      res.set({
        'Content-Type': mimeType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, no-store',
      });
      res.end(buffer);
    }),
  );

  return router;
}
