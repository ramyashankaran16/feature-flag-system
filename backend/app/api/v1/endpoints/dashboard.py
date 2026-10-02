from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.v1.endpoints.analytics import build_overview
from app.core.database import get_db
from app.core.utils import iso
from app.models import AuditLog, Environment, FeatureFlag, FeatureRollout, User, UserAssignment
from app.schemas.analytics import DashboardStats, DashboardTotals, EnvironmentStat, UpcomingSchedule
from app.schemas.audit import AuditLogOut

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _bucket(ro: FeatureRollout) -> str:
    if not ro.is_enabled:
        return "Disabled"
    p = ro.rollout_percentage
    if p == 0:
        return "0% (targeted only)"
    if p <= 25:
        return "1-25%"
    if p <= 50:
        return "26-50%"
    if p < 100:
        return "51-99%"
    return "100%"


@router.get("/stats", response_model=DashboardStats, summary="Feature, rollout and environment statistics")
def dashboard_stats(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    count = lambda stmt: db.scalar(stmt) or 0  # noqa: E731

    total_flags = count(select(func.count(FeatureFlag.id)).where(FeatureFlag.is_archived.is_(False)))
    archived = count(select(func.count(FeatureFlag.id)).where(FeatureFlag.is_archived.is_(True)))
    active_flags = count(
        select(func.count(func.distinct(FeatureRollout.flag_id)))
        .join(FeatureFlag, FeatureFlag.id == FeatureRollout.flag_id)
        .where(FeatureRollout.is_enabled.is_(True), FeatureFlag.is_archived.is_(False))
    )

    envs = db.scalars(select(Environment).order_by(Environment.id)).all()
    rollouts = db.scalars(
        select(FeatureRollout).join(FeatureFlag, FeatureFlag.id == FeatureRollout.flag_id)
        .where(FeatureFlag.is_archived.is_(False))
    ).unique().all()
    assignment_counts = dict(db.execute(
        select(UserAssignment.environment_id, func.count(UserAssignment.id)).group_by(UserAssignment.environment_id)
    ).all())

    distribution = {k: 0 for k in ["Disabled", "0% (targeted only)", "1-25%", "26-50%", "51-99%", "100%"]}
    env_stats = []
    for env in envs:
        env_ros = [r for r in rollouts if r.environment_id == env.id]
        enabled = [r for r in env_ros if r.is_enabled]
        for r in env_ros:
            distribution[_bucket(r)] += 1
        env_stats.append(EnvironmentStat(
            environment_id=env.id, environment_name=env.name, environment_key=env.key, is_protected=env.is_protected,
            total_flags=len(env_ros), enabled_flags=len(enabled), disabled_flags=len(env_ros) - len(enabled),
            partial_rollouts=sum(1 for r in enabled if r.rollout_percentage < 100),
            scheduled_changes=sum(1 for r in env_ros if r.scheduled_enable_at or r.scheduled_disable_at),
            user_assignments=assignment_counts.get(env.id, 0),
        ))

    upcoming = []
    for r in rollouts:
        if r.scheduled_enable_at:
            upcoming.append((r.scheduled_enable_at, r, "ENABLE"))
        if r.scheduled_disable_at:
            upcoming.append((r.scheduled_disable_at, r, "DISABLE"))
    upcoming.sort(key=lambda t: t[0])
    upcoming_out = [UpcomingSchedule(rollout_id=r.id, flag_key=r.flag.key, environment_key=r.environment.key,
                                     action=a, scheduled_at=iso(t)) for t, r, a in upcoming[:10]]

    overview = build_overview(db, days=7)
    recent = db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(10)).all()

    totals = DashboardTotals(
        total_flags=total_flags, active_flags=active_flags, archived_flags=archived, environments=len(envs),
        users=count(select(func.count(User.id))),
        active_users=count(select(func.count(User.id)).where(User.is_active.is_(True))),
        user_assignments=sum(assignment_counts.values()),
        evaluations_today=(overview.trend[-1].enabled + overview.trend[-1].disabled) if overview.trend else 0,
    )
    return DashboardStats(
        totals=totals, environments=env_stats, rollout_distribution=distribution,
        evaluation_trend=overview.trend, top_flags=overview.top_flags, upcoming_schedules=upcoming_out,
        recent_activity=[AuditLogOut.model_validate(a) for a in recent],
    )
