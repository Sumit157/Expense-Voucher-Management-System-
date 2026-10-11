import { API_BASE_PATH } from '@evm/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: { field: string; message: string }[];

  constructor(
    status: number,
    code: string,
    message: string,
    details?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

function readErrorMessage(payload: unknown): {
  code: string;
  message: string;
  details?: { field: string; message: string }[];
} {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error: unknown }).error;
    if (error && typeof error === 'object') {
      const { code, message, details } = error as {
        code?: unknown;
        message?: unknown;
        details?: unknown;
      };
      const validDetails =
        Array.isArray(details) &&
        details.every(
          (d) =>
            d !== null &&
            typeof d === 'object' &&
            typeof (d as { field?: unknown }).field === 'string' &&
            typeof (d as { message?: unknown }).message === 'string',
        )
          ? (details as { field: string; message: string }[])
          : undefined;
      return {
        code: typeof code === 'string' ? code : 'UNKNOWN',
        message: typeof message === 'string' ? message : 'Request failed',
        details: validDetails,
      };
    }
  }
  return { code: 'UNKNOWN', message: 'Request failed' };
}

function readData<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  throw new ApiError(500, 'MALFORMED_RESPONSE', 'The server returned an unexpected response');
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_PATH}${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the server. Check your connection and try again.',
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON body; handled below via readError/readData defaults.
  }

  if (!response.ok) {
    const { code, message, details } = readErrorMessage(payload);
    throw new ApiError(response.status, code, message, details);
  }

  return readData<T>(payload);
}

/** Multipart upload (signature images). No Content-Type header — the
 * browser must set the multipart boundary itself. */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_PATH}${path}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the server. Check your connection and try again.',
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON body; handled below via readError/readData defaults.
  }

  if (!response.ok) {
    const { code, message, details } = readErrorMessage(payload);
    throw new ApiError(response.status, code, message, details);
  }

  return readData<T>(payload);
}
