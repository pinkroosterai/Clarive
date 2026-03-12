import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- localStorage mock ---
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock config so apiUrl is undefined (not '') — triggers the fallback to http://localhost:5000
vi.mock('@/lib/config', () => ({
  config: { apiUrl: undefined, googleClientId: '', mode: 'test' },
}));

// Mock auth store logout
const mockLogout = vi.fn();
vi.mock('@/store/authStore', () => ({
  useAuthStore: { getState: () => ({ logout: mockLogout }) },
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock window.location
const locationMock = { href: '', protocol: 'http:', hostname: 'localhost' };
Object.defineProperty(window, 'location', {
  value: locationMock,
  writable: true,
});

// BASE_URL resolves to "http://localhost:5000" because apiUrl is undefined (fallback path)
const BASE_URL = 'http://localhost:5000';

// Must import AFTER mocks are set up
import { getToken, setToken, getRefreshToken, setRefreshToken, ApiError, api } from './apiClient';

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    blob: () => Promise.resolve(new Blob([JSON.stringify(data)])),
    headers: new Headers({ 'Content-Type': 'application/json' }),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => jsonResponse(data, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

function emptyResponse(status = 204): Response {
  return {
    ok: true,
    status,
    statusText: 'No Content',
    json: () => Promise.reject(new Error('No body')),
    blob: () => Promise.resolve(new Blob()),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => emptyResponse(status),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(''),
  } as Response;
}

function errorResponse(status: number, code: string, message: string): Response {
  return {
    ok: false,
    status,
    statusText: message,
    json: () => Promise.resolve({ error: { code, message } }),
    blob: () => Promise.resolve(new Blob()),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => errorResponse(status, code, message),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify({ error: { code, message } })),
  } as Response;
}

describe('apiClient', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockFetch.mockReset();
    locationMock.href = '';
    vi.clearAllMocks();
  });

  // ── Token functions ──

  describe('token functions', () => {
    it('getToken returns null when no token', () => {
      expect(getToken()).toBeNull();
    });

    it('setToken stores token in localStorage', () => {
      setToken('my-jwt');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cl_token', 'my-jwt');
      expect(getToken()).toBe('my-jwt');
    });

    it('setToken(null) removes token from localStorage', () => {
      setToken('my-jwt');
      setToken(null);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cl_token');
      expect(getToken()).toBeNull();
    });

    it('getRefreshToken returns null when no refresh token', () => {
      expect(getRefreshToken()).toBeNull();
    });

    it('setRefreshToken stores and retrieves refresh token', () => {
      setRefreshToken('my-refresh');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('cl_refresh', 'my-refresh');
      expect(getRefreshToken()).toBe('my-refresh');
    });

    it('setRefreshToken(null) removes refresh token', () => {
      setRefreshToken('my-refresh');
      setRefreshToken(null);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('cl_refresh');
      expect(getRefreshToken()).toBeNull();
    });
  });

  // ── ApiError ──

  describe('ApiError', () => {
    it('constructs with correct properties', () => {
      const err = new ApiError(404, 'NOT_FOUND', 'Resource not found');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('ApiError');
      expect(err.status).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('Resource not found');
    });

    it('is throwable and catchable', () => {
      expect(() => {
        throw new ApiError(500, 'SERVER_ERROR', 'Oops');
      }).toThrow('Oops');
    });
  });

  // ── api.get ──

  describe('api.get', () => {
    it('sends GET request with auth header', async () => {
      setToken('bearer-token');
      mockFetch.mockResolvedValue(jsonResponse({ id: 1, name: 'Test' }));

      const result = await api.get<{ id: number; name: string }>('/api/entries');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/api/entries`);
      expect(options.headers['Authorization']).toBe('Bearer bearer-token');
      expect(options.credentials).toBe('include');
      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('sends GET request without auth header when no token', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

      await api.get('/api/public');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBeUndefined();
    });
  });

  // ── api.post ──

  describe('api.post', () => {
    it('sends JSON body with correct Content-Type', async () => {
      setToken('tok');
      mockFetch.mockResolvedValue(jsonResponse({ created: true }));

      const result = await api.post('/api/entries', { title: 'New' });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/api/entries`);
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.body).toBe(JSON.stringify({ title: 'New' }));
      expect(result).toEqual({ created: true });
    });

    it('sends POST without body when body is undefined', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

      await api.post('/api/trigger');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.body).toBeUndefined();
    });
  });

  // ── api.delete ──

  describe('api.delete', () => {
    it('sends DELETE request', async () => {
      mockFetch.mockResolvedValue(emptyResponse());

      const result = await api.delete('/api/entries/123');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/api/entries/123`);
      expect(options.method).toBe('DELETE');
      expect(result).toBeUndefined();
    });
  });

  // ── 204 response ──

  describe('204 response', () => {
    it('returns undefined for 204 No Content', async () => {
      mockFetch.mockResolvedValue(emptyResponse(204));

      const result = await api.get('/api/something');

      expect(result).toBeUndefined();
    });
  });

  // ── Error handling ──

  describe('error handling', () => {
    it('throws ApiError with parsed error body', async () => {
      mockFetch.mockResolvedValue(errorResponse(400, 'VALIDATION_ERROR', 'Title is required'));

      await expect(api.get('/api/entries')).rejects.toThrow(ApiError);

      try {
        await api.get('/api/entries');
      } catch (e) {
        const err = e as ApiError;
        expect(err.status).toBe(400);
        expect(err.code).toBe('VALIDATION_ERROR');
        expect(err.message).toBe('Title is required');
      }
    });

    it('uses statusText when error body cannot be parsed', async () => {
      const res = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('not json')),
        headers: new Headers(),
        redirected: false,
        type: 'basic' as ResponseType,
        url: '',
        clone: function () {
          return this;
        },
        body: null,
        bodyUsed: false,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        formData: () => Promise.resolve(new FormData()),
        text: () => Promise.resolve(''),
        blob: () => Promise.resolve(new Blob()),
      } as Response;
      mockFetch.mockResolvedValue(res);

      try {
        await api.get('/api/fail');
      } catch (e) {
        const err = e as ApiError;
        expect(err.status).toBe(500);
        expect(err.code).toBe('UNKNOWN');
        expect(err.message).toBe('Internal Server Error');
      }
    });
  });

  // ── Token refresh on 401 ──

  describe('401 token refresh', () => {
    it('retries with new token after successful refresh', async () => {
      setToken('old-token');
      setRefreshToken('valid-refresh');

      // First call returns 401
      mockFetch.mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED', 'Expired'));
      // Refresh call succeeds
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ token: 'new-token', refreshToken: 'new-refresh' })
      );
      // Retry succeeds
      mockFetch.mockResolvedValueOnce(jsonResponse({ data: 'success' }));

      const result = await api.get<{ data: string }>('/api/entries');

      expect(result).toEqual({ data: 'success' });
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify refresh was called
      const refreshCall = mockFetch.mock.calls[1];
      expect(refreshCall[0]).toBe(`${BASE_URL}/api/auth/refresh`);
      expect(refreshCall[1].method).toBe('POST');

      // Verify retry has new token and X-No-Retry header
      const retryCall = mockFetch.mock.calls[2];
      expect(retryCall[1].headers['Authorization']).toBe('Bearer new-token');
      expect(retryCall[1].headers['X-No-Retry']).toBe('1');
    });

    it('clears tokens and redirects when no refresh token available', async () => {
      setToken('old-token');
      // No refresh token set

      mockFetch.mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED', 'Expired'));

      await expect(api.get('/api/entries')).rejects.toThrow(ApiError);

      expect(mockLogout).toHaveBeenCalled();
    });

    it('clears tokens when refresh fails', async () => {
      setToken('old-token');
      setRefreshToken('bad-refresh');

      // First call returns 401
      mockFetch.mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED', 'Expired'));
      // Refresh call fails
      mockFetch.mockResolvedValueOnce(errorResponse(401, 'INVALID_REFRESH', 'Bad refresh'));

      await expect(api.get('/api/entries')).rejects.toThrow(ApiError);

      expect(mockLogout).toHaveBeenCalled();
    });

    it('does NOT refresh on auth endpoints', async () => {
      setToken('token');
      setRefreshToken('refresh');

      mockFetch.mockResolvedValue(errorResponse(401, 'BAD_CREDS', 'Wrong password'));

      await expect(api.post('/api/auth/login', {})).rejects.toThrow(ApiError);

      // Should only have 1 call — no refresh attempt
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT refresh on register endpoint', async () => {
      setToken('token');
      setRefreshToken('refresh');

      mockFetch.mockResolvedValue(errorResponse(401, 'CONFLICT', 'Email taken'));

      await expect(api.post('/api/auth/register', {})).rejects.toThrow(ApiError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT refresh on google auth endpoint', async () => {
      setToken('token');
      setRefreshToken('refresh');

      mockFetch.mockResolvedValue(errorResponse(401, 'INVALID_TOKEN', 'Bad google token'));

      await expect(api.post('/api/auth/google', {})).rejects.toThrow(ApiError);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('deduplicates concurrent refresh calls', async () => {
      setToken('old-token');
      setRefreshToken('valid-refresh');

      // Two 401 responses
      mockFetch.mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED', 'Expired'));
      mockFetch.mockResolvedValueOnce(errorResponse(401, 'UNAUTHORIZED', 'Expired'));
      // One refresh call
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ token: 'new-token', refreshToken: 'new-refresh' })
      );
      // Two retries
      mockFetch.mockResolvedValueOnce(jsonResponse({ a: 1 }));
      mockFetch.mockResolvedValueOnce(jsonResponse({ b: 2 }));

      const [r1, r2] = await Promise.all([
        api.get<{ a: number }>('/api/a'),
        api.get<{ b: number }>('/api/b'),
      ]);

      expect(r1).toEqual({ a: 1 });
      expect(r2).toEqual({ b: 2 });

      // 2 initial + 1 refresh + 2 retries = 5
      // (refresh is deduplicated so only 1 refresh call)
      const refreshCalls = mockFetch.mock.calls.filter(
        (args: unknown[]) => args[0] === `${BASE_URL}/api/auth/refresh`
      );
      expect(refreshCalls.length).toBe(1);
    });
  });

  // ── api.upload ──

  describe('api.upload', () => {
    it('sends FormData without Content-Type header', async () => {
      setToken('tok');
      mockFetch.mockResolvedValue(jsonResponse({ uploaded: true }));

      const formData = new FormData();
      formData.append('file', new Blob(['content']), 'test.txt');

      await api.upload('/api/upload', formData);

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options.body).toBe(formData);
      // FormData body should NOT have Content-Type set (browser sets it with boundary)
      expect(options.headers['Content-Type']).toBeUndefined();
    });
  });

  // ── api.download ──

  describe('api.download', () => {
    it('returns Blob', async () => {
      const blobContent = new Blob(['file data'], { type: 'text/plain' });
      const res = {
        ok: true,
        status: 200,
        statusText: 'OK',
        blob: () => Promise.resolve(blobContent),
        headers: new Headers(),
        redirected: false,
        type: 'basic' as ResponseType,
        url: '',
        clone: function () {
          return this;
        },
        body: null,
        bodyUsed: false,
        json: () => Promise.resolve({}),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        formData: () => Promise.resolve(new FormData()),
        text: () => Promise.resolve('file data'),
      } as Response;
      mockFetch.mockResolvedValue(res);

      const result = await api.download('/api/export');

      expect(result).toBe(blobContent);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/api/export`);
      expect(options.method).toBe('POST');
      expect(options.credentials).toBe('include');
    });

    it('sends body when provided', async () => {
      const blobContent = new Blob(['data']);
      const res = {
        ok: true,
        status: 200,
        blob: () => Promise.resolve(blobContent),
        headers: new Headers(),
        statusText: 'OK',
        redirected: false,
        type: 'basic' as ResponseType,
        url: '',
        clone: function () {
          return this;
        },
        body: null,
        bodyUsed: false,
        json: () => Promise.resolve({}),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        formData: () => Promise.resolve(new FormData()),
        text: () => Promise.resolve(''),
      } as Response;
      mockFetch.mockResolvedValue(res);

      await api.download('/api/export', { format: 'yaml' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.body).toBe(JSON.stringify({ format: 'yaml' }));
    });

    it('throws ApiError on failure', async () => {
      mockFetch.mockResolvedValue(errorResponse(403, 'FORBIDDEN', 'Not allowed'));

      await expect(api.download('/api/export')).rejects.toThrow(ApiError);

      try {
        await api.download('/api/export');
      } catch (e) {
        const err = e as ApiError;
        expect(err.status).toBe(403);
        expect(err.code).toBe('FORBIDDEN');
      }
    });
  });

  // ── api.put ──

  describe('api.put', () => {
    it('sends PUT request with JSON body', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ updated: true }));

      await api.put('/api/entries/1', { title: 'Updated' });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/api/entries/1`);
      expect(options.method).toBe('PUT');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.body).toBe(JSON.stringify({ title: 'Updated' }));
    });
  });

  // ── api.patch ──

  describe('api.patch', () => {
    it('sends PATCH request with JSON body', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ patched: true }));

      await api.patch('/api/entries/1', { title: 'Patched' });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/api/entries/1`);
      expect(options.method).toBe('PATCH');
      expect(options.body).toBe(JSON.stringify({ title: 'Patched' }));
    });
  });
});
