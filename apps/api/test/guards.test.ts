import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { UserRole } from '@prisma/client';
import { requireRole } from '../src/modules/auth/guards.js';
import type { AuthUser } from '../src/modules/auth/auth-service.js';

function buildApp(role: UserRole | null): express.Express {
  const app = express();
  app.use((req, _res, next) => {
    if (role) {
      req.auth = {
        id: 'u1',
        email: 'user@evm.test',
        fullName: 'Test User',
        employeeCode: null,
        department: null,
        role,
      } satisfies AuthUser;
    }
    next();
  });
  app.get('/director-only', requireRole('DIRECTOR'), (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('requireRole', () => {
  it('rejects anonymous requests with 401', async () => {
    const res = await request(buildApp(null)).get('/director-only');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a non-director with 403', async () => {
    const res = await request(buildApp('EMPLOYEE')).get('/director-only');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows a director', async () => {
    const res = await request(buildApp('DIRECTOR')).get('/director-only');
    expect(res.status).toBe(200);
  });
});
