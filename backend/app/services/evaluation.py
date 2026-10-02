"""Flag evaluation engine + Redis-backed config cache.

Evaluation order for (flag, environment, user):
  1. Flag missing / archived              -> OFF
  2. Effective enabled state (incl. schedules). If OFF -> OFF (kill switch)
  3. User assignment override             -> ON / OFF for that user
  4. Percentage rollout (sticky hashing)  -> ON if bucket < percentage
"""
import hashlib
import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.redis_client import redis_call
from app.core.utils import iso, parse_iso, utcnow
from app.models import Environment, FeatureFlag, FeatureRollout, UserAssignment

CACHE_PREFIX = "ff:cfg"


@dataclass
class EvaluationResult:
    enabled: bool
    reason: str


def cache_key(env_key: str, flag_key: str) -> str:
    return f"{CACHE_PREFIX}:{env_key}:{flag_key}"


def get_bucket(flag_key: str, user_id: str) -> int:
    """Deterministic bucket 0-99. The same user always lands in the same bucket
    for a given flag, so raising the percentage only ever adds users."""
    digest = hashlib.sha256(f"{flag_key}:{user_id}".encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 100


def build_flag_config(db: Session, environment: Environment, flag_key: str) -> dict:
    flag = db.scalar(select(FeatureFlag).where(FeatureFlag.key == flag_key))
    if flag is None:
        return {"exists": False}
    rollout = db.scalar(
        select(FeatureRollout).where(
            FeatureRollout.flag_id == flag.id, FeatureRollout.environment_id == environment.id
        )
    )
    rows = db.execute(
        select(UserAssignment.user_identifier, UserAssignment.is_enabled).where(
            UserAssignment.flag_id == flag.id, UserAssignment.environment_id == environment.id
        )
    ).all()
    return {
        "exists": True,
        "flag_id": flag.id,
        "archived": flag.is_archived,
        "enabled": bool(rollout and rollout.is_enabled),
        "percentage": rollout.rollout_percentage if rollout else 0,
        "scheduled_enable_at": iso(rollout.scheduled_enable_at) if rollout else None,
        "scheduled_disable_at": iso(rollout.scheduled_disable_at) if rollout else None,
        "assignments": {uid: bool(enabled) for uid, enabled in rows},
    }


def get_flag_config(db: Session, environment: Environment, flag_key: str) -> dict:
    key = cache_key(environment.key, flag_key)
    cached = redis_call(lambda r: r.get(key))
    if cached:
        return json.loads(cached)
    cfg = build_flag_config(db, environment, flag_key)
    redis_call(lambda r: r.setex(key, settings.CACHE_TTL_SECONDS, json.dumps(cfg)))
    return cfg


def evaluate_config(cfg: dict, flag_key: str, user_id: str | None, now: datetime | None = None) -> EvaluationResult:
    now = now or utcnow()
    if not cfg.get("exists"):
        return EvaluationResult(False, "FLAG_NOT_FOUND")
    if cfg.get("archived"):
        return EvaluationResult(False, "FLAG_ARCHIVED")

    enabled = bool(cfg.get("enabled"))
    enable_at = parse_iso(cfg.get("scheduled_enable_at"))
    disable_at = parse_iso(cfg.get("scheduled_disable_at"))
    # Honour schedules immediately, even before the background job persists them
    if enable_at and now >= enable_at:
        enabled = True
    if disable_at and now >= disable_at:
        enabled = False

    if not enabled:
        if enable_at and now < enable_at:
            return EvaluationResult(False, "SCHEDULED")
        return EvaluationResult(False, "DISABLED")

    assignments = cfg.get("assignments") or {}
    if user_id is not None and user_id in assignments:
        return EvaluationResult(True, "USER_TARGETED") if assignments[user_id] else EvaluationResult(False, "USER_EXCLUDED")

    percentage = int(cfg.get("percentage", 0))
    if percentage >= 100:
        return EvaluationResult(True, "FULL_ROLLOUT")
    if percentage <= 0:
        return EvaluationResult(False, "ROLLOUT_EXCLUDED")
    if not user_id:
        return EvaluationResult(False, "NO_USER_CONTEXT")
    if get_bucket(flag_key, user_id) < percentage:
        return EvaluationResult(True, "ROLLOUT_INCLUDED")
    return EvaluationResult(False, "ROLLOUT_EXCLUDED")


def invalidate_flag_cache(db: Session, flag_key: str) -> None:
    env_keys = db.scalars(select(Environment.key)).all()
    keys = [cache_key(e, flag_key) for e in env_keys]
    if keys:
        redis_call(lambda r: r.delete(*keys))


def invalidate_all_cache() -> None:
    def _clear(r):
        keys = list(r.scan_iter(match=f"{CACHE_PREFIX}:*", count=500))
        if keys:
            r.delete(*keys)
    redis_call(_clear)
