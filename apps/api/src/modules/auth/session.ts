import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';

export const SESSION_COOKIE_NAME = 'evm_sid';

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readSessionCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    if (part.slice(0, separatorIndex).trim() === SESSION_COOKIE_NAME) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }
  return undefined;
}

export function setSessionCookie(
  res: Response,
  token: string,
  maxAgeMs: number,
  secure: boolean,
): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: maxAgeMs,
  });
}

export function clearSessionCookie(res: Response, secure: boolean): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  });
}
