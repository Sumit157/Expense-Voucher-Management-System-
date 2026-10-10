import { defineConfig } from 'vitest/config';
import { resolveTestDatabaseUrl } from './test/utils/test-db-url.js';

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
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
