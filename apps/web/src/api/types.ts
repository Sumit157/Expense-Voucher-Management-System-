export type UserRole = 'EMPLOYEE' | 'DIRECTOR' | 'ACCOUNTS';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  employeeCode: string | null;
  department: string | null;
  role: UserRole;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
