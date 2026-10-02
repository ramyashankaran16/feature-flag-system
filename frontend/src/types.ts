export type RoleName = 'Admin' | 'Developer' | 'Viewer';

export interface Role {
  id: number;
  name: RoleName;
  description?: string | null;
  user_count?: number;
}

export interface User {
  id: number;
  username: string;
  email: string;
  full_name?: string | null;
  role: Role;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Environment {
  id: number;
  name: string;
  key: string;
  description?: string | null;
  api_key?: string | null;
  is_protected: boolean;
  created_at: string;
  updated_at: string;
}

export interface Rollout {
  id: number;
  flag_id: number;
  flag_key: string;
  environment_id: number;
  environment_key: string;
  environment_name: string;
  environment_is_protected: boolean;
  is_enabled: boolean;
  rollout_percentage: number;
  scheduled_enable_at: string | null;
  scheduled_disable_at: string | null;
  version: number;
  updated_by_username?: string | null;
  updated_at: string;
}

export interface Flag {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  is_archived: boolean;
  created_by_username?: string | null;
  created_at: string;
  updated_at: string;
  rollouts: Rollout[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface Assignment {
  id: number;
  flag_id: number;
  environment_id: number;
  environment_key: string;
  user_identifier: string;
  is_enabled: boolean;
  note?: string | null;
  created_by_username?: string | null;
  created_at: string;
}

export type Snapshot = Record<string, unknown>;

export interface AuditLog {
  id: number;
  user_id?: number | null;
  username?: string | null;
  action: string;
  entity_type: string;
  entity_id?: number | null;
  flag_id?: number | null;
  environment_id?: number | null;
  old_value?: Snapshot | null;
  new_value?: Snapshot | null;
  description?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface DailyPoint {
  date: string;
  enabled: number;
  disabled: number;
  unique_users: number;
}

export interface EnvironmentAnalytics {
  environment_id: number;
  environment_key: string;
  environment_name: string;
  total_evaluations: number;
  enabled_count: number;
  disabled_count: number;
  series: DailyPoint[];
}

export interface FlagAnalytics {
  flag_id: number;
  flag_key: string;
  days: number;
  total_evaluations: number;
  environments: EnvironmentAnalytics[];
}

export interface TopFlag {
  flag_key: string;
  flag_name: string;
  evaluations: number;
  enabled: number;
  disabled: number;
}

export interface EnvironmentStat {
  environment_id: number;
  environment_name: string;
  environment_key: string;
  is_protected: boolean;
  total_flags: number;
  enabled_flags: number;
  disabled_flags: number;
  partial_rollouts: number;
  scheduled_changes: number;
  user_assignments: number;
}

export interface UpcomingSchedule {
  rollout_id: number;
  flag_key: string;
  environment_key: string;
  action: 'ENABLE' | 'DISABLE';
  scheduled_at: string;
}

export interface DashboardStats {
  totals: {
    total_flags: number;
    active_flags: number;
    archived_flags: number;
    environments: number;
    users: number;
    active_users: number;
    user_assignments: number;
    evaluations_today: number;
  };
  environments: EnvironmentStat[];
  rollout_distribution: Record<string, number>;
  evaluation_trend: DailyPoint[];
  top_flags: TopFlag[];
  upcoming_schedules: UpcomingSchedule[];
  recent_activity: AuditLog[];
}

export interface EvaluateResult {
  flag_key: string;
  environment: string;
  user_id?: string | null;
  enabled: boolean;
  reason: string;
  bucket?: number | null;
}

export interface RolloutUpdate {
  is_enabled?: boolean;
  rollout_percentage?: number;
  scheduled_enable_at?: string | null;
  scheduled_disable_at?: string | null;
}
