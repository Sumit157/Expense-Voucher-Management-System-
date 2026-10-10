import bcrypt from 'bcryptjs';

export const PASSWORD_COST = 12;

// Precomputed so verifying an unknown email costs the same as a known one.
const DUMMY_HASH = bcrypt.hashSync('evm-timing-equalisation-value', PASSWORD_COST);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, PASSWORD_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function verifyPasswordOrDummy(plain: string, hash: string | null): Promise<boolean> {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH);
}
