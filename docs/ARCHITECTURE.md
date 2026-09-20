# Architecture

Syncora is a modular monorepo and deliberately begins as a modular monolith plus one bounded service.

The React client requests `/api/v1/*` from FastAPI on port 8500. FastAPI owns organizations, identity records, RBAC, navigation, dashboards, users, tasks, schedules, and other workspace data. PostgreSQL is authoritative. ASP.NET Core on port 8501 owns immutable-style audit ingestion and querying; it exists separately because audit retention, access, and throughput typically diverge from transactional application data.

Tenant-owned tables carry `organization_id`. The authenticated JWT carries a user and organization identifier, but the database user record is reloaded on every request. Queries constrain both entity identity and organization identity. Navigation and dashboard widgets are stored definitions and filtered using resolved permissions before serialization.

The frontend is feature-oriented around API, auth, components, layout, pages, and shared types. TanStack Query owns server state; React state owns transient view controls.

