import { api } from './client';
import type {
  Assignment, AuditLog, DashboardStats, Environment, EvaluateResult, Flag, FlagAnalytics,
  Page, Role, Rollout, RolloutUpdate, TokenResponse, User,
} from '../types';

const data = <T,>(p: Promise<{ data: T }>) => p.then((r) => r.data);

export const authApi = {
  login: (username: string, password: string) =>
    data(api.post<TokenResponse>('/auth/login', new URLSearchParams({ username, password }))),
  me: () => data(api.get<User>('/auth/me')),
  logout: (refresh_token: string | null) => api.post('/auth/logout', { refresh_token }),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }),
};

export interface FlagListParams { q?: string; archived?: boolean; page?: number; size?: number }

export const flagsApi = {
  list: (params: FlagListParams) => data(api.get<Page<Flag>>('/flags', { params })),
  get: (id: number) => data(api.get<Flag>(`/flags/${id}`)),
  create: (body: { key: string; name: string; description?: string }) => data(api.post<Flag>('/flags', body)),
  update: (id: number, body: { name?: string; description?: string | null }) => data(api.patch<Flag>(`/flags/${id}`, body)),
  archive: (id: number) => data(api.post<Flag>(`/flags/${id}/archive`)),
  restore: (id: number) => data(api.post<Flag>(`/flags/${id}/restore`)),
  remove: (id: number) => api.delete(`/flags/${id}`),
  history: (id: number, page = 1, size = 20) =>
    data(api.get<Page<AuditLog>>(`/flags/${id}/history`, { params: { page, size } })),
};

export const rolloutsApi = {
  update: (id: number, body: RolloutUpdate) => data(api.patch<Rollout>(`/rollouts/${id}`, body)),
  toggle: (id: number) => data(api.post<Rollout>(`/rollouts/${id}/toggle`)),
  rollback: (id: number, body: { to_version?: number; audit_log_id?: number } = {}) =>
    data(api.post<Rollout>(`/rollouts/${id}/rollback`, body)),
  history: (id: number, page = 1, size = 50) =>
    data(api.get<Page<AuditLog>>(`/rollouts/${id}/history`, { params: { page, size } })),
  runScheduler: () => data(api.post<{ message: string }>('/rollouts/scheduler/run')),
};

export const assignmentsApi = {
  list: (flagId: number, params: { environment_id?: number; q?: string; page?: number; size?: number }) =>
    data(api.get<Page<Assignment>>(`/flags/${flagId}/assignments`, { params })),
  create: (flagId: number, body: { environment_id: number; user_identifier: string; is_enabled: boolean; note?: string }) =>
    data(api.post<Assignment>(`/flags/${flagId}/assignments`, body)),
  bulk: (flagId: number, body: { environment_id: number; user_identifiers: string[]; is_enabled: boolean; note?: string }) =>
    data(api.post<{ message: string }>(`/flags/${flagId}/assignments/bulk`, body)),
  remove: (id: number) => api.delete(`/assignments/${id}`),
};

export const envApi = {
  list: () => data(api.get<Environment[]>('/environments')),
  create: (body: { name: string; key: string; description?: string; is_protected: boolean }) =>
    data(api.post<Environment>('/environments', body)),
  update: (id: number, body: { name?: string; description?: string | null; is_protected?: boolean }) =>
    data(api.patch<Environment>(`/environments/${id}`, body)),
  regenerateKey: (id: number) => data(api.post<Environment>(`/environments/${id}/regenerate-key`)),
  remove: (id: number) => api.delete(`/environments/${id}`),
};

export interface UserListParams { q?: string; role_id?: number; is_active?: boolean; page?: number; size?: number }

export const usersApi = {
  list: (params: UserListParams) => data(api.get<Page<User>>('/users', { params })),
  roles: () => data(api.get<Role[]>('/roles')),
  create: (body: { username: string; email: string; full_name?: string; password: string; role_id: number }) =>
    data(api.post<User>('/users', body)),
  update: (id: number, body: { email?: string; full_name?: string | null; role_id?: number; is_active?: boolean; password?: string }) =>
    data(api.patch<User>(`/users/${id}`, body)),
  remove: (id: number) => api.delete(`/users/${id}`),
};

export interface AuditParams {
  action?: string; entity_type?: string; user_id?: number; flag_id?: number; environment_id?: number;
  q?: string; date_from?: string; date_to?: string; page?: number; size?: number;
}

export const auditApi = {
  list: (params: AuditParams) => data(api.get<Page<AuditLog>>('/audit-logs', { params })),
  actions: () => data(api.get<string[]>('/audit-logs/actions')),
};

export const analyticsApi = {
  dashboard: () => data(api.get<DashboardStats>('/dashboard/stats')),
  flag: (id: number, days: number) => data(api.get<FlagAnalytics>(`/analytics/flags/${id}`, { params: { days } })),
};

export const evaluateApi = {
  test: (body: { flag_key: string; environment_key: string; user_id?: string }) =>
    data(api.post<EvaluateResult>('/evaluate/test/run', body)),
};
