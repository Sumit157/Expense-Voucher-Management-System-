import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  APP_ORIGIN: z.string().url('APP_ORIGIN must be a valid URL'),
  API_ORIGIN: z.string().url('API_ORIGIN must be a valid URL'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(720).default(12),
  UPLOAD_DIR: z.string().min(1).default('./uploads'),
  MAX_SIGNATURE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(2 * 1024 * 1024),
  APP_TZ: z.string().min(1).default('UTC'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
