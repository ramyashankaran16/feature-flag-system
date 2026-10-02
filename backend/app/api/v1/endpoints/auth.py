import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_token_payload
from app.core.config import settings
from app.core.database import get_db
from app.core.redis_client import redis_call
from app.core.security import (
    REFRESH_TOKEN, create_access_token, create_refresh_token, decode_token, hash_password, verify_password,
)
from app.core.utils import utcnow
from app.models import User
from app.schemas.auth import ChangePasswordRequest, LogoutRequest, RefreshRequest, TokenResponse
from app.schemas.common import Message
from app.schemas.user import UserOut
from app.services.audit import log_action
from app.services.token_store import is_token_revoked, revoke_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.role.name),
        refresh_token=create_refresh_token(user.id),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse, summary="Login with username/email and password")
def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """OAuth2 password flow (form-encoded `username` & `password`).
    `username` may be either the username or the e-mail address."""
    identifier = form.username.strip()
    fail_key = f"ff:login:fail:{identifier.lower()}"

    attempts = redis_call(lambda r: r.get(fail_key))
    if attempts and int(attempts) >= settings.LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Too many failed attempts. Try again in {settings.LOGIN_LOCKOUT_MINUTES} minutes.",
        )

    user = db.scalar(select(User).where(or_(User.username == identifier, User.email == identifier.lower())))
    if user is None or not verify_password(form.password, user.hashed_password):
        def _fail(r):
            pipe = r.pipeline()
            pipe.incr(fail_key)
            pipe.expire(fail_key, settings.LOGIN_LOCKOUT_MINUTES * 60)
            pipe.execute()
        redis_call(_fail)
        log_action(db, action="LOGIN_FAILED", entity_type="user", entity_id=user.id if user else None,
                   username=identifier[:50], description=f"Failed sign-in attempt for '{identifier[:50]}'", request=request)
        db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect username or password",
                            headers={"WWW-Authenticate": "Bearer"})

    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")

    redis_call(lambda r: r.delete(fail_key))
    user.last_login_at = utcnow()
    log_action(db, user=user, action="LOGIN", entity_type="user", entity_id=user.id,
               description=f"{user.username} signed in", request=request)
    db.commit()
    return _token_response(user)


@router.post("/refresh", response_model=TokenResponse, summary="Exchange a refresh token for new tokens")
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token, REFRESH_TOKEN)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")
    if is_token_revoked(data.get("jti")):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Refresh token has been revoked")
    user = db.get(User, int(data["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    revoke_token(data)  # rotation: each refresh token is single-use
    return _token_response(user)


@router.post("/logout", response_model=Message, summary="Revoke the current access (and refresh) token")
def logout(
    request: Request,
    body: LogoutRequest | None = None,
    token_payload: dict = Depends(get_token_payload),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    revoke_token(token_payload)
    if body and body.refresh_token:
        try:
            revoke_token(decode_token(body.refresh_token, REFRESH_TOKEN))
        except jwt.PyJWTError:
            pass
    log_action(db, user=user, action="LOGOUT", entity_type="user", entity_id=user.id,
               description=f"{user.username} signed out", request=request)
    db.commit()
    return Message(message="Logged out successfully")


@router.get("/me", response_model=UserOut, summary="Current user profile")
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/change-password", response_model=Message)
def change_password(
    payload: ChangePasswordRequest, request: Request,
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.hashed_password = hash_password(payload.new_password)
    log_action(db, user=user, action="PASSWORD_CHANGED", entity_type="user", entity_id=user.id,
               description=f"{user.username} changed their password", request=request)
    db.commit()
    return Message(message="Password changed successfully")
