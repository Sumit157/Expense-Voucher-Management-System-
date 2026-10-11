import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, apiRequest, apiUpload } from '@/api/client';
import type { Voucher, VoucherDraftInput, VoucherEvent, VoucherList } from '@/api/types';

export const VOUCHERS_QUERY_KEY = ['vouchers'] as const;
export const voucherQueryKey = (id: string) => ['vouchers', 'detail', id] as const;
const voucherListQueryKey = ['vouchers', 'list'] as const;
const voucherEventsQueryKey = (id: string) => ['vouchers', 'events', id] as const;

export function useVoucherList() {
  return useQuery<VoucherList>({
    queryKey: voucherListQueryKey,
    queryFn: () => apiRequest<VoucherList>('/vouchers'),
  });
}

export function useVoucher(id: string) {
  return useQuery<Voucher>({
    queryKey: voucherQueryKey(id),
    queryFn: () => apiRequest<Voucher>(`/vouchers/${id}`),
    enabled: id.length > 0,
  });
}

export function useCreateVoucher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: VoucherDraftInput) =>
      apiRequest<Voucher>('/vouchers', { method: 'POST', body: input }),
    onSuccess: (voucher) => {
      void queryClient.invalidateQueries({ queryKey: voucherListQueryKey });
      queryClient.setQueryData(voucherQueryKey(voucher.id), voucher);
    },
  });
}

export function useUpdateVoucher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<VoucherDraftInput> }) =>
      apiRequest<Voucher>(`/vouchers/${id}`, { method: 'PATCH', body: input }),
    onSuccess: (voucher) => {
      void queryClient.invalidateQueries({ queryKey: voucherListQueryKey });
      queryClient.setQueryData(voucherQueryKey(voucher.id), voucher);
    },
  });
}

export function useDeleteVoucher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/vouchers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      // Refresh the list only. The detail query must NOT be invalidated or
      // force-removed here: the detail page is still mounted, so either would
      // refetch the voucher we just deleted (a guaranteed 404 race). The
      // entry ages out of the cache naturally; revisiting the URL refetches
      // and the page renders its "not found" state.
      void queryClient.invalidateQueries({ queryKey: voucherListQueryKey });
    },
  });
}

export function useVoucherEvents(id: string) {
  return useQuery<VoucherEvent[]>({
    queryKey: voucherEventsQueryKey(id),
    queryFn: () => apiRequest<VoucherEvent[]>(`/vouchers/${id}/events`),
    enabled: id.length > 0,
  });
}

export function useSubmitVoucher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<Voucher>(`/vouchers/${id}/submit`, { method: 'POST' }),
    onSuccess: (voucher) => {
      void queryClient.invalidateQueries({ queryKey: voucherListQueryKey });
      queryClient.setQueryData(voucherQueryKey(voucher.id), voucher);
      // The SUBMITTED event lands in the same server transaction.
      void queryClient.invalidateQueries({ queryKey: voucherEventsQueryKey(voucher.id) });
    },
  });
}

export function useUploadEmployeeSignature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiUpload<Voucher>(`/vouchers/${id}/signature/employee`, formData);
    },
    onSuccess: (voucher) => {
      void queryClient.invalidateQueries({ queryKey: voucherListQueryKey });
      queryClient.setQueryData(voucherQueryKey(voucher.id), voucher);
    },
  });
}

/** Server error message for display; falls back to a generic phrase. */
export function voucherErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return fallback;
}
