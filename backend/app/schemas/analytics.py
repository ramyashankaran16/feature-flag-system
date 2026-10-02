from pydantic import BaseModel

from app.schemas.audit import AuditLogOut


class DailyPoint(BaseModel):
    date: str
    enabled: int = 0
    disabled: int = 0
    unique_users: int = 0


class EnvironmentAnalytics(BaseModel):
    environment_id: int
    environment_key: str
    environment_name: str
    total_evaluations: int
    enabled_count: int
    disabled_count: int
    series: list[DailyPoint]


class FlagAnalytics(BaseModel):
    flag_id: int
    flag_key: str
    days: int
    total_evaluations: int
    environments: list[EnvironmentAnalytics]


class TopFlag(BaseModel):
    flag_key: str
    flag_name: str
    evaluations: int
    enabled: int
    disabled: int


class AnalyticsOverview(BaseModel):
    days: int
    total_evaluations: int
    trend: list[DailyPoint]
    top_flags: list[TopFlag]


class EnvironmentStat(BaseModel):
    environment_id: int
    environment_name: str
    environment_key: str
    is_protected: bool
    total_flags: int
    enabled_flags: int
    disabled_flags: int
    partial_rollouts: int
    scheduled_changes: int
    user_assignments: int


class UpcomingSchedule(BaseModel):
    rollout_id: int
    flag_key: str
    environment_key: str
    action: str
    scheduled_at: str


class DashboardTotals(BaseModel):
    total_flags: int
    active_flags: int
    archived_flags: int
    environments: int
    users: int
    active_users: int
    user_assignments: int
    evaluations_today: int


class DashboardStats(BaseModel):
    totals: DashboardTotals
    environments: list[EnvironmentStat]
    rollout_distribution: dict[str, int]
    evaluation_trend: list[DailyPoint]
    top_flags: list[TopFlag]
    upcoming_schedules: list[UpcomingSchedule]
    recent_activity: list[AuditLogOut]
