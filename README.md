# Syncora

Syncora is a multi-tenant organizational workspace for daily work, administration, tasks, schedules, teams, announcements, and configurable dashboards/navigation.

Phase 2 adds scoped RBAC, individual allow/deny overrides, personal-data isolation, a real FullCalendar schedule, connected creation dialogs, role permission matrix, drag-and-drop navigation ordering, English/Hebrew runtime localization with RTL, light/dark/system themes, and HttpOnly refresh cookies.

## Architecture

- `apps/web`: React 19, TypeScript, Vite, MUI, React Router, TanStack Query, React Hook Form, and Zod.
- `apps/api`: FastAPI application API, SQLAlchemy async persistence, Alembic migrations, Argon2 password hashing, JWT access tokens, and rotating refresh tokens.
- `apps/services/Syncora.Audit`: ASP.NET Core 8 append-only audit service backed by PostgreSQL.
- PostgreSQL 17 is the primary database. Every business query is scoped to the authenticated organization.

In development, the browser uses same-origin `/api` requests. Vite proxies them to FastAPI on port 8500, so authentication works through localhost, a LAN address, or a development hostname without embedding that hostname in the client. The API sends administration events to the internal audit service on port 8501.

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

## Run Everything

```powershell
npm run dev
```

Starts React on 8600, FastAPI on 8500, and the audit service on 8501. The root launcher owns the complete Windows process trees, so Ctrl+C or a failed service terminates the group cleanly.

## Run Frontend Only

```powershell
npm run dev:frontend
```

Alias: `npm run frontend`. Vite listens on `0.0.0.0:8600`. API requests are proxied to `VITE_DEV_API_TARGET`, which defaults to `http://127.0.0.1:8500`.

## Run Backend Only

```powershell
npm run dev:backend
```

Alias: `npm run backend`. FastAPI listens on `0.0.0.0:8500`; the audit service listens on `0.0.0.0:8501`.

For zero-configuration local development the audit service uses an ignored SQLite file. Setting `AUDIT_DATABASE_URL` switches it to PostgreSQL; Docker and production continue to use PostgreSQL.

## LAN Development

Run `npm run dev`, find the development computer's LAN address, then open `http://<development-computer>:8600` on another device. No source change or fixed LAN IP is needed because the browser stays on `/api`. Windows Firewall must permit the three development ports on trusted/private networks.

`VITE_DEV_API_TARGET` controls only the server-side Vite proxy target. Set `VITE_API_URL` only when intentionally using a separate public API origin. Direct credentialed origins are controlled by `CORS_ORIGINS`; the configurable `CORS_ORIGIN_REGEX` is honored only in development. Production ignores the regex and requires explicit trusted origins.

Refresh tokens use a host-only HttpOnly, `SameSite=Lax` cookie scoped to `/api/v1/auth`. It is non-Secure for HTTP development and Secure by default in production. Production must use HTTPS; `COOKIE_SECURE` exists for explicit deployment configuration, not as a LAN workaround.

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

Access tokens live in session storage and expire quickly. Refresh tokens are opaque, stored only as SHA-256 hashes server-side, rotated on use, and transported in HttpOnly cookies. Backend dependencies reload current scoped grants for every request, so permission changes affect active sessions without waiting for JWT expiry. Cross-tenant lookups return 404 to reduce resource enumeration.

Every tenant request derives its workspace from the authenticated token. A supplied resource ID never changes that context: database lookups include the current workspace ID, and platform administrators can enter another workspace only through an explicit active membership and the audited workspace-switch endpoint. Organization administrators cannot list, create, switch, or administer other workspaces.

Uploaded files are stored behind the `StorageAdapter` boundary. Development uses the ignored `storage/` directory; clients never receive filesystem paths and downloads are permission- and tenant-checked. `STORAGE_BACKEND`, `STORAGE_LOCAL_ROOT`, and `UPLOAD_MAX_BYTES` configure this layer. The current implementation supports the local adapter and is designed for additional object-storage adapters.

The official source logo remains in `logos/`. Optimized transparent application artwork is under `apps/web/src/assets/brand/` and is used through `SyncoraLogo`; `SyncoraLoader` is a lightweight SVG reserved for login and application initialization.

## Git Workflow

Create focused branches and commits, run the full verification suite, inspect `git diff`, and never commit `.env`, tokens, dependency folders, databases, or build output.

## Troubleshooting

- Port conflict: stop the process using 8500, 8501, 8600, or 5432.
- Database unavailable: confirm `docker compose ps` reports PostgreSQL healthy and verify `DATABASE_URL`.
- Login seed missing: use an empty development database or run the seed after migrations.
- Audit unavailable: core requests still complete and emit a warning; restore port 8501 before administrative changes.
