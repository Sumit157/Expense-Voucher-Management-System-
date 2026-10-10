import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { createApp } from './app.js';
import { createDatabase } from './db.js';
import { loadEnv } from './env.js';
import { createLogger } from './logger.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
loadDotenv({ path: path.join(repoRoot, '.env') });

const env = loadEnv();
const logger = createLogger(env);
const db = createDatabase(env.DATABASE_URL, logger);
const app = createApp({ env, logger, db });

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
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
