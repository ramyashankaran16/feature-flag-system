"""Endpoints called by client applications (SDK) to check flags."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_environment_from_api_key
from app.core.database import get_db
from app.models import Environment, FeatureFlag, User
from app.schemas.evaluation import (
    BulkEvaluateRequest, BulkEvaluateResponse, EvaluateRequest, EvaluateResponse,
    TestEvaluateRequest, TestEvaluateResponse,
)
from app.services.analytics import record_evaluation
from app.services.evaluation import evaluate_config, get_bucket, get_flag_config

router = APIRouter(prefix="/evaluate", tags=["Flag Evaluation (Client SDK)"])


def _evaluate(db: Session, env: Environment, flag_key: str, user_id: str | None, track: bool = True):
    cfg = get_flag_config(db, env, flag_key)
    result = evaluate_config(cfg, flag_key, user_id)
    if track and cfg.get("exists"):
        record_evaluation(env.key, flag_key, result.enabled, user_id)
    return result


@router.post("", response_model=EvaluateResponse, summary="Evaluate one flag for a user")
def evaluate(payload: EvaluateRequest, env: Environment = Depends(get_environment_from_api_key),
             db: Session = Depends(get_db)):
    r = _evaluate(db, env, payload.flag_key, payload.user_id)
    return EvaluateResponse(flag_key=payload.flag_key, environment=env.key, user_id=payload.user_id,
                            enabled=r.enabled, reason=r.reason)


@router.get("/{flag_key}", response_model=EvaluateResponse, summary="Evaluate one flag (GET variant)")
def evaluate_get(flag_key: str, user_id: str | None = Query(None, max_length=255),
                 env: Environment = Depends(get_environment_from_api_key), db: Session = Depends(get_db)):
    r = _evaluate(db, env, flag_key, user_id)
    return EvaluateResponse(flag_key=flag_key, environment=env.key, user_id=user_id, enabled=r.enabled, reason=r.reason)


@router.post("/bulk/all", response_model=BulkEvaluateResponse,
             summary="Evaluate every active flag for a user (ideal for app start-up)")
def evaluate_all(payload: BulkEvaluateRequest, env: Environment = Depends(get_environment_from_api_key),
                 db: Session = Depends(get_db)):
    keys = db.scalars(select(FeatureFlag.key).where(FeatureFlag.is_archived.is_(False)).order_by(FeatureFlag.key)).all()
    flags = {k: _evaluate(db, env, k, payload.user_id).enabled for k in keys}
    return BulkEvaluateResponse(environment=env.key, user_id=payload.user_id, flags=flags)


@router.post("/test/run", response_model=TestEvaluateResponse,
             summary="Dashboard test tool — evaluate as a logged-in user (not counted in analytics)")
def evaluate_test(payload: TestEvaluateRequest, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    env = db.scalar(select(Environment).where(Environment.key == payload.environment_key))
    if env is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Environment not found")
    r = _evaluate(db, env, payload.flag_key, payload.user_id, track=False)
    return TestEvaluateResponse(
        flag_key=payload.flag_key, environment=env.key, user_id=payload.user_id, enabled=r.enabled, reason=r.reason,
        bucket=get_bucket(payload.flag_key, payload.user_id) if payload.user_id else None,
    )
