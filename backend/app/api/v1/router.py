from fastapi import APIRouter

from app.api.v1.endpoints import (
    analytics, assignments, audit, auth, dashboard, environments, evaluate, flags, rollouts, users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(environments.router)
api_router.include_router(flags.router)
api_router.include_router(rollouts.router)
api_router.include_router(assignments.router)
api_router.include_router(evaluate.router)
api_router.include_router(analytics.router)
api_router.include_router(dashboard.router)
api_router.include_router(audit.router)
