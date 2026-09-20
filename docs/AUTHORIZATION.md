# Authorization

Users may have multiple organization roles. Roles contain globally defined granular permissions such as `users.view`, `tasks.create`, and `navigation.manage`. `require_permission()` is the server-side enforcement point. The UI uses permissions for ergonomics only; hiding an item never grants or removes backend access.

Organization administrators can create roles and select permissions. Platform-administrator capability is represented independently from organization roles. Cross-tenant entity identifiers are answered as not found.

Scoped `access_grants` are authoritative. A grant targets a role or individual user, has an allow/deny effect, and carries one of `OWN`, `TEAM`, `DEPARTMENT`, or `ORGANIZATION`. Explicit user deny wins, explicit user allow overrides roles, the broadest role grant applies for inherit, and absent grants are denied. SQL queries apply the resulting scope before rows are returned. Migration `0003_scoped_grants` copies legacy role-permission links into `OWN` grants before the old fallback is disabled.

Access JWTs identify the user and organization but do not contain durable permission claims. FastAPI reloads current roles and grants for every request. The web client refreshes `/auth/me` on focus, after a denied request, and periodically so navigation and controls follow administrative changes promptly.
