import type { PrismaClient, UserRole } from '@prisma/client';
import { generateSessionToken, hashToken } from './session.js';

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
