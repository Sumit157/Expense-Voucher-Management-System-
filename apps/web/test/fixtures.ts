import type { AuthUser } from '@/api/types';

export const testUser: AuthUser = {
  id: 'user-1',
  email: 'ada@abc.test',
  fullName: 'Ada Lovelace',
  employeeCode: 'E-001',
  department: 'Engineering',
  role: 'EMPLOYEE',
};

export function authBody(user: AuthUser): { data: AuthUser } {
  return { data: user };
}
