# Database

PostgreSQL is the production and Docker database. SQLAlchemy models define organizations, users, departments, teams, roles, permissions, sessions, navigation items, dashboards/widgets, tasks, events, announcements, and preferences. Composite unique constraints protect tenant-local names and user emails; organization columns are indexed.

Run Python migrations from `apps/api`:

```powershell
..\..\.venv\Scripts\python.exe -m alembic upgrade head
```

The audit service uses a separate EF Core migration and table in the same development database. Production can place that service in a separately managed PostgreSQL database without changing its boundary.

