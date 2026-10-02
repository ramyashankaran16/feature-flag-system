import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { TokenResponse } from '../types';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const ACCESS_KEY = 'ff_access_token';
const REFRESH_KEY = 'ff_refresh_token';

export const tokens = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  set: (t: Pick<TokenResponse, 'access_token' | 'refresh_token'>) => {
    localStorage.setItem(ACCESS_KEY, t.access_token);
    localStorage.setItem(REFRESH_KEY, t.refresh_token);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const api = axios.create({ baseURL: API_BASE, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = tokens.access();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// One shared refresh call, even if many requests fail with 401 at the same time
let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokens.refresh();
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post<TokenResponse>(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken });
    tokens.set(data);
    return data.access_token;
  } catch {
    return null;
  }
}

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    const url = original?.url ?? '';
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh');

    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccessToken().finally(() => { refreshing = null; });
      const newToken = await refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      tokens.clear();
      window.dispatchEvent(new Event('ff:session-expired'));
    }
    return Promise.reject(error);
  },
);

interface ValidationItem { loc?: (string | number)[]; msg?: string }

/** Turn any API error into a sentence that tells the user what happened. */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) return 'Cannot reach the server. Check that the backend is running on port 8000.';
    const detail = (err.response.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return (detail as ValidationItem[])
        .map((d) => {
          const field = (d.loc ?? []).filter((p) => p !== 'body' && p !== 'query').join('.');
          return field ? `${field}: ${d.msg}` : d.msg;
        })
        .join('; ');
    }
    return `Request failed with status ${err.response.status}`;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}
