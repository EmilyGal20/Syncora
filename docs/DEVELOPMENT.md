# Development

Use Node 20+, Python 3.13+, .NET 8+, PostgreSQL 16+, and MongoDB 8+. Copy `.env.example` to `.env`, start both databases (`docker compose up -d postgres mongodb`), apply the Alembic migration, and run `npm run dev` from the repository root.

Quality gates are `npm run lint`, `npm run test`, `npm run build`, and `npm run test:e2e`. API docs are available at `/docs`. Seed data is inserted only in Development and only when no organization exists.

Modules should keep API calls in the centralized client, server data in TanStack Query, and authorization in both route ergonomics and backend dependencies. New tenant tables must include explicit organization ownership and tests proving cross-tenant identifiers cannot escape that boundary.
