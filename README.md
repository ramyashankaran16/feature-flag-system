# Feature Flag & Environment Management System

A centralized platform that lets administrators **control application features without redeploying the application**.
Features can be switched on or off per environment, rolled out gradually to a percentage of users, targeted at specific
users, scheduled for automatic activation, rolled back instantly, and audited end to end.

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

---

## Table of contents

1. [Objective](#objective)
2. [Key features](#key-features)
3. [Technology stack](#technology-stack)
4. [System architecture](#system-architecture)
5. [Project structure](#project-structure)
6. [Database design](#database-design)
7. [Role-based access control](#role-based-access-control)
8. [How flag evaluation works](#how-flag-evaluation-works)
9. [Getting started](#getting-started)
10. [Default accounts](#default-accounts)
11. [Environment variables](#environment-variables)
12. [Using the application](#using-the-application)
13. [API reference](#api-reference)
14. [Integrating a client application](#integrating-a-client-application)
15. [API documentation and testing](#api-documentation-and-testing)
16. [Troubleshooting](#troubleshooting)
17. [Deliverables](#deliverables)

---

## Objective

In traditional development, releasing or hiding a feature requires changing code and redeploying the application.
That is slow and risky: if something breaks in production, the only fix is another deployment.

This project **separates feature releases from code deployments**. New code is deployed with features wrapped in
*feature flags*, and authorized people decide from a web dashboard when, where and to whom each feature becomes visible.
Changes reach running applications within seconds, and a faulty feature can be switched off instantly.

**Example:** a team builds a new checkout page.

1. The code is deployed with the flag `new-checkout-flow` switched **off**.
2. The admin turns it **on in Testing** so QA can verify it.
3. In **Production**, it is enabled for **10%** of customers, then 50%, then 100%.
4. If errors appear, the admin switches it **off** with one click. No redeploy is needed.

---

## Key features

| Requirement | Implementation |
|---|---|
| **Secure login & JWT authentication** | Access tokens (30 min) and refresh tokens (7 days), bcrypt password hashing, single-use refresh tokens (rotation), token revocation on logout, account lockout after 5 failed logins |
| **Role-based access control** | Admin, Developer and Viewer roles enforced on every endpoint; protected environments (Production) can only be changed by Admins |
| **Feature flag creation and management** | Create, edit, archive, restore and delete flags; each new flag is automatically added to every environment, switched off |
| **Enable / disable features** | One-click toggle per environment, from the flag list or the flag detail page |
| **Scheduled feature activation** | Set a start and/or end time; a background scheduler applies it automatically (every 30 seconds) |
| **Environment management** | Development, Testing and Production out of the box; add more; each has its own API key, which can be rotated |
| **Percentage-based rollouts** | 0–100% rollout using deterministic, sticky hashing: a user always gets the same result, and raising the percentage never removes users |
| **User-specific feature access** | Force a feature **on** or **off** for specific users (beta testers, staff), individually or in bulk |
| **Feature usage analytics** | Every flag check is counted per day (served ON / OFF and unique users) and charted |
| **Rollback support** | Every rollout is versioned; undo the last change or restore any earlier version |
| **Audit logs & change history** | Every change is recorded with who, what, when, IP address and a before/after snapshot |
| **Dashboard** | Feature, rollout and environment statistics, usage trends, top flags, upcoming schedules and recent activity |

---

## Technology stack

| Layer | Technologies |
|---|---|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2, Alembic, PyJWT, bcrypt, Pydantic 2 |
| **Frontend** | React 18, Vite, TypeScript, Material UI 6, Axios, React Router 6, Chart.js 4 |
| **Database** | MySQL 8.0 |
| **Cache & analytics** | Redis 7 |
| **DevOps & tools** | Docker, Docker Compose, nginx, VS Code, GitHub, MySQL Workbench, Postman, Swagger |

---

## System architecture

The system follows a **three-tier architecture**: presentation (React), application (FastAPI) and data (MySQL + Redis).

```mermaid
flowchart TB
    subgraph Users
        A[Admin / Developer / Viewer<br/>Web browser]
        C[Client applications<br/>Website, mobile app]
    end

    A --> F[React frontend<br/>Vite, MUI, Chart.js]
    F -- REST API + JWT --> B
    C -- X-Environment-Key --> E

    subgraph B[FastAPI backend]
        AUTH[Auth & RBAC]
        API[API endpoints]
        E[Evaluate API]
        SVC[Service layer<br/>evaluation, audit, analytics]
        SCH[Scheduler<br/>every 30 s]
    end

    SVC --> DB[(MySQL 8.0<br/>7 tables)]
    SVC --> R[(Redis<br/>cache, analytics, tokens)]
    SCH --> DB
```

There are **two ways into the system**:

* **People managing flags** use the React dashboard. Every request carries a **JWT token**, and the backend checks the
  user's role before allowing any action.
* **Applications using flags** call the **Evaluate API** with an **environment API key** and ask:
  *"Is `new-checkout-flow` on for user `customer-123`?"*

**MySQL** is the permanent source of truth. **Redis** keeps the system fast: it caches flag settings (cleared instantly
on every change), stores usage counters, blocks revoked tokens, throttles failed logins and ensures scheduled changes
run only once. If Redis is unavailable, the system keeps working from MySQL; only caching and analytics pause.

### Request flow examples

**An admin enables a feature**

```
Browser → React → FastAPI (validate JWT + role) → update MySQL
        → write audit log → clear Redis cache → response
```

**An application checks a feature**

```
App → Evaluate API (validate API key) → Redis cache (or MySQL on a miss)
    → apply rules → ON / OFF + reason → count usage in Redis
```

---

## Project structure

```
feature-flag-system/
├── docker-compose.yml               # MySQL, Redis, backend and frontend containers
├── README.md
│
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, CORS, Swagger metadata, scheduler start-up
│   │   ├── seed.py                  # Roles, environments, users and demo flags
│   │   ├── core/                    # config, database, security (JWT/bcrypt), Redis, permissions
│   │   ├── models/                  # SQLAlchemy models (7 tables)
│   │   ├── schemas/                 # Pydantic request / response models
│   │   ├── services/                # evaluation engine, analytics, audit, scheduler, token store
│   │   └── api/
│   │       ├── deps.py              # auth, RBAC, API-key and pagination dependencies
│   │       └── v1/endpoints/        # auth, users, environments, flags, rollouts,
│   │                                # assignments, evaluate, analytics, dashboard, audit
│   ├── alembic/versions/            # database migrations
│   ├── tests/                       # pytest suite
│   ├── postman/                     # Postman collection
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── api/                     # Axios client (auto token refresh) and typed endpoints
    │   ├── context/                 # authentication and notifications
    │   ├── components/              # layout, switchboard cell, dialogs, badges
    │   ├── pages/                   # dashboard, flags, environments, audit log, users, login
    │   │   └── flag/                # flag detail: rollout, targeting, usage, history, test
    │   ├── theme.ts                 # colours and Material UI theme
    │   └── types.ts                 # TypeScript types matching the API
    ├── package.json
    ├── vite.config.ts               # dev server + API proxy
    ├── nginx.conf                   # production server + API proxy
    └── Dockerfile
```

The backend uses a **layered architecture**: endpoints receive requests and check permissions, services hold the
business rules, and models talk to the database. This keeps the code easy to test, extend and maintain.

---

## Database design

| Table | Purpose |
|---|---|
| `roles` | Admin, Developer, Viewer |
| `users` | Platform users with hashed passwords, role and active status |
| `environments` | Development / Testing / Production, each with an API key and a *protected* setting |
| `feature_flags` | Flag definition: unique key, name, description, archived state |
| `feature_rollouts` | **One row per flag per environment**: enabled, rollout %, scheduled start/end, version |
| `user_assignments` | Per-user overrides (always on / always off) per flag and environment |
| `audit_logs` | Every change with before/after JSON snapshots, user, IP address and time |

```mermaid
erDiagram
    ROLES ||--o{ USERS : has
    FEATURE_FLAGS ||--o{ FEATURE_ROLLOUTS : "configured in"
    ENVIRONMENTS ||--o{ FEATURE_ROLLOUTS : contains
    FEATURE_FLAGS ||--o{ USER_ASSIGNMENTS : targets
    ENVIRONMENTS ||--o{ USER_ASSIGNMENTS : "applies in"
    USERS ||--o{ AUDIT_LOGS : performs

    USERS {
        int id PK
        string username UK
        string email UK
        string hashed_password
        int role_id FK
        bool is_active
    }
    ENVIRONMENTS {
        int id PK
        string key UK
        string name
        string api_key UK
        bool is_protected
    }
    FEATURE_FLAGS {
        int id PK
        string key UK
        string name
        bool is_archived
    }
    FEATURE_ROLLOUTS {
        int id PK
        int flag_id FK
        int environment_id FK
        bool is_enabled
        int rollout_percentage
        datetime scheduled_enable_at
        datetime scheduled_disable_at
        int version
    }
    USER_ASSIGNMENTS {
        int id PK
        int flag_id FK
        int environment_id FK
        string user_identifier
        bool is_enabled
    }
    AUDIT_LOGS {
        int id PK
        int user_id FK
        string action
        string entity_type
        json old_value
        json new_value
        datetime created_at
    }
```

Data integrity is enforced by the database itself: unique constraints prevent duplicate flag keys, duplicate
rollouts per environment and duplicate user assignments, and a check constraint keeps rollout percentages between
0 and 100. All timestamps are stored in **UTC**.

---

## Role-based access control

| Capability | Admin | Developer | Viewer |
|---|:---:|:---:|:---:|
| View flags, dashboard, analytics and audit logs | ✅ | ✅ | ✅ |
| Create, edit and archive flags | ✅ | ✅ | ❌ |
| Change rollouts and targeting in Development / Testing | ✅ | ✅ | ❌ |
| Change rollouts and targeting in **Production** (protected) | ✅ | ❌ | ❌ |
| Delete flags | ✅ | ❌ | ❌ |
| Manage environments and see full API keys | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ |

Permissions are enforced by the backend on every request. The frontend mirrors them (for example, Production
switches appear locked for Developers), but hiding a button is never the only protection.

---

## How flag evaluation works

When an application asks whether a flag is on for a user, the engine checks these rules in order:

| Step | Check | Result | Reason code |
|---|---|---|---|
| 1 | Flag does not exist or is archived | **OFF** | `FLAG_NOT_FOUND`, `FLAG_ARCHIVED` |
| 2 | Flag is switched off in this environment (schedules applied) | **OFF** | `DISABLED`, `SCHEDULED` |
| 3 | The user has a personal override | **ON** or **OFF** | `USER_TARGETED`, `USER_EXCLUDED` |
| 4 | Percentage rollout | **ON** if the user's bucket is below the % | `FULL_ROLLOUT`, `ROLLOUT_INCLUDED`, `ROLLOUT_EXCLUDED`, `NO_USER_CONTEXT` |

**Sticky percentage rollouts.** Each user is placed in a bucket from 0 to 99 using
`sha256(flag_key + ":" + user_id) % 100`. The same user always lands in the same bucket, so their experience is
consistent, and increasing a rollout from 20% to 50% only *adds* users.

**Kill switch.** When a flag is off in an environment, it is off for everyone, including users with overrides.
This makes switching off a reliable emergency stop.

**Beta-tester pattern.** To give a feature only to selected users, turn the flag on with a **0% rollout** and add
those users as *always on*.

---

## Getting started

### Option A: Docker (recommended)

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/)

```bash
git clone https://github.com/<your-username>/feature-flag-system.git
cd feature-flag-system
docker compose up --build
```

On start-up, the backend waits for MySQL, runs the database migrations and loads the seed data automatically.

| URL | Service |
|---|---|
| http://localhost:3000 | Frontend dashboard |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:8000/redoc | ReDoc |
| http://localhost:8000/health | Health check |
| `localhost:3307` | MySQL (user `ffuser`, password `ffpassword`) for MySQL Workbench |

Stop everything with `Ctrl + C`, or `docker compose down`. Add `-v` to also delete the database data.

### Option B: Run locally without Docker

**Prerequisites:** Python 3.12, Node.js 18+, MySQL 8.0, and optionally Redis 7.

#### 1. Create the database

In MySQL Workbench (connected as `root`), run:

```sql
CREATE DATABASE IF NOT EXISTS feature_flags CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'ffuser'@'localhost' IDENTIFIED BY 'ffpassword';
GRANT ALL PRIVILEGES ON feature_flags.* TO 'ffuser'@'localhost';
FLUSH PRIVILEGES;
```

#### 2. Start the backend (terminal 1)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS / Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env            # macOS / Linux: cp .env.example .env

alembic upgrade head              # create the tables
python -m app.seed                # load roles, environments, users and demo flags
uvicorn app.main:app --reload     # http://127.0.0.1:8000
```

> On Windows, if activation is blocked, run
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned` first.

#### 3. Start the frontend (terminal 2)

```powershell
cd frontend
npm install                       # first time only
npm run dev                       # http://localhost:5173
```

The Vite dev server forwards all `/api` requests to the backend, so no CORS configuration is needed.

#### 4. (Optional) Start Redis

The application works without Redis, but caching, usage analytics, login lockout and logout token revocation need it:

```bash
docker run -d --name ff_redis -p 6379:6379 redis:7-alpine
```

---

## Default accounts

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin@123` | Admin |
| `developer` | `Developer@123` | Developer |
| `viewer` | `Viewer@123` | Viewer |

The sign-in page has one-click buttons for each demo account. Users can sign in with either their username or email.

> **Before deploying anywhere real:** change `FIRST_ADMIN_PASSWORD` and `JWT_SECRET_KEY`, and set `SEED_DEMO_DATA=false`.

### Demo data

The seed script creates four sample flags to explore:

| Flag | Development | Testing | Production |
|---|---|---|---|
| `new-checkout-flow` | On, 100% | On, 100% | On, 25% |
| `dark-mode` | On, 100% | On, 100% | On, 100% |
| `ai-recommendations` | On, 100% | On, 50% | On, 0% + 3 beta testers |
| `beta-reports` | On, 100% | Off, scheduled to turn on | Off |

---

## Environment variables

Configured in `backend/.env` (copy from `backend/.env.example`):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `mysql+pymysql://ffuser:ffpassword@localhost:3306/feature_flags?charset=utf8mb4` | MySQL connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `JWT_SECRET_KEY` | *(placeholder)* | **Must be changed.** Generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token lifetime |
| `LOGIN_MAX_ATTEMPTS` | `5` | Failed logins before lockout |
| `LOGIN_LOCKOUT_MINUTES` | `15` | Lockout duration |
| `CORS_ORIGINS` | `["http://localhost:5173","http://localhost:3000"]` | Allowed frontend origins (JSON list) |
| `SCHEDULER_INTERVAL_SECONDS` | `30` | How often scheduled changes are applied |
| `CACHE_TTL_SECONDS` | `60` | Flag cache lifetime in Redis |
| `ANALYTICS_RETENTION_DAYS` | `90` | How long usage counters are kept |
| `FIRST_ADMIN_USERNAME` / `_EMAIL` / `_PASSWORD` | `admin` / `admin@example.com` / `Admin@123` | Initial admin account |
| `SEED_DEMO_DATA` | `true` | Create demo users and flags |

The frontend optionally reads `VITE_API_BASE_URL` (default `/api/v1`) from `frontend/.env`.

> `.env` files contain secrets and are excluded by `.gitignore`. Only `.env.example` is committed.

---

## Using the application

| Page | What you can do |
|---|---|
| **Dashboard** | See how many flags are on, flag checks today, per-environment status, rollout coverage, a 7-day usage trend, the most-checked flags, scheduled changes and recent activity |
| **Feature flags** | Search and filter flags, create new ones, and switch any flag on or off per environment directly from the list |
| **Flag → Rollout** | For each environment: turn on/off, set the rollout percentage, schedule a start/end time, roll back to an earlier version |
| **Flag → User targeting** | Add users who should always or never get the feature, individually or in bulk |
| **Flag → Usage** | Daily ON/OFF charts per environment, ON rate and peak daily users |
| **Flag → History** | Every change to the flag with a before/after comparison |
| **Flag → Test** | Check exactly what a given user would receive, with the reason and their rollout bucket |
| **Environments** | View and copy API keys, add/edit/delete environments, rotate keys, copy an integration snippet |
| **Audit log** | Search all events by text, action, type and date range; open an event to see what changed |
| **Users** *(Admin)* | Add users, change roles, reset passwords, deactivate or delete accounts |

---

## API reference

All endpoints are prefixed with `/api/v1`. *Editor* means Admin or Developer.

### Authentication

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | Login with form fields `username`, `password` |
| POST | `/auth/refresh` | Public | Exchange a refresh token for new tokens |
| POST | `/auth/logout` | JWT | Revoke the current tokens |
| GET | `/auth/me` | JWT | Current user profile |
| POST | `/auth/change-password` | JWT | Change own password |

### Users, roles and environments

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/roles` | JWT | Roles with user counts |
| GET / POST | `/users` | Admin | List (search, paginate) / create users |
| GET / PATCH / DELETE | `/users/{id}` | Admin | Get / update / delete a user |
| GET | `/environments` | JWT | List environments (API keys masked for non-admins) |
| POST | `/environments` | Admin | Create an environment |
| GET / PATCH / DELETE | `/environments/{id}` | JWT / Admin | Get / update / delete |
| POST | `/environments/{id}/regenerate-key` | Admin | Rotate the API key |

### Feature flags, rollouts and targeting

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/flags` | JWT | List flags with their rollouts (search, archived filter, pagination) |
| POST | `/flags` | Editor | Create a flag |
| GET / PATCH | `/flags/{id}` | JWT / Editor | Get / update name and description |
| DELETE | `/flags/{id}` | Admin | Delete permanently |
| POST | `/flags/{id}/archive` · `/restore` | Editor | Archive / restore |
| GET | `/flags/{id}/history` | JWT | Change history |
| GET | `/rollouts` | JWT | List rollouts (filter by flag, environment, scheduled) |
| GET / PATCH | `/rollouts/{id}` | JWT / Editor | Get / update on-off, percentage, schedule |
| POST | `/rollouts/{id}/toggle` | Editor | Switch on/off |
| POST | `/rollouts/{id}/rollback` | Editor | Undo last change, or `{"to_version": n}` / `{"audit_log_id": n}` |
| GET | `/rollouts/{id}/history` | JWT | Version history |
| POST | `/rollouts/scheduler/run` | Admin | Apply due schedules immediately |
| GET / POST | `/flags/{id}/assignments` | JWT / Editor | List / add a user override |
| POST | `/flags/{id}/assignments/bulk` | Editor | Add many users |
| DELETE | `/assignments/{id}` | Editor | Remove an override |

### Evaluation, analytics, dashboard and audit

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/evaluate` | Environment key | Evaluate one flag for a user |
| GET | `/evaluate/{flag_key}?user_id=` | Environment key | Evaluate one flag (GET form) |
| POST | `/evaluate/bulk/all` | Environment key | Evaluate every active flag for a user |
| POST | `/evaluate/test/run` | JWT | Dashboard test tool (not counted in analytics) |
| GET | `/analytics/overview` | JWT | Usage trend and most-checked flags |
| GET | `/analytics/flags/{id}` | JWT | Daily usage of one flag per environment |
| GET | `/dashboard/stats` | JWT | Dashboard statistics |
| GET | `/audit-logs` | JWT | Search the audit trail (filters + pagination) |
| GET | `/audit-logs/actions` | JWT | Distinct action names |
| GET | `/audit-logs/{id}` | JWT | One audit entry |

List endpoints are paginated and return:

```json
{ "items": [], "total": 230, "page": 2, "size": 25, "pages": 10 }
```

---

## Integrating a client application

Applications authenticate with the environment's API key (shown on the **Environments** page) in the
`X-Environment-Key` header.

**cURL**

```bash
curl -X POST http://localhost:8000/api/v1/evaluate \
  -H "X-Environment-Key: <development API key>" \
  -H "Content-Type: application/json" \
  -d '{"flag_key": "new-checkout-flow", "user_id": "customer-123"}'
```

```json
{
  "flag_key": "new-checkout-flow",
  "environment": "development",
  "user_id": "customer-123",
  "enabled": true,
  "reason": "FULL_ROLLOUT"
}
```

**Python**

```python
import requests

API = "http://localhost:8000/api/v1"
HEADERS = {"X-Environment-Key": "ffk_producti_..."}

# Fetch every flag for this user once, e.g. at app start-up
flags = requests.post(f"{API}/evaluate/bulk/all", json={"user_id": "customer-123"},
                      headers=HEADERS, timeout=2).json()["flags"]

if flags.get("new-checkout-flow"):
    show_new_checkout()
else:
    show_old_checkout()
```

**JavaScript**

```javascript
const res = await fetch("http://localhost:8000/api/v1/evaluate", {
  method: "POST",
  headers: { "X-Environment-Key": API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ flag_key: "dark-mode", user_id: currentUser.id }),
});
const { enabled } = await res.json();
if (enabled) enableDarkMode();
```

---

## API documentation and testing

### Swagger

Interactive documentation is generated automatically at **http://localhost:8000/docs**.

1. Click **Authorize** and sign in with `admin` / `Admin@123` (leave client ID and secret empty).
2. To test the evaluate endpoints, paste an environment API key into the **X-Environment-Key** field.
3. Open any endpoint, click **Try it out**, then **Execute**.

### Postman

Import `backend/postman/FeatureFlagSystem.postman_collection.json` (53 requests in 9 folders).

1. Run **Authentication → Login (Admin)**; the token is saved automatically.
2. Run **Environments → List environments**; the Development API key is saved for the evaluation requests.
3. Run **Feature Flags → Create flag**; the flag and rollout IDs are saved for later requests.

### Automated tests

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q
```

The suite covers the evaluation engine (rules, sticky bucketing, schedules), authentication, RBAC, the full flag
lifecycle, targeting, scheduling, rollback, audit logging and the dashboard.

### Frontend build check

```bash
cd frontend
npm run build      # TypeScript type-check + production build
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `Access denied for user 'ffuser'@'localhost'` | The MySQL user doesn't exist or the password differs. Run the SQL in [Create the database](#1-create-the-database), or update `DATABASE_URL` in `backend/.env` |
| `'vite' is not recognized` | Run `npm install` inside the `frontend` folder first |
| `npm` / `node` not recognized | Install Node.js LTS from nodejs.org and restart the terminal |
| PowerShell blocks `Activate.ps1` | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned` |
| Sign-in shows "Cannot reach the server" | The backend isn't running. Start `uvicorn app.main:app --reload` |
| "Too many failed attempts" | 5 wrong passwords lock that account for 15 minutes. Wait or use another account |
| Usage charts show no data | Redis isn't running. Usage counters are stored in Redis |
| `401 Unauthorized` in Swagger | The token expired after 30 minutes. Click **Authorize** and log in again |
| `403 Forbidden` | Your role can't perform this action, or the environment is protected. Sign in as Admin |
| Scheduled change didn't happen | Times must be in the future. The scheduler runs every 30 seconds; Admins can trigger it with `POST /rollouts/scheduler/run` |
| Port already in use | Stop the other process, or change the port in `docker-compose.yml` / `vite.config.ts` |

---

## Deliverables

| Deliverable | Location |
|---|---|
| FastAPI backend | `backend/` |
| React frontend | `frontend/` |
| MySQL database | `backend/alembic/versions/0001_initial_schema.py` (7 tables), seed in `backend/app/seed.py` |
| Docker configuration | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` |
| Swagger documentation | http://localhost:8000/docs |
| Postman collection | `backend/postman/FeatureFlagSystem.postman_collection.json` |
| README documentation | `README.md`, `backend/README.md`, `frontend/README.md` |

---

## Author

**Ramya**

Built as a full-stack project demonstrating feature flag management, role-based security, gradual rollouts and
audit logging with FastAPI, React, MySQL, Redis and Docker.
