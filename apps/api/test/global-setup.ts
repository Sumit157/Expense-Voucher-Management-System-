import { execSync } from 'node:child_process';
import { findRepoRoot, resolveTestDatabaseUrl } from './utils/test-db-url.js';

export default function setup(): void {
  process.stdout.write('Applying migrations to the test database...\n');
  execSync('npx prisma migrate deploy', {
    cwd: findRepoRoot(),
    env: { ...process.env, DATABASE_URL: resolveTestDatabaseUrl() },
    stdio: 'inherit',
  });
}
