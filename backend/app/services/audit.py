"""Audit-log writer and entity snapshot helpers (snapshots power rollback)."""
from fastapi import Request
from sqlalchemy.orm import Session

from app.core.utils import iso
from app.models import AuditLog, Environment, FeatureFlag, FeatureRollout, User, UserAssignment


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if forwarded:
        return forwarded[:45]
    return request.client.host if request.client else None


def log_action(
    db: Session,
    *,
    action: str,
    entity_type: str,
    user: User | None = None,
    username: str | None = None,
    entity_id: int | None = None,
    flag_id: int | None = None,
    environment_id: int | None = None,
    old_value: dict | None = None,
    new_value: dict | None = None,
    description: str | None = None,
    request: Request | None = None,
) -> AuditLog:
    """Add an audit entry to the current transaction (caller commits)."""
    entry = AuditLog(
        user_id=user.id if user else None,
        username=(user.username if user else (username or "system"))[:50],
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        flag_id=flag_id,
        environment_id=environment_id,
        old_value=old_value,
        new_value=new_value,
        description=(description or "")[:500] or None,
        ip_address=_client_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:255] if request else None,
    )
    db.add(entry)
    return entry


# ---------- snapshots ----------

def flag_snapshot(f: FeatureFlag) -> dict:
    return {"key": f.key, "name": f.name, "description": f.description, "is_archived": f.is_archived}


def rollout_snapshot(r: FeatureRollout) -> dict:
    return {
        "flag_key": r.flag.key,
        "environment": r.environment.key,
        "is_enabled": r.is_enabled,
        "rollout_percentage": r.rollout_percentage,
        "scheduled_enable_at": iso(r.scheduled_enable_at),
        "scheduled_disable_at": iso(r.scheduled_disable_at),
        "version": r.version,
    }


ROLLOUT_STATE_FIELDS = ("is_enabled", "rollout_percentage", "scheduled_enable_at", "scheduled_disable_at")


def rollout_state(snapshot: dict) -> dict:
    return {k: snapshot.get(k) for k in ROLLOUT_STATE_FIELDS}


def environment_snapshot(e: Environment) -> dict:
    return {"name": e.name, "key": e.key, "description": e.description, "is_protected": e.is_protected}


def user_snapshot(u: User) -> dict:
    return {
        "username": u.username, "email": u.email, "full_name": u.full_name,
        "role": u.role.name if u.role else None, "is_active": u.is_active,
    }


def assignment_snapshot(a: UserAssignment) -> dict:
    return {
        "user_identifier": a.user_identifier, "is_enabled": a.is_enabled, "note": a.note,
        "environment": a.environment.key if a.environment else a.environment_id,
    }
