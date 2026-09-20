# Security

Passwords use Argon2 through `pwdlib`. Successful login creates a 15-minute signed JWT and a high-entropy opaque refresh token. Only the refresh-token SHA-256 digest is stored. Refresh rotates the token; logout revokes it. Disabled users fail access-token validation even before expiry.

FastAPI dependencies reload roles and permissions and enforce granular permission codes at each protected endpoint. Tenant-owned queries always include the authenticated organization. Related IDs, such as task assignees and assigned roles, are validated in the same organization to prevent IDOR.

CORS permits only configured origins and headers. Responses add content-type, frame, and referrer protections. Validation errors are safe; unhandled errors return a generic message. Secrets come from environment variables and `.env` is ignored.

The current browser model keeps access tokens in session storage and refresh tokens in local storage. This is acceptable only for the local foundation. Production should use TLS and an HttpOnly, Secure, SameSite refresh cookie with CSRF controls. Login rate limiting should be added at the edge before public deployment.

