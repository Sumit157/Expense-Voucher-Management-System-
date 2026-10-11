import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { resolveTestDatabaseUrl } from './test/utils/test-db-url.js';

export default defineConfig({
  resolve: {
    alias: {
      '@evm/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globalSetup: ['./test/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // All suites share one MySQL test database; run files one at a time so
    // org-wide assertions (dashboard totals) and session/voucher fixtures
    // cannot race each other across workers.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: resolveTestDatabaseUrl(),
      APP_ORIGIN: 'http://localhost:5173',
      API_ORIGIN: 'http://localhost:3000',
      SESSION_SECRET: 'vitest-session-secret-32-characters-min',
      SESSION_TTL_HOURS: '12',
      LOG_LEVEL: 'silent',
    },
  },
});
