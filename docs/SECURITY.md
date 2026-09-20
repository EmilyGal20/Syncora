# Security

Passwords use Argon2 through `pwdlib`. Successful login creates a 15-minute signed JWT and a high-entropy opaque refresh token. Only the refresh-token SHA-256 digest is stored. Refresh rotates the token; logout revokes it. Disabled users fail access-token validation even before expiry.

FastAPI dependencies reload roles and permissions and enforce granular permission codes at each protected endpoint. Tenant-owned queries always include the authenticated organization. Related IDs, such as task assignees and assigned roles, are validated in the same organization to prevent IDOR.

CORS permits only configured origins and headers. Responses add content-type, frame, and referrer protections. Validation errors are safe; unhandled errors return a generic message. Secrets come from environment variables and `.env` is ignored.

Access tokens remain in per-tab session storage. Refresh tokens are transported only through an HttpOnly `SameSite=Lax` cookie, are `Secure` in production, stored server-side only as hashes, and rotated on every refresh. Application JavaScript cannot read them. Login rate limiting should be added at the edge before public deployment.

Tasks and events are filtered in SQL using effective access scope. Individual-resource endpoints repeat the tenant, ownership, team, or department check and return 404 for unauthorized identifiers. Announcement audiences are resolved server-side. Automated and live checks cover direct deny precedence, foreign tenant records, cross-user task IDs, cross-user event IDs, and Admin API denial.
