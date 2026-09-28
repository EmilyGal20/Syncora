# Syncora hybrid data architecture

Syncora deliberately uses two databases with separate ownership boundaries.

## PostgreSQL: authoritative business and security state

PostgreSQL remains the source of truth for organizations, workspace membership, users, roles, permissions and scopes, refresh sessions, tasks, calendar events, notes, dashboards, files, support-ticket identity and every relationship used to authorize access. A request is authorized from PostgreSQL before any MongoDB document is read.

## MongoDB: realtime and document workloads

MongoDB stores notification delivery state, persisted realtime events/activity history, and support conversation messages. Documents carry a `schema_version`, `organization_id`, stable source identifier, actor/recipient identifiers where applicable, and timestamps. Repository methods always qualify tenant and recipient filters; callers cannot supply raw Mongo filters.

```text
Browser -> FastAPI authentication/RBAC -> PostgreSQL authorization
                                      -> MongoDB tenant-qualified document read/write
                                      -> WebSocket recipient/workspace delivery
```

`AsyncMongoClient` is created once during the FastAPI lifespan. Startup pings MongoDB and creates deterministic indexes. Development startup idempotently copies legacy SQL notifications and support messages by stable source IDs. PostgreSQL compatibility rows remain during this transition; no destructive migration is performed.

Notification and activity persistence is best effort so a transient MongoDB outage does not break core workspace CRUD. Support conversation content is treated as MongoDB-owned: when MongoDB is unavailable, its endpoints return a controlled `503` rather than silently losing a message. `/health` reports PostgreSQL, MongoDB, audit-service, and realtime status independently.

## Configuration

- `MONGODB_URI` defaults to `mongodb://localhost:27017` for local development.
- `MONGODB_DATABASE` defaults to `syncora_dev`.
- Tests must use a dedicated database name and must never delete the development database.
- Production credentials belong in secret management, not committed environment files.

The Compose stack provides a persistent `syncora_mongo` volume. Back up PostgreSQL and MongoDB together when a consistent operational snapshot is required.
