const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

export class ApiError extends Error {
  code: string;
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode: number = 400, code: string = 'API_ERROR', details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// In-memory token store with localStorage fallback for cross-domain Incognito resilience
let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

export function setAuthTokens(accessToken?: string | null, refreshToken?: string | null) {
  if (accessToken !== undefined) {
    memoryAccessToken = accessToken;
    if (typeof window !== 'undefined') {
      try {
        if (accessToken) localStorage.setItem('taskpulse_access_token', accessToken);
        else localStorage.removeItem('taskpulse_access_token');
      } catch {}
    }
  }

  if (refreshToken !== undefined) {
    memoryRefreshToken = refreshToken;
    if (typeof window !== 'undefined') {
      try {
        if (refreshToken) localStorage.setItem('taskpulse_refresh_token', refreshToken);
        else localStorage.removeItem('taskpulse_refresh_token');
      } catch {}
    }
  }
}

export function getAccessToken(): string | null {
  if (memoryAccessToken) return memoryAccessToken;
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('taskpulse_access_token');
    } catch {
      return null;
    }
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (memoryRefreshToken) return memoryRefreshToken;
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('taskpulse_refresh_token');
    } catch {
      return null;
    }
  }
  return null;
}

let isRefreshing = false;
let refreshSubscribers: ((success: boolean) => void)[] = [];

function subscribeTokenRefresh(cb: (success: boolean) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(success: boolean) {
  refreshSubscribers.forEach((cb) => cb(success));
  refreshSubscribers = [];
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
  isRetry = false
): Promise<{ success: boolean; data: T; message?: string; meta?: any }> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const token = getAccessToken();
  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Sends HTTP-only auth cookies if supported by browser/domain
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const result = isJson ? await response.json() : null;

  // Handle Token Expiry & Automatic Refresh Token Flow
  if (
    response.status === 401 &&
    !isRetry &&
    !endpoint.includes('/auth/login') &&
    !endpoint.includes('/auth/refresh') &&
    !endpoint.includes('/auth/logout')
  ) {
    const currentRefreshToken = getRefreshToken();

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(currentRefreshToken ? { 'x-refresh-token': currentRefreshToken } : {}),
        };

        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: refreshHeaders,
          body: currentRefreshToken ? JSON.stringify({ refreshToken: currentRefreshToken }) : undefined,
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newAccess = refreshData?.data?.accessToken || refreshData?.data?.token;
          const newRefresh = refreshData?.data?.refreshToken;
          if (newAccess) {
            setAuthTokens(newAccess, newRefresh);
          }
          isRefreshing = false;
          onRefreshed(true);
          // Retry original request with refreshed token
          return request<T>(endpoint, options, true);
        } else {
          isRefreshing = false;
          setAuthTokens(null, null);
          onRefreshed(false);
        }
      } catch {
        isRefreshing = false;
        setAuthTokens(null, null);
        onRefreshed(false);
      }
    } else {
      // Another request is already refreshing tokens; queue this request
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((success) => {
          if (success) {
            resolve(request<T>(endpoint, options, true));
          } else {
            const message = result?.error?.message || 'Session expired. Please sign in again.';
            reject(new ApiError(message, 401, 'UNAUTHORIZED'));
          }
        });
      });
    }
  }

  if (!response.ok) {
    const message = result?.error?.message || result?.message || `Request failed with status ${response.status}`;
    const code = result?.error?.code || 'UNKNOWN_ERROR';
    const details = result?.error?.details;
    throw new ApiError(message, response.status, code, details);
  }

  return result;
}

export const api = {
  get: <T = any>(endpoint: string, params?: Record<string, any>) => {
    let query = '';
    if (params) {
      const filteredParams = Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
      if (filteredParams.length > 0) {
        query = `?${filteredParams.join('&')}`;
      }
    }
    return request<T>(`${endpoint}${query}`, { method: 'GET' });
  },

  post: <T = any>(endpoint: string, body?: any) => {
    return request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch: <T = any>(endpoint: string, body?: any) => {
    return request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete: <T = any>(endpoint: string) => {
    return request<T>(endpoint, { method: 'DELETE' });
  },

  download: async (endpoint: string, params?: Record<string, any>, defaultFilename = 'download') => {
    let query = '';
    if (params) {
      const filtered = Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
      if (filtered.length > 0) query = `?${filtered.join('&')}`;
    }

    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}${query}`;
    const token = getAccessToken();
    const res = await fetch(url, {
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new ApiError('File download failed', res.status);

    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition');
    let filename = defaultFilename;
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(blobUrl);
    }, 2000);
  },
};
