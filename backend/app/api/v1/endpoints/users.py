from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, paginate, require_roles
from app.core.database import get_db
from app.core.permissions import ROLE_ADMIN
from app.core.security import hash_password
from app.models import Role, User
from app.schemas.common import Page
from app.schemas.user import RoleWithCount, UserCreate, UserOut, UserUpdate
from app.services.audit import log_action, user_snapshot

router = APIRouter(tags=["Users & Roles"])
admin_only = require_roles(ROLE_ADMIN)


@router.get("/roles", response_model=list[RoleWithCount], summary="List roles")
def list_roles(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.execute(
        select(Role, func.count(User.id)).outerjoin(User, User.role_id == Role.id).group_by(Role.id).order_by(Role.id)
    ).all()
    return [RoleWithCount(id=r.id, name=r.name, description=r.description, user_count=c) for r, c in rows]


@router.get("/users", response_model=Page[UserOut], summary="List users")
def list_users(
    q: str | None = Query(None, description="Search username, email or name"),
    role_id: int | None = None,
    is_active: bool | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    stmt = select(User).order_by(User.id)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(User.username.ilike(like), User.email.ilike(like), User.full_name.ilike(like)))
    if role_id is not None:
        stmt = stmt.where(User.role_id == role_id)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)
    return paginate(db, stmt, page, size)


def _get_role(db: Session, role_id: int) -> Role:
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Role not found")
    return role


def _get_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED, summary="Create user")
def create_user(payload: UserCreate, request: Request, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    if db.scalar(select(User).where(or_(User.username == payload.username, User.email == payload.email))):
        raise HTTPException(status.HTTP_409_CONFLICT, "Username or email already exists")
    role = _get_role(db, payload.role_id)
    user = User(
        username=payload.username, email=payload.email, full_name=payload.full_name,
        hashed_password=hash_password(payload.password), role=role, is_active=True,
    )
    db.add(user)
    db.flush()
    log_action(db, user=admin, action="USER_CREATED", entity_type="user", entity_id=user.id,
               new_value=user_snapshot(user), description=f"Created user '{user.username}'", request=request)
    db.commit()
    return user


@router.get("/users/{user_id}", response_model=UserOut, summary="Get user")
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(admin_only)):
    return _get_user(db, user_id)


@router.patch("/users/{user_id}", response_model=UserOut, summary="Update user")
def update_user(
    user_id: int, payload: UserUpdate, request: Request,
    db: Session = Depends(get_db), admin: User = Depends(admin_only),
):
    user = _get_user(db, user_id)
    data = payload.model_dump(exclude_unset=True)
    if user.id == admin.id and (data.get("is_active") is False or
                                ("role_id" in data and data["role_id"] != admin.role_id)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot deactivate or change the role of your own account")
    old = user_snapshot(user)

    if data.get("email") and data["email"] != user.email:
        if db.scalar(select(User).where(User.email == data["email"], User.id != user.id)):
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already in use")
        user.email = data["email"]
    if data.get("role_id") is not None:
        user.role = _get_role(db, data["role_id"])
    if "full_name" in data:
        user.full_name = data["full_name"]
    if data.get("is_active") is not None:
        user.is_active = data["is_active"]
    if data.get("password"):
        user.hashed_password = hash_password(data["password"])

    log_action(db, user=admin, action="USER_UPDATED", entity_type="user", entity_id=user.id,
               old_value=old, new_value=user_snapshot(user),
               description=f"Updated user '{user.username}'" + (" (password reset)" if data.get("password") else ""),
               request=request)
    db.commit()
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete user")
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    user = _get_user(db, user_id)
    if user.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot delete your own account")
    log_action(db, user=admin, action="USER_DELETED", entity_type="user", entity_id=user.id,
               old_value=user_snapshot(user), description=f"Deleted user '{user.username}'", request=request)
    db.delete(user)
    db.commit()
