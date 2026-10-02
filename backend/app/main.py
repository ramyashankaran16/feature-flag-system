"""FastAPI application entry point."""
import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import engine
from app.core.redis_client import redis_ping
from app.services.scheduler import scheduler_loop

logging.basicConfig(level=logging.DEBUG if settings.DEBUG else logging.INFO,
                    format="%(asctime)s %(levelname)s [%(name)s] %(message)s")

DESCRIPTION = """
Centralised platform to control application features **without redeploying**.

### Authentication
* **Dashboard / management APIs** — JWT Bearer. Click **Authorize** and log in with
  username & password (default `admin` / `Admin@123`).
* **Client evaluation APIs** (`/evaluate`) — send the environment API key in the
  `X-Environment-Key` header.

### Roles
| Role | Permissions |
|------|-------------|
| Admin | Everything, including users, environments and protected (production) environments |
| Developer | Create/edit flags, rollouts, targeting in non-protected environments |
| Viewer | Read-only |

### Evaluation order
1. Flag missing/archived → **OFF**  2. Disabled (incl. schedules) → **OFF**
3. User assignment → forced **ON/OFF**  4. Percentage rollout (sticky hashing)
"""

TAGS = [
    {"name": "Authentication", "description": "Login, token refresh, logout, profile"},
    {"name": "Users & Roles", "description": "Platform user management (Admin)"},
    {"name": "Environments", "description": "Development / Testing / Production and API keys"},
    {"name": "Feature Flags", "description": "Create, update, archive and delete flags"},
    {"name": "Rollouts & Scheduling", "description": "Enable/disable, % rollout, schedules, rollback"},
    {"name": "User Targeting", "description": "User-specific feature access"},
    {"name": "Flag Evaluation (Client SDK)", "description": "Used by your applications at runtime"},
    {"name": "Analytics", "description": "Feature usage analytics"},
    {"name": "Dashboard", "description": "Aggregated statistics"},
    {"name": "Audit Logs", "description": "Change history"},
    {"name": "Health", "description": "Service health"},
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(scheduler_loop()) if settings.SCHEDULER_ENABLED else None
    yield
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=DESCRIPTION,
    openapi_tags=TAGS,
    lifespan=lifespan,
    swagger_ui_parameters={"persistAuthorization": True, "docExpansion": "none"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["Health"], summary="Liveness / readiness check")
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception:  # pragma: no cover
        db_status = "unavailable"
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": db_status,
        "redis": "ok" if redis_ping() else "unavailable",
        "version": settings.APP_VERSION,
    }


@app.get("/", include_in_schema=False)
def root():
    return {"name": settings.APP_NAME, "docs": "/docs", "redoc": "/redoc", "health": "/health"}
