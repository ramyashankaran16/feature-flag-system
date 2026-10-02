# Feature Flag & Environment Management System — Backend

FastAPI service that lets administrators control application features **without redeploying**:
enable/disable flags per environment, roll out gradually by percentage, target specific users,
schedule activations, roll back changes, and audit everything.

**Stack:** Python 3.12 · FastAPI · SQLAlchemy 2 · Alembic · MySQL 8 · Redis 7 · JWT (PyJWT) · bcrypt

---

## 1. Quick start with Docker (recommended)

From the project root (the folder containing `docker-compose.yml`):

```bash
docker compose up --build
```

This starts MySQL, Redis and the API. On start-up the container waits for MySQL,
runs `alembic upgrade head`, then seeds roles, environments, users and demo flags.

| URL | Purpose |
|-----|---------|
| http://localhost:8000/docs | Swagger UI (interactive) |
| http://localhost:8000/redoc | ReDoc |
| http://localhost:8000/health | Health check (DB + Redis) |
| `localhost:3307` (user `ffuser` / `ffpassword`) | MySQL — connect with MySQL Workbench |

### Default accounts

| Username | Password | Role |
|----------|----------|------|
| `admin` | `Admin@123` | Admin |
| `developer` | `Developer@123` | Developer |
| `viewer` | `Viewer@123` | Viewer |

> Change `FIRST_ADMIN_PASSWORD` and `JWT_SECRET_KEY` before deploying anywhere real,
> and set `SEED_DEMO_DATA=false` to skip demo users and flags.

---

## 2. Local development (without Docker for the API)

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt

cp .env.example .env                 # edit DATABASE_URL / REDIS_URL if needed
docker compose up -d mysql redis     # or use your own MySQL 8 + Redis
# if using the compose MySQL from the host, set in .env:
# DATABASE_URL=mysql+pymysql://ffuser:ffpassword@localhost:3307/feature_flags?charset=utf8mb4

alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

### Running tests

```bash
pytest -q
```

Tests use SQLite and run without Redis (proving the fail-open design). 16 tests cover the
evaluation engine, RBAC, flag lifecycle, targeting, scheduling, rollback, auth and dashboard.

### Creating new migrations

```bash
alembic revision --autogenerate -m "describe change"
alembic upgrade head
```

---

## 3. Project structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI app, CORS, Swagger metadata, scheduler lifecycle
│   ├── seed.py                  # Idempotent seed data
│   ├── wait_for_services.py     # Docker start-up helper
│   ├── core/                    # config, database, security (JWT/bcrypt), redis, RBAC
│   ├── models/                  # SQLAlchemy models (7 tables)
│   ├── schemas/                 # Pydantic request/response models
│   ├── services/                # evaluation engine, analytics, audit, scheduler, token store
│   └── api/
│       ├── deps.py              # auth / RBAC / API-key dependencies, pagination
│       └── v1/endpoints/        # auth, users, environments, flags, rollouts,
│                                # assignments, evaluate, analytics, dashboard, audit
├── alembic/                     # migrations (0001_initial_schema.py)
├── tests/
├── postman/FeatureFlagSystem.postman_collection.json
├── Dockerfile, entrypoint.sh, requirements.txt, .env.example
```

---

## 4. Database schema

| Table | Purpose |
|-------|---------|
| `roles` | Admin, Developer, Viewer |
| `users` | Platform users (bcrypt-hashed passwords, role, active flag) |
| `environments` | development / testing / production; each has an **API key** and `is_protected` |
| `feature_flags` | Flag definition: immutable `key`, name, description, archived state |
| `feature_rollouts` | **One row per flag × environment**: enabled, rollout %, scheduled enable/disable, version |
| `user_assignments` | Per-user overrides (force ON / force OFF) per flag × environment |
| `audit_logs` | Every change with before/after JSON snapshots, user, IP, timestamp |

```
roles 1─* users
feature_flags 1─* feature_rollouts *─1 environments
feature_flags 1─* user_assignments *─1 environments
audit_logs → users (flag_id / environment_id kept as plain ints so history survives deletes)
```

All timestamps are stored in **UTC**; the API returns them as ISO-8601 with a trailing `Z`.

---

## 5. Role-based access control

| Capability | Admin | Developer | Viewer |
|-----------|:-----:|:---------:|:------:|
| View flags, rollouts, dashboard, analytics, audit logs | ✅ | ✅ | ✅ |
| Create / edit / archive flags | ✅ | ✅ | ❌ |
| Change rollouts & targeting in **non-protected** envs | ✅ | ✅ | ❌ |
| Change rollouts & targeting in **protected** envs (Production) | ✅ | ❌ | ❌ |
| Delete flags | ✅ | ❌ | ❌ |
| Manage environments & API keys | ✅ | ❌ (keys masked) | ❌ (keys masked) |
| Manage users | ✅ | ❌ | ❌ |

---

## 6. How flag evaluation works

Client applications call `/api/v1/evaluate` with the environment's API key in the
`X-Environment-Key` header. The engine checks, in order:

1. **Flag missing or archived** → `OFF` (`FLAG_NOT_FOUND`, `FLAG_ARCHIVED`)
2. **Disabled in this environment** → `OFF` (`DISABLED`, or `SCHEDULED` if an activation is pending).
   This is the kill switch: when disabled, nobody gets the feature.
3. **User assignment** → forced `ON` (`USER_TARGETED`) or `OFF` (`USER_EXCLUDED`)
4. **Percentage rollout** → `sha256(flag_key:user_id) % 100 < percentage`
   (`FULL_ROLLOUT`, `ROLLOUT_INCLUDED`, `ROLLOUT_EXCLUDED`, `NO_USER_CONTEXT`)

Bucketing is **sticky and monotonic**: the same user always gets the same answer, and increasing
the percentage from 20% to 50% only *adds* users; nobody who had the feature loses it.

**Beta-tester pattern:** enable the flag with `rollout_percentage = 0` and add user assignments.
Only the assigned users see the feature.

### Example client usage

```bash
curl -X POST http://localhost:8000/api/v1/evaluate \
  -H "X-Environment-Key: <development api key>" \
  -H "Content-Type: application/json" \
  -d '{"flag_key": "new-checkout-flow", "user_id": "customer-123"}'
# {"flag_key":"new-checkout-flow","environment":"development","user_id":"customer-123",
#  "enabled":true,"reason":"FULL_ROLLOUT"}
```

```python
import requests

API = "http://localhost:8000/api/v1"
HEADERS = {"X-Environment-Key": "ffk_producti_..."}

# At app start-up, fetch every flag for this user in one call
flags = requests.post(f"{API}/evaluate/bulk/all", json={"user_id": "customer-123"},
                      headers=HEADERS, timeout=2).json()["flags"]
if flags.get("new-checkout-flow"):
    render_new_checkout()
else:
    render_old_checkout()
```

---

## 7. Key features and where they live

| Requirement | Implementation |
|-------------|----------------|
| Secure login & JWT | `POST /auth/login` (OAuth2 form) → access (30 min) + refresh (7 days) tokens. Refresh tokens rotate (single use); `POST /auth/logout` revokes tokens via Redis. Login is locked for 15 min after 5 failed attempts. |
| RBAC | `require_roles(...)` dependency + `ensure_env_write_access` for protected envs |
| Flag CRUD | `/flags` — creating a flag creates a disabled rollout in every environment |
| Enable/disable | `POST /rollouts/{id}/toggle` or `PATCH /rollouts/{id}` |
| Scheduled activation | `PATCH /rollouts/{id}` with `scheduled_enable_at` / `scheduled_disable_at`. A background job (every 30 s, Redis-locked so it's safe with multiple replicas) applies due schedules; evaluation also honours them instantly. |
| Environments | `/environments` — create, update, rotate API key, delete |
| Percentage rollouts | `rollout_percentage` 0-100 on each rollout |
| User-specific access | `/flags/{id}/assignments` (single, bulk, delete) |
| Usage analytics | Every evaluation increments daily Redis counters (ON/OFF + unique users via HyperLogLog). `/analytics/overview`, `/analytics/flags/{id}` |
| Rollback | `POST /rollouts/{id}/rollback` — undo last change, restore state before a given audit entry (`audit_log_id`), or restore a version (`to_version`). Each rollout keeps a `version` counter. |
| Audit logs | Every mutation writes an `audit_logs` row with old/new snapshots. `/audit-logs` supports filters by action, entity, user, flag, env, date range and text. |
| Dashboard | `GET /dashboard/stats` — totals, per-environment stats, rollout distribution, 7-day evaluation trend, top flags, upcoming schedules, recent activity |

### Caching & resilience

Flag configurations are cached in Redis per environment (`ff:cfg:{env}:{flag}`, TTL 60 s) and
**invalidated immediately** on every change, so toggles take effect instantly. If Redis is
unavailable the API keeps working: evaluations read from MySQL, and only caching, analytics,
login throttling and token revocation are temporarily degraded.

---

## 8. API reference (prefix `/api/v1`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/login` | – | Login (form: `username`, `password`) |
| POST | `/auth/refresh` | – | New tokens from refresh token |
| POST | `/auth/logout` | JWT | Revoke tokens |
| GET | `/auth/me` | JWT | Current user |
| POST | `/auth/change-password` | JWT | Change own password |
| GET | `/roles` | JWT | Roles with user counts |
| GET/POST | `/users` | Admin | List / create users |
| GET/PATCH/DELETE | `/users/{id}` | Admin | Get / update / delete user |
| GET/POST | `/environments` | JWT / Admin | List / create environments |
| GET/PATCH/DELETE | `/environments/{id}` | JWT / Admin | Get / update / delete |
| POST | `/environments/{id}/regenerate-key` | Admin | Rotate API key |
| GET/POST | `/flags` | JWT / Editor | List (search, paginate) / create |
| GET/PATCH/DELETE | `/flags/{id}` | JWT / Editor / Admin | Get / update / delete |
| POST | `/flags/{id}/archive`, `/flags/{id}/restore` | Editor | Archive / restore |
| GET | `/flags/{id}/history` | JWT | Flag change history |
| GET | `/rollouts` | JWT | Filter by `flag_id`, `environment_id`, `scheduled_only` |
| GET/PATCH | `/rollouts/{id}` | JWT / Editor | Get / update state, %, schedule |
| POST | `/rollouts/{id}/toggle` | Editor | Flip enabled |
| POST | `/rollouts/{id}/rollback` | Editor | Roll back |
| GET | `/rollouts/{id}/history` | JWT | Versions / history |
| POST | `/rollouts/scheduler/run` | Admin | Apply due schedules now |
| GET/POST | `/flags/{id}/assignments` | JWT / Editor | List / add user override |
| POST | `/flags/{id}/assignments/bulk` | Editor | Bulk add |
| DELETE | `/assignments/{id}` | Editor | Remove override |
| POST | `/evaluate` | Env key | Evaluate one flag |
| GET | `/evaluate/{flag_key}?user_id=` | Env key | Evaluate one flag |
| POST | `/evaluate/bulk/all` | Env key | Evaluate all flags for a user |
| POST | `/evaluate/test/run` | JWT | Dashboard test tool (not tracked) |
| GET | `/analytics/overview` | JWT | Trend + top flags |
| GET | `/analytics/flags/{id}` | JWT | Per-flag daily usage per env |
| GET | `/dashboard/stats` | JWT | Dashboard statistics |
| GET | `/audit-logs` | JWT | Search audit trail |
| GET | `/audit-logs/actions` | JWT | Distinct actions |
| GET | `/audit-logs/{id}` | JWT | Single entry |

*Editor = Admin or Developer.* Full request/response schemas are in Swagger at `/docs`.

---

## 9. Postman

Import `postman/FeatureFlagSystem.postman_collection.json`.

1. Run **Authentication → Login (Admin)**; the token is saved automatically.
2. Run **Environments → List environments**; the Development API key is saved as `envApiKey`.
3. Run **Feature Flags → Create flag**; `flagId` and `rolloutId` are saved for the following requests.

---

## 10. Environment variables

See `.env.example`. The most important ones:

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `mysql+pymysql://ffuser:ffpassword@localhost:3306/feature_flags?charset=utf8mb4` | |
| `REDIS_URL` | `redis://localhost:6379/0` | |
| `JWT_SECRET_KEY` | *(placeholder)* | **Must be changed** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | |
| `CORS_ORIGINS` | `["http://localhost:5173","http://localhost:3000"]` | JSON list; Vite dev server included |
| `SCHEDULER_INTERVAL_SECONDS` | `30` | |
| `CACHE_TTL_SECONDS` | `60` | |
| `ANALYTICS_RETENTION_DAYS` | `90` | |
| `SEED_DEMO_DATA` | `true` | |
