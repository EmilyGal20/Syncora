# Authorization

Users may have multiple organization roles. Roles contain globally defined granular permissions such as `users.view`, `tasks.create`, and `navigation.manage`. `require_permission()` is the server-side enforcement point. The UI uses permissions for ergonomics only; hiding an item never grants or removes backend access.

Organization administrators can create roles and select permissions. Platform-administrator capability is represented independently from organization roles. Cross-tenant entity identifiers are answered as not found.

