from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .database import get_db
from .models import Role, User
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
    return user


def permission_codes(user: User) -> set[str]:
    return {permission.code for role in user.roles for permission in role.permissions}


def require_permission(code: str) -> Callable:
    async def dependency(user: User = Depends(current_user)) -> User:
        if not user.is_platform_admin and code not in permission_codes(user):
            raise HTTPException(status_code=403, detail=f"Permission required: {code}")
        return user
    return dependency


def assert_tenant(entity_organization_id: str, user: User) -> None:
    if entity_organization_id != user.organization_id and not user.is_platform_admin:
        raise HTTPException(status_code=404, detail="Resource not found")

