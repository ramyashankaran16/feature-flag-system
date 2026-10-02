from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import Environment, FeatureFlag, User
from app.schemas.analytics import (
    AnalyticsOverview, DailyPoint, EnvironmentAnalytics, FlagAnalytics, TopFlag,
)
from app.services.analytics import fetch_stats, pretty_date

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def build_overview(db: Session, days: int, environment_id: int | None = None, top: int = 5) -> AnalyticsOverview:
    env_stmt = select(Environment)
    if environment_id is not None:
        env_stmt = env_stmt.where(Environment.id == environment_id)
    env_keys = [e.key for e in db.scalars(env_stmt)]
    flags = db.scalars(select(FeatureFlag).where(FeatureFlag.is_archived.is_(False))).all()
    dates, stats = fetch_stats([f.key for f in flags], env_keys, days)

    trend = []
    for d in dates:
        on = sum(stats[(f.key, e, d)]["on"] for f in flags for e in env_keys)
        off = sum(stats[(f.key, e, d)]["off"] for f in flags for e in env_keys)
        trend.append(DailyPoint(date=pretty_date(d), enabled=on, disabled=off))

    per_flag = []
    for f in flags:
        on = sum(stats[(f.key, e, d)]["on"] for e in env_keys for d in dates)
        off = sum(stats[(f.key, e, d)]["off"] for e in env_keys for d in dates)
        if on + off:
            per_flag.append(TopFlag(flag_key=f.key, flag_name=f.name, evaluations=on + off, enabled=on, disabled=off))
    per_flag.sort(key=lambda t: t.evaluations, reverse=True)

    return AnalyticsOverview(days=days, total_evaluations=sum(p.enabled + p.disabled for p in trend),
                             trend=trend, top_flags=per_flag[:top])


@router.get("/overview", response_model=AnalyticsOverview, summary="Evaluation trend and most-used flags")
def overview(days: int = Query(7, ge=1, le=90), environment_id: int | None = None,
             top: int = Query(10, ge=1, le=50),
             db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return build_overview(db, days, environment_id, top)


@router.get("/flags/{flag_id}", response_model=FlagAnalytics, summary="Daily usage of one flag per environment")
def flag_analytics(flag_id: int, days: int = Query(7, ge=1, le=90),
                   db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    flag = db.get(FeatureFlag, flag_id)
    if flag is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feature flag not found")
    envs = db.scalars(select(Environment).order_by(Environment.id)).all()
    dates, stats = fetch_stats([flag.key], [e.key for e in envs], days)

    env_results = []
    for e in envs:
        series = [DailyPoint(date=pretty_date(d), enabled=stats[(flag.key, e.key, d)]["on"],
                             disabled=stats[(flag.key, e.key, d)]["off"],
                             unique_users=stats[(flag.key, e.key, d)]["unique_users"]) for d in dates]
        on, off = sum(p.enabled for p in series), sum(p.disabled for p in series)
        env_results.append(EnvironmentAnalytics(
            environment_id=e.id, environment_key=e.key, environment_name=e.name,
            total_evaluations=on + off, enabled_count=on, disabled_count=off, series=series))
    return FlagAnalytics(flag_id=flag.id, flag_key=flag.key, days=days,
                         total_evaluations=sum(r.total_evaluations for r in env_results), environments=env_results)
