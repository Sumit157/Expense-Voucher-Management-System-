import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/api/client';
import type {
  AuthUser,
  ForgotPasswordInput,
  ForgotPasswordResponse,
  LoginCredentials,
  RegisterInput,
  ResetPasswordInput,
} from '@/api/types';

export const SESSION_QUERY_KEY = ['auth', 'session'] as const;

async function fetchSession(): Promise<AuthUser | null> {
  try {
    return await apiRequest<AuthUser>('/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export function useSession() {
  return useQuery<AuthUser | null>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    retry: false,
    staleTime: 15_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginCredentials) =>
      apiRequest<AuthUser>('/auth/login', { method: 'POST', body: credentials }),
    onSuccess: (user) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      apiRequest<AuthUser>('/auth/register', { method: 'POST', body: input }),
    onSuccess: (user) => {
      queryClient.setQueryData(SESSION_QUERY_KEY, user);
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      apiRequest<ForgotPasswordResponse>('/auth/forgot-password', {
        method: 'POST',
        body: input,
      }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      apiRequest<void>('/auth/reset-password', { method: 'POST', body: input }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(SESSION_QUERY_KEY, null);
    },
  });
}
