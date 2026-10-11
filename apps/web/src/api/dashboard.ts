import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import type { AccountsDashboard } from '@/api/types';

export function useAccountsDashboard() {
  return useQuery<AccountsDashboard>({
    queryKey: ['dashboard', 'accounts'],
    queryFn: () => apiRequest<AccountsDashboard>('/dashboard/accounts'),
  });
}
