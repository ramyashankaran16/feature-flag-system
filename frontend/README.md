# Switchboard: Feature Flag Management Frontend

React dashboard for the Feature Flag & Environment Management System.

**Stack:** React 18 · Vite · TypeScript · Material UI 6 · Axios · React Router 6 · Chart.js 4

## Run locally (development)

The backend must be running on `http://127.0.0.1:8000` first.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and sign in with `admin` / `Admin@123`
(or use the Admin / Developer / Viewer buttons on the sign-in page).

Vite proxies every `/api` request to the backend (see `vite.config.ts`), so no CORS setup is needed.

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server on port 5173 |
| `npm run build` | Type-check and build to `dist/` |
| `npm run typecheck` | Type-check only |
| `npm run preview` | Serve the production build locally |

## Run with Docker

From the project root run `docker compose up --build`, then open http://localhost:3000.
nginx serves the built app and forwards `/api`, `/docs` and `/health` to the backend container.

## Screens

| Page | Path | What you can do |
|------|------|-----------------|
| Sign in | `/login` | JWT login, show/hide password, demo account shortcuts |
| Dashboard | `/` | Totals, per-environment status, rollout coverage chart, 7-day flag-check trend, most-checked flags, scheduled changes, recent activity |
| Feature flags | `/flags` | Search, active/archived filter, pagination, create flags, switch flags on/off per environment directly from the list |
| Flag: Rollout tab | `/flags/:id` | Per environment: on/off, rollout percentage slider, scheduled start/end, roll back (undo last change or restore a version) |
| Flag: User targeting tab | | Users who always/never get the feature, bulk add, remove |
| Flag: Usage tab | | Daily checks per environment (Chart.js), ON rate, peak daily users |
| Flag: History tab | | Every change with a before/after comparison |
| Flag: Test tab | | What a given user would get, with the reason and their rollout bucket |
| Environments | `/environments` | API keys (reveal/copy for Admins), add/edit/delete, rotate keys, integration snippet |
| Audit log | `/audit-logs` | Search and filter by action, type and date range; open any event to see what changed |
| Users | `/users` | Admin only: add, edit, change role, deactivate, delete |

## Auth and roles

* Tokens are stored in `localStorage`; Axios adds `Authorization: Bearer …` to every request.
* When the access token expires, the Axios interceptor calls `/auth/refresh` once, retries the original
  request, and only signs you out if the refresh token is also invalid.
* The UI follows the backend's role rules: Viewers are read-only, Developers can't change protected
  environments (Production switches are locked with a tooltip), and only Admins see Users, full API keys
  and delete actions. The backend enforces all of this again, so hiding a button is never the only protection.
* Changes to protected environments ask for confirmation first.

## Project structure

```
src/
├── main.tsx               # providers: theme, router, notifications, auth
├── App.tsx                # routes
├── theme.ts               # colour tokens, environment colours, MUI theme
├── types.ts               # TypeScript types matching the API schemas
├── api/
│   ├── client.ts          # Axios instance, token storage, auto refresh, error messages
│   └── endpoints.ts       # one typed function per backend endpoint
├── context/
│   ├── AuthContext.tsx    # current user, login/logout, role helpers
│   └── NotifyContext.tsx  # snackbar notifications
├── components/            # Layout, Panel, RolloutCell (switchboard), dialogs, badges
├── pages/                 # Login, Dashboard, Flags, Environments, AuditLogs, Users
│   └── flag/              # flag detail page and its five tabs
├── hooks/useDebounce.ts
└── utils/                 # date/text formatting, Chart.js registration
```

## Design notes

The interface is built around a switchboard: every flag row shows a live switch and an audience bar for
each environment, colour-coded Development (blue), Testing (amber) and Production (red, locked). Everything
else stays quiet so those switches stand out. Public Sans is used for text and JetBrains Mono only for code
identifiers such as flag keys and API keys.
