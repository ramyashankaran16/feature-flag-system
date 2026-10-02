from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, paginate, require_roles
from app.core.database import get_db
from app.core.permissions import EDITOR_ROLES, ROLE_ADMIN
from app.models import AuditLog, Environment, FeatureFlag, FeatureRollout, User
from app.schemas.audit import AuditLogOut
from app.schemas.common import Page
from app.schemas.flag import FlagCreate, FlagOut, FlagUpdate
from app.services.audit import flag_snapshot, log_action
from app.services.evaluation import invalidate_flag_cache

router = APIRouter(prefix="/flags", tags=["Feature Flags"])
editors = require_roles(*EDITOR_ROLES)

FLAG_LOAD = (selectinload(FeatureFlag.rollouts).selectinload(FeatureRollout.flag),)


def get_flag_or_404(db: Session, flag_id: int) -> FeatureFlag:
    flag = db.scalar(select(FeatureFlag).where(FeatureFlag.id == flag_id).options(*FLAG_LOAD))
    if flag is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feature flag not found")
    return flag


@router.get("", response_model=Page[FlagOut], summary="List flags with their per-environment rollouts")
def list_flags(
    q: str | None = Query(None, description="Search key, name or description"),
    archived: bool | None = Query(False, description="true = only archived, false = only active, omit = all"),
    environment_id: int | None = Query(None, description="Only flags ENABLED in this environment"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(FeatureFlag).order_by(FeatureFlag.created_at.desc(), FeatureFlag.id.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(FeatureFlag.key.ilike(like), FeatureFlag.name.ilike(like),
                              FeatureFlag.description.ilike(like)))
    if archived is not None:
        stmt = stmt.where(FeatureFlag.is_archived == archived)
    if environment_id is not None:
        stmt = stmt.where(FeatureFlag.id.in_(
            select(FeatureRollout.flag_id).where(FeatureRollout.environment_id == environment_id,
                                                 FeatureRollout.is_enabled.is_(True))))
    return paginate(db, stmt, page, size, options=FLAG_LOAD)


@router.post("", response_model=FlagOut, status_code=status.HTTP_201_CREATED,
             summary="Create a flag (disabled in every environment)")
def create_flag(payload: FlagCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(editors)):
    if db.scalar(select(FeatureFlag).where(FeatureFlag.key == payload.key)):
        raise HTTPException(status.HTTP_409_CONFLICT, f"Flag key '{payload.key}' already exists")
    flag = FeatureFlag(key=payload.key, name=payload.name, description=payload.description, created_by_id=user.id)
    db.add(flag)
    db.flush()
    for env_id in db.scalars(select(Environment.id).order_by(Environment.id)).all():
        db.add(FeatureRollout(flag_id=flag.id, environment_id=env_id, is_enabled=False,
                              rollout_percentage=100, updated_by_id=user.id))
    log_action(db, user=user, action="FLAG_CREATED", entity_type="flag", entity_id=flag.id, flag_id=flag.id,
               new_value=flag_snapshot(flag), description=f"Created flag '{flag.key}'", request=request)
    db.commit()
    invalidate_flag_cache(db, flag.key)
    db.expire(flag)
    return get_flag_or_404(db, flag.id)


@router.get("/{flag_id}", response_model=FlagOut)
def get_flag(flag_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_flag_or_404(db, flag_id)


@router.patch("/{flag_id}", response_model=FlagOut, summary="Update flag name/description (key is immutable)")
def update_flag(flag_id: int, payload: FlagUpdate, request: Request,
                db: Session = Depends(get_db), user: User = Depends(editors)):
    flag = get_flag_or_404(db, flag_id)
    old = flag_snapshot(flag)
    data = payload.model_dump(exclude_unset=True)
    if data.get("name"):
        flag.name = data["name"]
    if "description" in data:
        flag.description = data["description"]
    log_action(db, user=user, action="FLAG_UPDATED", entity_type="flag", entity_id=flag.id, flag_id=flag.id,
               old_value=old, new_value=flag_snapshot(flag), description=f"Updated flag '{flag.key}'", request=request)
    db.commit()
    return flag


def _set_archived(flag_id: int, archived: bool, request: Request, db: Session, user: User) -> FeatureFlag:
    flag = get_flag_or_404(db, flag_id)
    if flag.is_archived == archived:
        return flag
    old = flag_snapshot(flag)
    flag.is_archived = archived
    action = "FLAG_ARCHIVED" if archived else "FLAG_RESTORED"
    log_action(db, user=user, action=action, entity_type="flag", entity_id=flag.id, flag_id=flag.id,
               old_value=old, new_value=flag_snapshot(flag),
               description=f"{'Archived' if archived else 'Restored'} flag '{flag.key}'", request=request)
    db.commit()
    invalidate_flag_cache(db, flag.key)
    return flag


@router.post("/{flag_id}/archive", response_model=FlagOut, summary="Archive a flag (evaluates to OFF everywhere)")
def archive_flag(flag_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(editors)):
    return _set_archived(flag_id, True, request, db, user)


@router.post("/{flag_id}/restore", response_model=FlagOut, summary="Restore an archived flag")
def restore_flag(flag_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(editors)):
    return _set_archived(flag_id, False, request, db, user)


@router.delete("/{flag_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Permanently delete a flag (Admin)")
def delete_flag(flag_id: int, request: Request, db: Session = Depends(get_db),
                user: User = Depends(require_roles(ROLE_ADMIN))):
    flag = get_flag_or_404(db, flag_id)
    key = flag.key
    log_action(db, user=user, action="FLAG_DELETED", entity_type="flag", entity_id=flag.id, flag_id=flag.id,
               old_value=flag_snapshot(flag), description=f"Deleted flag '{key}'", request=request)
    db.delete(flag)
    db.commit()
    invalidate_flag_cache(db, key)


@router.get("/{flag_id}/history", response_model=Page[AuditLogOut], summary="Change history of a flag")
def flag_history(
    flag_id: int,
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db), _: User = Depends(get_current_user),
):
    stmt = select(AuditLog).where(AuditLog.flag_id == flag_id).order_by(AuditLog.id.desc())
    return paginate(db, stmt, page, size)
