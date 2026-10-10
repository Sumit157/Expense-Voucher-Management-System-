import type { UserRole } from '@/api/types';

export const ROLE_LABELS: Record<UserRole, string> = {
  EMPLOYEE: 'Employee',
  DIRECTOR: 'Director',
  ACCOUNTS: 'Accounts',
};
