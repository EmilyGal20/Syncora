# Syncora

Syncora is a multi-tenant organizational workspace for daily work, administration, tasks, schedules, teams, announcements, and configurable dashboards/navigation.

Phase 2 adds scoped RBAC, individual allow/deny overrides, personal-data isolation, a real FullCalendar schedule, connected creation dialogs, role permission matrix, drag-and-drop navigation ordering, English/Hebrew runtime localization with RTL, light/dark/system themes, and HttpOnly refresh cookies.

## Architecture

- `apps/web`: React 19, TypeScript, Vite, MUI, React Router, TanStack Query, React Hook Form, and Zod.
- `apps/api`: FastAPI application API, SQLAlchemy async persistence, Alembic migrations, Argon2 password hashing, JWT access tokens, and rotating refresh tokens.
- `apps/services/Syncora.Audit`: ASP.NET Core 8 append-only audit service backed by PostgreSQL.
- PostgreSQL 17 is the primary database. Every business query is scoped to the authenticated organization.

The browser calls FastAPI at `http://localhost:8500`. The API sends administration events to the internal audit service on port 8501.

## Prerequisites

Node.js 20+, Python 3.13+, .NET SDK 8+, and PostgreSQL 16+ or Docker Desktop.

## Docker Quick Start

```powershell
Copy-Item .env.example .env
docker compose up --build
```

- Frontend: http://localhost:8600
- Backend: http://localhost:8500
- OpenAPI: http://localhost:8500/docs
- Audit health: http://localhost:8501/health

## Local Development

```powershell
npm install
npm --prefix apps/web install
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r apps\api\requirements.txt
dotnet restore apps\services\Syncora.Audit\Syncora.Audit.csproj
Copy-Item .env.example .env
docker compose up -d postgres
cd apps\api
..\..\.venv\Scripts\python.exe -m alembic upgrade head
cd ..\..
npm run dev
```

`npm run dev` starts web on 8600, API on 8500, and audit on 8501.

## Development Data

In `ENVIRONMENT=development`, an empty schema is seeded once:

- Organization: `Syncora Demo`
- Administrator: `admin@syncora.dev`
- Password: `ChangeMe123!`

These credentials are development-only and configurable with `DEV_ADMIN_EMAIL` and `DEV_ADMIN_PASSWORD`.

## Commands

```powershell
npm run build
npm run lint
npm run test
npm run test:e2e
```

Run an API migration from `apps/api` with `..\..\.venv\Scripts\python.exe -m alembic upgrade head`. The audit service applies its EF Core migration in Development at startup.

## Repository Structure

```text
apps/web                 React client and Playwright tests
apps/api                 FastAPI API, migrations, seed, pytest tests
apps/services            ASP.NET Core audit service
docs                     Architecture and operations documentation
docker-compose.yml       Complete local stack
```

## Security Notes

Access tokens live in session storage and expire quickly. Refresh tokens are opaque, stored only as SHA-256 hashes server-side, rotated on use, and kept in local storage in this initial client. For an internet deployment, move refresh tokens to Secure, HttpOnly, SameSite cookies behind TLS. Backend dependencies enforce permissions independently from the UI. Cross-tenant lookups return 404 to reduce resource enumeration.

## Git Workflow

Create focused branches and commits, run the full verification suite, inspect `git diff`, and never commit `.env`, tokens, dependency folders, databases, or build output.

## Troubleshooting

- Port conflict: stop the process using 8500, 8501, 8600, or 5432.
- Database unavailable: confirm `docker compose ps` reports PostgreSQL healthy and verify `DATABASE_URL`.
- Login seed missing: use an empty development database or run the seed after migrations.
- Audit unavailable: core requests still complete and emit a warning; restore port 8501 before administrative changes.
