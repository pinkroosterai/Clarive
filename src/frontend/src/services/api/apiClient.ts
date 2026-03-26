import { config } from '@/lib/config';
import type { ProgressEvent } from '@/types';

function resolveBaseUrl(): string {
  const envUrl = config.apiUrl;
  // Empty string means "use relative URLs" (Vite proxy or same-origin in production)
  if (envUrl === '') return '';
  // No config at all — fall back to backend on port 5000 at the same hostname
  if (!envUrl) return `${window.location.protocol}//${window.location.hostname}:5000`;
  // Relative paths like "/api" — paths already include the /api prefix, so BASE_URL is empty
  if (envUrl.startsWith('/')) return '';
  try {
    const parsed = new URL(envUrl);
    const isLocal = ['localhost', '127.0.0.1', ''].includes(parsed.hostname);
    if (isLocal) {
      return `${window.location.protocol}//${window.location.hostname}:${parsed.port || '5000'}`;
    }
    return envUrl;
  } catch {
    return envUrl;
  }
}

const BASE_URL = resolveBaseUrl();
const TOKEN_KEY = 'cl_token';
const REFRESH_TOKEN_KEY = 'cl_refresh';
const WORKSPACE_KEY = 'cl_active_workspace';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string | null): void {
  if (token) localStorage.setItem(REFRESH_TOKEN_KEY, token);
  else localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getActiveWorkspaceId(): string | null {
  return localStorage.getItem(WORKSPACE_KEY);
}

export function setActiveWorkspaceId(id: string | null): void {
  if (id) localStorage.setItem(WORKSPACE_KEY, id);
  else localStorage.removeItem(WORKSPACE_KEY);
}

let refreshPromise: Promise<boolean> | null = null;
let _switchingWorkspace = false;
export function setSwitchingWorkspace(v: boolean): void {
  _switchingWorkspace = v;
}

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const rt = getRefreshToken();
    if (!rt) return false;

    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      setToken(data.token);
      setRefreshToken(data.refreshToken);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};

  if (token) headers['Authorization'] = `Bearer ${token}`;

  if (options.body && !(options.body instanceof FormData) && !(options.body instanceof Blob)) {
    headers['Content-Type'] = 'application/json';
  }

  Object.assign(headers, options.headers);

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  const AUTH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/google'];
  const isAuthEndpoint = AUTH_PATHS.some((p) => path.startsWith(p));

  if (
    res.status === 401 &&
    !isAuthEndpoint &&
    !(options.headers as Record<string, string>)?.['X-No-Retry']
  ) {
    // During workspace switch, stale requests may 401 — suppress logout
    if (_switchingWorkspace) {
      throw new ApiError(401, 'WORKSPACE_SWITCHING', 'Request cancelled during workspace switch');
    }
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`;
      headers['X-No-Retry'] = '1';
      return request<T>(path, { ...options, headers });
    }
    const { useAuthStore } = await import('@/store/authStore');
    useAuthStore.getState().logout();
    throw new ApiError(401, 'SESSION_EXPIRED', 'Session expired');
  }

  if (res.status === 503) {
    const body = await res.json().catch(() => null);
    const err = body?.error;
    if (err?.code === 'MAINTENANCE_MODE') {
      const { useAuthStore } = await import('@/store/authStore');
      useAuthStore.getState().setMaintenanceMode(true);
    }
    throw new ApiError(503, err?.code ?? 'SERVICE_UNAVAILABLE', err?.message ?? res.statusText, err?.details);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = body?.error;
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? res.statusText, err?.details);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown, options?: { signal?: AbortSignal }) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),

  postSSE: async <T>(
    path: string,
    body: unknown,
    onProgress: (event: ProgressEvent) => void,
    signal?: AbortSignal,
    inactivityTimeoutMs = 300_000
  ): Promise<T> => {
    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const controller = new AbortController();
    // Inactivity timeout — resets on each SSE event so active streams are never killed
    let timeout = setTimeout(() => controller.abort(), inactivityTimeoutMs);
    const resetTimeout = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => controller.abort(), inactivityTimeoutMs);
    };
    if (signal) signal.addEventListener('abort', () => controller.abort());

    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        credentials: 'include',
        signal: controller.signal,
      });

      // Handle auth errors before reading stream
      if (res.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${getToken()}`;
          return api.postSSE<T>(path, body, onProgress, signal, inactivityTimeoutMs);
        }
        const { useAuthStore } = await import('@/store/authStore');
        useAuthStore.getState().logout();
        throw new ApiError(401, 'SESSION_EXPIRED', 'Session expired');
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        const err = errBody?.error;
        throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? res.statusText);
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new ApiError(0, 'STREAM_ERROR', 'No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        resetTimeout();

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (double newline delimited)
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const message = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          let eventType = '';
          let data = '';

          for (const line of message.split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7);
            else if (line.startsWith('data: ')) data = line.slice(6);
          }

          if (eventType === 'progress' && data) {
            try {
              const parsed = JSON.parse(data);
              onProgress(parsed as ProgressEvent);
            } catch {
              /* ignore malformed progress */
            }
          } else if (eventType === 'done' && data) {
            try {
              return JSON.parse(data) as T;
            } catch {
              throw new ApiError(0, 'STREAM_ERROR', 'Malformed result data');
            }
          } else if (eventType === 'error' && data) {
            try {
              const parsed = JSON.parse(data);
              throw new ApiError(
                0,
                parsed.code ?? 'STREAM_ERROR',
                parsed.message ?? 'Streaming error'
              );
            } catch (e) {
              if (e instanceof ApiError) throw e;
              throw new ApiError(0, 'STREAM_ERROR', 'Malformed error data');
            }
          }

          boundary = buffer.indexOf('\n\n');
        }
      }

      throw new ApiError(0, 'STREAM_ERROR', 'Stream ended without result');
    } finally {
      clearTimeout(timeout);
    }
  },

  download: async (path: string, body?: unknown): Promise<Blob> => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      const err = errBody?.error;
      throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? res.statusText);
    }

    return res.blob();
  },
};
