import { API_BASE_URL } from '@/config/env';
import { AuthError, NetworkError, ServerError, RateLimitError, NotFoundError, ValidationError, ForbiddenError, ConflictError } from '@/utils/errors';
import { getOrCreateSessionId } from '@/lib/storage';
import { logger } from '@/utils/logger';
import type { ApiError, ApiResponse } from '@/types/api';

function newRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

let authToken: string | null = null;
export function setAuthToken(token: string | null): void { authToken = token; }
export function getAuthToken(): string | null { return authToken; }

type RefreshHandler = () => Promise<string>;
let refreshHandler: RefreshHandler | null = null;
let refreshInFlight: Promise<string> | null = null;

/** Registered once at app startup (see auth.ts) — avoids a circular import. */
export function setRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler;
}

async function refreshOnce(): Promise<string> {
  if (!refreshInFlight) {
    if (!refreshHandler) throw new AuthError('No refresh handler registered', 'NO_REFRESH_HANDLER');
    refreshInFlight = refreshHandler().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

interface RequestConfig extends RequestInit { skipAuth?: boolean; }

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const isJson = response.headers.get('content-type')?.includes('application/json') === true;
  if (!response.ok) {
    let errorData: ApiError | null = null;
    if (isJson) { try { errorData = await response.json() as ApiError; } catch { /* malformed error */ } }
    const message = errorData?.error?.message || `HTTP ${response.status}`;
    const code = errorData?.error?.code || `HTTP_${response.status}`;
    switch (response.status) {
      case 401: throw new AuthError(message, code);
      case 403: throw new ForbiddenError(message);
      case 404: throw new NotFoundError(message);
      case 409: throw new ConflictError(message);
      case 422: throw new ValidationError(message);
      case 429: {
        const raw = response.headers.get('Retry-After');
        const retryAfter = raw ? Number.parseInt(raw, 10) : undefined;
        throw new RateLimitError(message, Number.isFinite(retryAfter) ? retryAfter : undefined);
      }
      default: throw new ServerError(message, code, response.status >= 500 ? response.status : 500);
    }
  }
  if (!isJson) return response.text() as T;
  const data: unknown = await response.json();
  if (typeof data === 'object' && data !== null && 'data' in data) return (data as ApiResponse<T>).data;
  return data as T;
}

export async function apiRequest<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
  const { skipAuth, ...fetchConfig } = config;
  const url = `${API_BASE_URL}${endpoint}`;
  const doFetch = async (): Promise<Response> => {
    const headers = new Headers(fetchConfig.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    headers.set('X-Session-Id', getOrCreateSessionId());
    headers.set('X-Request-ID', newRequestId());
    if (!skipAuth && authToken) headers.set('Authorization', `Bearer ${authToken}`);
    return fetch(url, { ...fetchConfig, headers });
  };

  const started = performance.now();
  try {
    let response = await doFetch();

    if (response.status === 401 && !skipAuth && refreshHandler) {
      try {
        await refreshOnce();
        response = await doFetch();
      } catch {
        // Refresh failed — fall through to AuthError from handleResponse
      }
    }

    logger.debug(
      'HTTP request completed',
      {
        endpoint,
        method: fetchConfig.method ?? 'GET',
        status: response.status,
        durationMs: performance.now() - started,
      }
    );
    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof TypeError) throw new NetworkError();
    throw error;
  }
}
export const api = {
  get: <T>(endpoint: string, config?: RequestConfig) => apiRequest<T>(endpoint, { ...config, method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, config?: RequestConfig) => apiRequest<T>(endpoint, { ...config, method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(endpoint: string, body?: unknown, config?: RequestConfig) => apiRequest<T>(endpoint, { ...config, method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(endpoint: string, body?: unknown, config?: RequestConfig) => apiRequest<T>(endpoint, { ...config, method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(endpoint: string, config?: RequestConfig) => apiRequest<T>(endpoint, { ...config, method: 'DELETE' }),
};
