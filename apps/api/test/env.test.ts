import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';

const validEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'mysql://user:pass@127.0.0.1:3306/expense_voucher',
  APP_ORIGIN: 'http://localhost:5173',
  API_ORIGIN: 'http://localhost:3000',
  SESSION_SECRET: 'x'.repeat(32),
  UPLOAD_DIR: './uploads',
  MAX_SIGNATURE_BYTES: '2097152',
  APP_TZ: 'UTC',
};

describe('loadEnv', () => {
  it('parses a valid environment', () => {
    const env = loadEnv(validEnv);
    expect(env.PORT).toBe(3000);
    expect(env.MAX_SIGNATURE_BYTES).toBe(2097152);
    expect(env.NODE_ENV).toBe('test');
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omit, ...rest } = validEnv;
    expect(() => loadEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('rejects an invalid APP_ORIGIN', () => {
    expect(() => loadEnv({ ...validEnv, APP_ORIGIN: 'not-a-url' })).toThrow(/APP_ORIGIN/);
  });

  it('rejects a short SESSION_SECRET', () => {
    expect(() => loadEnv({ ...validEnv, SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/);
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => loadEnv({ ...validEnv, PORT: '70000' })).toThrow(/PORT/);
  });
});
