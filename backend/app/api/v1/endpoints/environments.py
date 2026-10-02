from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.core.permissions import ROLE_ADMIN
from app.core.utils import generate_api_key, mask_secret
from app.models import Environment, FeatureFlag, FeatureRollout, User
from app.schemas.environment import EnvironmentCreate, EnvironmentOut, EnvironmentUpdate
from app.services.audit import environment_snapshot, log_action
from app.services.evaluation import invalidate_all_cache

router = APIRouter(prefix="/environments", tags=["Environments"])
admin_only = require_roles(ROLE_ADMIN)


def _out(env: Environment, user: User) -> EnvironmentOut:
    out = EnvironmentOut.model_validate(env)
    if user.role.name != ROLE_ADMIN:
        out.api_key = mask_secret(env.api_key)
    return out


def _get_env(db: Session, env_id: int) -> Environment:
    env = db.get(Environment, env_id)
    if env is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Environment not found")
    return env


@router.get("", response_model=list[EnvironmentOut], summary="List environments (API keys masked for non-admins)")
def list_environments(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    envs = db.scalars(select(Environment).order_by(Environment.id)).all()
    return [_out(e, user) for e in envs]


@router.get("/{env_id}", response_model=EnvironmentOut)
def get_environment(env_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _out(_get_env(db, env_id), user)


@router.post("", response_model=EnvironmentOut, status_code=status.HTTP_201_CREATED,
             summary="Create environment (creates a disabled rollout for every existing flag)")
def create_environment(payload: EnvironmentCreate, request: Request,
                       db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    if db.scalar(select(Environment).where(or_(Environment.key == payload.key, Environment.name == payload.name))):
        raise HTTPException(status.HTTP_409_CONFLICT, "Environment name or key already exists")
    env = Environment(**payload.model_dump(), api_key=generate_api_key(f"ffk_{payload.key[:8]}"))
    db.add(env)
    db.flush()
    for flag_id in db.scalars(select(FeatureFlag.id)).all():
        db.add(FeatureRollout(flag_id=flag_id, environment_id=env.id, is_enabled=False,
                              rollout_percentage=100, updated_by_id=admin.id))
    log_action(db, user=admin, action="ENVIRONMENT_CREATED", entity_type="environment", entity_id=env.id,
               environment_id=env.id, new_value=environment_snapshot(env),
               description=f"Created environment '{env.name}'", request=request)
    db.commit()
    return _out(env, admin)


@router.patch("/{env_id}", response_model=EnvironmentOut)
def update_environment(env_id: int, payload: EnvironmentUpdate, request: Request,
                       db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    env = _get_env(db, env_id)
    data = payload.model_dump(exclude_unset=True)
    if data.get("name") and data["name"] != env.name and \
            db.scalar(select(Environment).where(Environment.name == data["name"])):
        raise HTTPException(status.HTTP_409_CONFLICT, "Environment name already exists")
    old = environment_snapshot(env)
    for field, value in data.items():
        if value is not None or field == "description":
            setattr(env, field, value)
    log_action(db, user=admin, action="ENVIRONMENT_UPDATED", entity_type="environment", entity_id=env.id,
               environment_id=env.id, old_value=old, new_value=environment_snapshot(env),
               description=f"Updated environment '{env.name}'", request=request)
    db.commit()
    return _out(env, admin)


@router.post("/{env_id}/regenerate-key", response_model=EnvironmentOut,
             summary="Rotate the environment API key (old key stops working immediately)")
def regenerate_key(env_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    env = _get_env(db, env_id)
    env.api_key = generate_api_key(f"ffk_{env.key[:8]}")
    log_action(db, user=admin, action="API_KEY_ROTATED", entity_type="environment", entity_id=env.id,
               environment_id=env.id, description=f"Rotated API key for '{env.name}'", request=request)
    db.commit()
    return _out(env, admin)


@router.delete("/{env_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_environment(env_id: int, request: Request, db: Session = Depends(get_db), admin: User = Depends(admin_only)):
    env = _get_env(db, env_id)
    log_action(db, user=admin, action="ENVIRONMENT_DELETED", entity_type="environment", entity_id=env.id,
               environment_id=env.id, old_value=environment_snapshot(env),
               description=f"Deleted environment '{env.name}'", request=request)
    db.delete(env)
    db.commit()
    invalidate_all_cache()
