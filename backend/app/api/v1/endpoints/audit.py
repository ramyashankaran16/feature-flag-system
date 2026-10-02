from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import distinct, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, paginate
from app.core.database import get_db
from app.core.utils import to_naive_utc
from app.models import AuditLog, User
from app.schemas.audit import AuditLogOut
from app.schemas.common import Page

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=Page[AuditLogOut], summary="Search the audit trail")
def list_audit_logs(
    action: str | None = None,
    entity_type: str | None = Query(None, description="flag | rollout | environment | user | assignment"),
    user_id: int | None = None,
    flag_id: int | None = None,
    environment_id: int | None = None,
    q: str | None = Query(None, description="Search in description / username"),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(AuditLog).order_by(AuditLog.id.desc())
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if user_id is not None:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if flag_id is not None:
        stmt = stmt.where(AuditLog.flag_id == flag_id)
    if environment_id is not None:
        stmt = stmt.where(AuditLog.environment_id == environment_id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(AuditLog.description.ilike(like) | AuditLog.username.ilike(like))
    if date_from:
        stmt = stmt.where(AuditLog.created_at >= to_naive_utc(date_from))
    if date_to:
        stmt = stmt.where(AuditLog.created_at <= to_naive_utc(date_to))
    return paginate(db, stmt, page, size)


@router.get("/actions", response_model=list[str], summary="Distinct action names (for filter dropdowns)")
def list_actions(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return sorted(db.scalars(select(distinct(AuditLog.action))).all())


@router.get("/{log_id}", response_model=AuditLogOut)
def get_audit_log(log_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    entry = db.get(AuditLog, log_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Audit log not found")
    return entry
