"""Shared FastAPI dependencies: DB session, JWT user, RBAC, environment API key."""
from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import ACCESS_TOKEN, decode_token
from app.core.utils import total_pages
from app.models import Environment, User
from app.services.token_store import is_token_revoked

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")
environment_key_header = APIKeyHeader(
    name="X-Environment-Key", auto_error=False,
    description="Environment API key used by client applications to evaluate flags",
)

_credentials_error = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_token_payload(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = decode_token(token, ACCESS_TOKEN)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token has expired", headers={"WWW-Authenticate": "Bearer"})
    except jwt.PyJWTError:
        raise _credentials_error
    if is_token_revoked(payload.get("jti")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token has been revoked", headers={"WWW-Authenticate": "Bearer"})
    return payload


def get_current_user(payload: dict = Depends(get_token_payload), db: Session = Depends(get_db)) -> User:
    try:
        user = db.get(User, int(payload["sub"]))
    except (KeyError, ValueError):
        raise _credentials_error
    if user is None:
        raise _credentials_error
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")
    return user


def require_roles(*roles: str) -> Callable[..., User]:
    """Dependency factory: allow only users whose role is in `roles`."""
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role.name not in roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"This action requires one of the roles: {', '.join(roles)}",
            )
        return user
    return checker


def get_environment_from_api_key(
    api_key: str | None = Security(environment_key_header), db: Session = Depends(get_db)
) -> Environment:
    if not api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing X-Environment-Key header")
    env = db.scalar(select(Environment).where(Environment.api_key == api_key))
    if env is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid environment API key")
    return env


def paginate(db: Session, stmt, page: int, size: int, options: tuple = ()) -> dict:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    items = db.scalars(stmt.options(*options).offset((page - 1) * size).limit(size)).unique().all()
    return {"items": items, "total": total, "page": page, "size": size, "pages": total_pages(total, size)}
