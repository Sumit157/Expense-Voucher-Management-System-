import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { createApp } from './app.js';
import { createDatabase } from './db.js';
import { loadEnv } from './env.js';
import { createLogger } from './logger.js';
import { getPrisma } from './lib/prisma.js';
import { createAuthRouter } from './modules/auth/auth-router.js';
import { createDashboardRouter } from './modules/dashboard/dashboard-router.js';
import { createDashboardService } from './modules/dashboard/dashboard-service.js';
import { createSignatureStorage, resolveUploadDir } from './modules/vouchers/signature-storage.js';
import { createVoucherService } from './modules/vouchers/voucher-service.js';
import { createVoucherRouter } from './modules/vouchers/voucher-router.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadDotenv({ path: path.join(repoRoot, '.env') });

const env = loadEnv();
const logger = createLogger(env);
const db = createDatabase(env.DATABASE_URL, logger);
const prisma = getPrisma();
const authRouter = createAuthRouter({ env, logger, prisma });
const storage = createSignatureStorage(resolveUploadDir(repoRoot, env.UPLOAD_DIR));
const voucherService = createVoucherService({ prisma, storage });
const vouchersRouter = createVoucherRouter({ env, logger, prisma, service: voucherService });
const dashboardService = createDashboardService({ prisma });
const dashboardRouter = createDashboardRouter({ prisma, service: dashboardService });
const app = createApp({ env, logger, db, authRouter, vouchersRouter, dashboardRouter });

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, origin: env.API_ORIGIN }, 'API listening');
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');
  server.close();
  try {
    await db.close();
  } catch (error) {
    logger.error({ err: error }, 'error closing database pool');
  }
  try {
    await prisma.$disconnect();
  } catch (error) {
    logger.error({ err: error }, 'error disconnecting prisma client');
  }
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
