# Feature Flag & Environment Management System

A centralised platform that lets administrators control application features **without redeploying**:
switch features on/off per environment, roll them out to a percentage of users, target specific users,
schedule releases, roll back changes, and audit everything.

| Part | Stack | Docs |
|------|-------|------|
| Backend | Python 3.12, FastAPI, SQLAlchemy, Alembic, JWT, Redis, MySQL 8 | [backend/README.md](backend/README.md) |
| Frontend | React 18, Vite, TypeScript, Material UI, Axios, React Router, Chart.js | [frontend/README.md](frontend/README.md) |

## Start everything with Docker

```bash
docker compose up --build
```

| URL | What |
|-----|------|
| http://localhost:3000 | Dashboard (sign in as `admin` / `Admin@123`) |
| http://localhost:8000/docs | Swagger API documentation |
| `localhost:3307` (`ffuser` / `ffpassword`) | MySQL, for MySQL Workbench |

## Start without Docker (two terminals)

```bash
# Terminal 1: backend
cd backend
python -m venv .venv
.venv\Scripts\activate                 # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env                 # macOS/Linux: cp ... then set DATABASE_URL
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload

# Terminal 2: frontend
cd frontend
npm install
npm run dev                            # http://localhost:5173
```

## Deliverables

* FastAPI backend: `backend/`
* React frontend: `frontend/`
* MySQL database: `backend/alembic/versions/0001_initial_schema.py` (7 tables)
* Docker configuration: `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`
* Swagger documentation: http://localhost:8000/docs
* Postman collection: `backend/postman/FeatureFlagSystem.postman_collection.json`
* README documentation: this file plus the backend and frontend READMEs
