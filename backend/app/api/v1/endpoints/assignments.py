from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, paginate, require_roles
from app.core.database import get_db
from app.core.permissions import EDITOR_ROLES, ensure_env_write_access
from app.models import Environment, FeatureFlag, User, UserAssignment
from app.schemas.assignment import AssignmentBulkCreate, AssignmentCreate, AssignmentOut
from app.schemas.common import Message, Page
from app.services.audit import assignment_snapshot, log_action
from app.services.evaluation import invalidate_flag_cache

router = APIRouter(tags=["User Targeting"])
editors = require_roles(*EDITOR_ROLES)


def _flag_and_env(db: Session, flag_id: int, env_id: int) -> tuple[FeatureFlag, Environment]:
    flag = db.get(FeatureFlag, flag_id)
    if flag is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feature flag not found")
    env = db.get(Environment, env_id)
    if env is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Environment not found")
    return flag, env


@router.get("/flags/{flag_id}/assignments", response_model=Page[AssignmentOut],
            summary="List user-specific overrides for a flag")
def list_assignments(
    flag_id: int, environment_id: int | None = None, q: str | None = None,
    page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db), _: User = Depends(get_current_user),
):
    stmt = select(UserAssignment).where(UserAssignment.flag_id == flag_id).order_by(UserAssignment.id.desc())
    if environment_id is not None:
        stmt = stmt.where(UserAssignment.environment_id == environment_id)
    if q:
        stmt = stmt.where(UserAssignment.user_identifier.ilike(f"%{q}%"))
    return paginate(db, stmt, page, size)


@router.post("/flags/{flag_id}/assignments", response_model=AssignmentOut, status_code=status.HTTP_201_CREATED,
             summary="Include (is_enabled=true) or exclude (false) a specific user")
def create_assignment(flag_id: int, payload: AssignmentCreate, request: Request,
                      db: Session = Depends(get_db), user: User = Depends(editors)):
    flag, env = _flag_and_env(db, flag_id, payload.environment_id)
    ensure_env_write_access(user, env)
    existing = db.scalar(select(UserAssignment).where(
        UserAssignment.flag_id == flag.id, UserAssignment.environment_id == env.id,
        UserAssignment.user_identifier == payload.user_identifier))
    old = assignment_snapshot(existing) if existing else None
    if existing:  # upsert
        existing.is_enabled = payload.is_enabled
        existing.note = payload.note
        assignment = existing
    else:
        assignment = UserAssignment(flag_id=flag.id, environment_id=env.id, user_identifier=payload.user_identifier,
                                    is_enabled=payload.is_enabled, note=payload.note, created_by_id=user.id)
        db.add(assignment)
    db.flush()
    db.refresh(assignment)
    log_action(db, user=user, action="USER_ASSIGNMENT_UPDATED" if existing else "USER_ASSIGNED",
               entity_type="assignment", entity_id=assignment.id, flag_id=flag.id, environment_id=env.id,
               old_value=old, new_value=assignment_snapshot(assignment),
               description=f"{'Included' if payload.is_enabled else 'Excluded'} user '{payload.user_identifier}' "
                           f"for '{flag.key}' in {env.key}", request=request)
    db.commit()
    invalidate_flag_cache(db, flag.key)
    return assignment


@router.post("/flags/{flag_id}/assignments/bulk", response_model=Message, summary="Add/update many users at once")
def bulk_assign(flag_id: int, payload: AssignmentBulkCreate, request: Request,
                db: Session = Depends(get_db), user: User = Depends(editors)):
    flag, env = _flag_and_env(db, flag_id, payload.environment_id)
    ensure_env_write_access(user, env)
    ids = list(dict.fromkeys(i.strip() for i in payload.user_identifiers if i and i.strip()))
    if not ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No valid user identifiers supplied")
    existing = {a.user_identifier: a for a in db.scalars(select(UserAssignment).where(
        UserAssignment.flag_id == flag.id, UserAssignment.environment_id == env.id,
        UserAssignment.user_identifier.in_(ids)))}
    created = 0
    for uid in ids:
        if uid in existing:
            existing[uid].is_enabled = payload.is_enabled
            existing[uid].note = payload.note
        else:
            db.add(UserAssignment(flag_id=flag.id, environment_id=env.id, user_identifier=uid[:255],
                                  is_enabled=payload.is_enabled, note=payload.note, created_by_id=user.id))
            created += 1
    log_action(db, user=user, action="USERS_BULK_ASSIGNED", entity_type="assignment", flag_id=flag.id,
               environment_id=env.id, new_value={"user_identifiers": ids[:100], "count": len(ids),
                                                 "is_enabled": payload.is_enabled},
               description=f"Bulk {'included' if payload.is_enabled else 'excluded'} {len(ids)} users "
                           f"for '{flag.key}' in {env.key}", request=request)
    db.commit()
    invalidate_flag_cache(db, flag.key)
    return Message(message=f"{created} created, {len(ids) - created} updated")


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(assignment_id: int, request: Request, db: Session = Depends(get_db),
                      user: User = Depends(editors)):
    a = db.get(UserAssignment, assignment_id)
    if a is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    ensure_env_write_access(user, a.environment)
    flag_key = a.flag.key
    log_action(db, user=user, action="USER_UNASSIGNED", entity_type="assignment", entity_id=a.id,
               flag_id=a.flag_id, environment_id=a.environment_id, old_value=assignment_snapshot(a),
               description=f"Removed override for user '{a.user_identifier}' on '{flag_key}'", request=request)
    db.delete(a)
    db.commit()
    invalidate_flag_cache(db, flag_key)
