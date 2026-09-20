from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .database import get_db
from .models import AccessGrant, Role, User
from .security import decode_access_token

bearer = HTTPBearer(auto_error=False)


async def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token") from exc
    result = await db.execute(
        select(User).options(selectinload(User.roles).selectinload(Role.permissions)).where(User.id == payload.get("sub"))
    )
    user = result.scalar_one_or_none()
    if not user or not user.is_active or user.organization_id != payload.get("org"):
        raise HTTPException(status_code=401, detail="Account is unavailable")
    role_ids = [role.id for role in user.roles]
    grants = list((await db.scalars(select(AccessGrant).where(
        AccessGrant.organization_id == user.organization_id,
        ((AccessGrant.principal_type == "user") & (AccessGrant.principal_id == user.id)) |
        ((AccessGrant.principal_type == "role") & (AccessGrant.principal_id.in_(role_ids))),
    ))).all())
    user._access_grants = grants
    return user


def permission_codes(user: User) -> set[str]:
    return set(permission_scopes(user))


def permission_scopes(user: User) -> dict[str, str]:
    codes = {g.permission.code for g in getattr(user, "_access_grants", [])}
    return {code: scope for code in codes if (scope := access_scope(user, code)) is not None}


SCOPE_RANK = {"OWN": 0, "TEAM": 1, "DEPARTMENT": 2, "ORGANIZATION": 3}


def access_scope(user: User, code: str) -> str | None:
    if user.is_platform_admin:
        return "ORGANIZATION"
    grants = [g for g in getattr(user, "_access_grants", []) if g.permission.code == code]
    direct = [g for g in grants if g.principal_type == "user"]
    if any(g.effect == "deny" for g in direct):
        return None
    direct_allow = [g.scope for g in direct if g.effect == "allow"]
    if direct_allow:
        return max(direct_allow, key=lambda value: SCOPE_RANK[value])
    role_scopes = [g.scope for g in grants if g.principal_type == "role" and g.effect == "allow"]
    if role_scopes:
        return max(role_scopes, key=lambda value: SCOPE_RANK[value])
    return None


def require_permission(code: str) -> Callable:
    async def dependency(user: User = Depends(current_user)) -> User:
        if access_scope(user, code) is None:
            raise HTTPException(status_code=403, detail=f"Permission required: {code}")
        return user
    return dependency


def assert_tenant(entity_organization_id: str, user: User) -> None:
    if entity_organization_id != user.organization_id and not user.is_platform_admin:
        raise HTTPException(status_code=404, detail="Resource not found")
