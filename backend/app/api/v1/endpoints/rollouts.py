from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, paginate, require_roles
from app.core.database import get_db
from app.core.permissions import EDITOR_ROLES, ROLE_ADMIN, ensure_env_write_access
from app.core.utils import parse_iso, utcnow
from app.models import AuditLog, FeatureRollout, User
from app.schemas.audit import AuditLogOut
from app.schemas.common import Message, Page
from app.schemas.rollout import RollbackRequest, RolloutOut, RolloutUpdate
from app.services.audit import log_action, rollout_snapshot, rollout_state
from app.services.evaluation import invalidate_flag_cache
from app.services.scheduler import run_scheduled_jobs

router = APIRouter(prefix="/rollouts", tags=["Rollouts & Scheduling"])
editors = require_roles(*EDITOR_ROLES)


def _get_rollout(db: Session, rollout_id: int) -> FeatureRollout:
    ro = db.get(FeatureRollout, rollout_id)
    if ro is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Rollout not found")
    return ro


def _validate_schedule(ro: FeatureRollout) -> None:
    if ro.scheduled_enable_at and ro.scheduled_disable_at and ro.scheduled_disable_at <= ro.scheduled_enable_at:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "scheduled_disable_at must be after scheduled_enable_at")


def _describe(old: dict, new: dict) -> tuple[str, str]:
    """Pick an audit action + human description for a rollout change."""
    changes = []
    if old["is_enabled"] != new["is_enabled"]:
        changes.append("enabled" if new["is_enabled"] else "disabled")
    if old["rollout_percentage"] != new["rollout_percentage"]:
        changes.append(f"rollout {old['rollout_percentage']}% → {new['rollout_percentage']}%")
    if old["scheduled_enable_at"] != new["scheduled_enable_at"]:
        changes.append(f"enable scheduled at {new['scheduled_enable_at']}" if new["scheduled_enable_at"]
                       else "enable schedule cleared")
    if old["scheduled_disable_at"] != new["scheduled_disable_at"]:
        changes.append(f"disable scheduled at {new['scheduled_disable_at']}" if new["scheduled_disable_at"]
                       else "disable schedule cleared")
    only_toggle = len(changes) == 1 and old["is_enabled"] != new["is_enabled"]
    if only_toggle:
        action = "FLAG_ENABLED" if new["is_enabled"] else "FLAG_DISABLED"
    elif old["scheduled_enable_at"] != new["scheduled_enable_at"] or old["scheduled_disable_at"] != new["scheduled_disable_at"]:
        action = "SCHEDULE_UPDATED"
    else:
        action = "ROLLOUT_UPDATED"
    return action, f"'{new['flag_key']}' in {new['environment']}: " + ", ".join(changes)


def _commit_change(db: Session, ro: FeatureRollout, old: dict, user: User, request: Request,
                   action: str | None = None, description: str | None = None) -> FeatureRollout:
    ro.version += 1
    ro.updated_by_id = user.id
    db.flush()
    db.refresh(ro)
    new = rollout_snapshot(ro)
    auto_action, auto_desc = _describe(old, new)
    log_action(db, user=user, action=action or auto_action, entity_type="rollout", entity_id=ro.id,
               flag_id=ro.flag_id, environment_id=ro.environment_id, old_value=old, new_value=new,
               description=description or auto_desc, request=request)
    db.commit()
    invalidate_flag_cache(db, ro.flag.key)
    return ro


@router.post("/scheduler/run", response_model=Message, summary="Run the scheduler now (Admin)")
def run_scheduler_now(_: User = Depends(require_roles(ROLE_ADMIN))):
    changed = run_scheduled_jobs()
    return Message(message=f"Applied {changed} scheduled change(s)")


@router.get("", response_model=list[RolloutOut], summary="List rollouts (filter by flag and/or environment)")
def list_rollouts(
    flag_id: int | None = None, environment_id: int | None = None,
    scheduled_only: bool = Query(False, description="Only rollouts with a pending schedule"),
    db: Session = Depends(get_db), _: User = Depends(get_current_user),
):
    stmt = select(FeatureRollout).order_by(FeatureRollout.flag_id, FeatureRollout.environment_id)
    if flag_id is not None:
        stmt = stmt.where(FeatureRollout.flag_id == flag_id)
    if environment_id is not None:
        stmt = stmt.where(FeatureRollout.environment_id == environment_id)
    if scheduled_only:
        stmt = stmt.where((FeatureRollout.scheduled_enable_at.is_not(None)) |
                          (FeatureRollout.scheduled_disable_at.is_not(None)))
    return db.scalars(stmt).unique().all()


@router.get("/{rollout_id}", response_model=RolloutOut)
def get_rollout(rollout_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return _get_rollout(db, rollout_id)


@router.patch("/{rollout_id}", response_model=RolloutOut,
              summary="Enable/disable, set rollout % and schedule activation/deactivation")
def update_rollout(rollout_id: int, payload: RolloutUpdate, request: Request,
                   db: Session = Depends(get_db), user: User = Depends(editors)):
    ro = _get_rollout(db, rollout_id)
    ensure_env_write_access(user, ro.environment)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No changes supplied")

    now = utcnow()
    for field in ("scheduled_enable_at", "scheduled_disable_at"):
        if data.get(field) is not None and data[field] <= now:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{field} must be in the future (UTC)")

    old = rollout_snapshot(ro)
    for field, value in data.items():
        if value is None and field in ("is_enabled", "rollout_percentage"):
            continue  # null is only meaningful for schedule fields
        setattr(ro, field, value)
    _validate_schedule(ro)

    if rollout_state(rollout_snapshot(ro)) == rollout_state(old):
        db.rollback()
        return _get_rollout(db, rollout_id)  # nothing changed -> no new version
    return _commit_change(db, ro, old, user, request)


@router.post("/{rollout_id}/toggle", response_model=RolloutOut, summary="Flip enabled/disabled")
def toggle_rollout(rollout_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(editors)):
    ro = _get_rollout(db, rollout_id)
    ensure_env_write_access(user, ro.environment)
    old = rollout_snapshot(ro)
    ro.is_enabled = not ro.is_enabled
    return _commit_change(db, ro, old, user, request)


@router.post("/{rollout_id}/rollback", response_model=RolloutOut,
             summary="Roll back to a previous state (last change, a specific audit entry, or a version)")
def rollback_rollout(rollout_id: int, request: Request, payload: RollbackRequest | None = None,
                     db: Session = Depends(get_db), user: User = Depends(editors)):
    payload = payload or RollbackRequest()
    ro = _get_rollout(db, rollout_id)
    ensure_env_write_access(user, ro.environment)

    base = select(AuditLog).where(AuditLog.entity_type == "rollout", AuditLog.entity_id == ro.id)
    target: dict | None = None
    label = ""

    if payload.audit_log_id is not None:
        entry = db.scalar(base.where(AuditLog.id == payload.audit_log_id))
        if entry is None or not entry.old_value:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Audit entry not found for this rollout")
        target, label = entry.old_value, f"state before change #{entry.id}"
    elif payload.to_version is not None:
        if payload.to_version >= ro.version:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Current version is {ro.version}; choose an older one")
        for entry in db.scalars(base.order_by(AuditLog.id.desc()).limit(1000)):
            for snap in (entry.new_value, entry.old_value):
                if snap and snap.get("version") == payload.to_version:
                    target = snap
                    break
            if target:
                break
        if target is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Version {payload.to_version} not found in history")
        label = f"version {payload.to_version}"
    else:
        entry = db.scalar(base.where(AuditLog.old_value.is_not(None)).order_by(AuditLog.id.desc()).limit(1))
        if entry is None or not entry.old_value:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "No previous state to roll back to")
        target, label = entry.old_value, "previous state"

    old = rollout_snapshot(ro)
    ro.is_enabled = bool(target.get("is_enabled", False))
    ro.rollout_percentage = int(target.get("rollout_percentage", 100))
    now = utcnow()
    # Past schedules are dropped on rollback so they don't fire unexpectedly
    enable_at, disable_at = parse_iso(target.get("scheduled_enable_at")), parse_iso(target.get("scheduled_disable_at"))
    ro.scheduled_enable_at = enable_at if enable_at and enable_at > now else None
    ro.scheduled_disable_at = disable_at if disable_at and disable_at > now else None

    return _commit_change(db, ro, old, user, request, action="ROLLBACK",
                          description=f"Rolled back '{ro.flag.key}' in {ro.environment.key} to {label}")


@router.get("/{rollout_id}/history", response_model=Page[AuditLogOut], summary="Change history / versions of a rollout")
def rollout_history(rollout_id: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
                    db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    _get_rollout(db, rollout_id)
    stmt = select(AuditLog).where(AuditLog.entity_type == "rollout", AuditLog.entity_id == rollout_id) \
        .order_by(AuditLog.id.desc())
    return paginate(db, stmt, page, size)
