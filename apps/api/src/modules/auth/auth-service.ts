import { createHash, randomBytes } from 'node:crypto';
import type { PrismaClient, UserRole } from '@prisma/client';
import { generateSessionToken, hashToken } from './session.js';

/** "Remember me" sessions last 30 days; regular sessions use SESSION_TTL_HOURS (D-045). */
export const REMEMBER_ME_TTL_HOURS = 720;
/** Password-reset tokens are single-use and expire after 1 hour (D-044). */
export const PASSWORD_RESET_TTL_MINUTES = 60;

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
  role: UserRole;
}

interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
  role: UserRole;
  isActive: boolean;
}

export function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    employeeCode: user.employeeCode,
    department: user.department,
    role: user.role,
  };
}

export async function createSession(
  prisma: PrismaClient,
  userId: string,
  ttlHours: number,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000);
  await prisma.$transaction([
    prisma.session.deleteMany({
      where: { userId, expiresAt: { lte: new Date() } },
    }),
    prisma.session.create({
      data: { userId, tokenHash: hashToken(token), expiresAt },
    }),
  ]);
  return { token, expiresAt };
}

export async function resolveSession(
  prisma: PrismaClient,
  token: string,
): Promise<AuthUser | null> {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) {
    return null;
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (!session.user.isActive) {
    return null;
  }
  return toAuthUser(session.user);
}

export async function revokeSession(prisma: PrismaClient, token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateResetToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Creates a single-use reset token, replacing any unused tokens for the user.
 * Returns the raw token (only ever delivered over a trusted channel) and its expiry.
 */
export async function createPasswordResetToken(
  prisma: PrismaClient,
  userId: string,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000);
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId, tokenHash: hashResetToken(token), expiresAt },
    }),
  ]);
  return { token, expiresAt };
}

/** Validates and consumes a reset token. Returns the user id or null when invalid/expired/used. */
export async function consumePasswordResetToken(
  prisma: PrismaClient,
  token: string,
): Promise<string | null> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
  });
  if (!record || record.usedAt !== null || record.expiresAt.getTime() <= Date.now()) {
    return null;
  }
  const updated = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (updated.count === 0) {
    return null;
  }
  return record.userId;
}
