import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import type { AccountsDashboard, DirectorDashboard, EmployeeDashboard } from '@/api/types';

export function useAccountsDashboard() {
  return useQuery<AccountsDashboard>({
    queryKey: ['dashboard', 'accounts'],
    queryFn: () => apiRequest<AccountsDashboard>('/dashboard/accounts'),
  });
}

export function useEmployeeDashboard() {
  return useQuery<EmployeeDashboard>({
    queryKey: ['dashboard', 'employee'],
    queryFn: () => apiRequest<EmployeeDashboard>('/dashboard/employee'),
  });
}

export function useDirectorDashboard() {
  return useQuery<DirectorDashboard>({
    queryKey: ['dashboard', 'director'],
    queryFn: () => apiRequest<DirectorDashboard>('/dashboard/director'),
  });
}
