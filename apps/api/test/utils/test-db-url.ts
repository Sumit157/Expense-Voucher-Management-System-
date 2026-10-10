import fs from 'node:fs';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

/**
 * Walk up from the current working directory until the monorepo root
 * (the package.json that declares npm workspaces) is found. Robust against
 * Vitest bundling configs into temp directories.
 */
export function findRepoRoot(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);
  for (;;) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { workspaces?: unknown };
      if (pkg.workspaces) {
        return dir;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error('Could not locate the monorepo root (package.json with workspaces)');
    }
    dir = parent;
  }
}

let dotenvLoaded = false;

function ensureDotenv(): void {
  if (dotenvLoaded) {
    return;
  }
  loadDotenv({ path: path.join(findRepoRoot(), '.env') });
  dotenvLoaded = true;
}

/**
 * Resolve the database URL used by integration tests.
 * Priority: TEST_DATABASE_URL, else DATABASE_URL from the root .env with the
 * database name replaced by expense_voucher_test.
 */
export function resolveTestDatabaseUrl(): string {
  ensureDotenv();
  const explicit = process.env.TEST_DATABASE_URL;
  if (explicit) {
    return explicit;
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'Set TEST_DATABASE_URL (or DATABASE_URL in the root .env) to run database tests',
    );
  }
  const parsed = new URL(url);
  parsed.pathname = '/expense_voucher_test';
  return parsed.toString();
}
