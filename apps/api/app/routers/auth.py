from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..database import get_db
from ..dependencies import current_user, permission_codes
from ..models import RefreshToken, Role, User
from ..schemas import LoginRequest, RefreshRequest, TokenResponse, UserSummary
from ..security import create_access_token, hash_token, new_refresh_token, verify_password

router = APIRouter(prefix="/auth", tags=["authentication"])
settings = get_settings()


def user_summary(user: User) -> UserSummary:
    return UserSummary(
        id=user.id, email=user.email, full_name=user.full_name, is_active=user.is_active,
        organization_id=user.organization_id, department_id=user.department_id, team_id=user.team_id,
        last_login_at=user.last_login_at, created_at=user.created_at,
        roles=[role.name for role in user.roles], permissions=sorted(permission_codes(user)),
    )


async def issue_tokens(db: AsyncSession, user: User) -> TokenResponse:
    raw, digest = new_refresh_token()
    db.add(RefreshToken(user_id=user.id, token_hash=digest, expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days)))
    await db.commit()
    return TokenResponse(access_token=create_access_token(user.id, user.organization_id), refresh_token=raw, expires_in=settings.access_token_minutes * 60)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).options(selectinload(User.roles).selectinload(Role.permissions)).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user.last_login_at = datetime.now(UTC)
    return await issue_tokens(db, user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == hash_token(body.refresh_token)))
    saved = result.scalar_one_or_none()
    now = datetime.now(UTC)
    if not saved or saved.revoked_at or saved.expires_at.replace(tzinfo=UTC) <= now:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    saved.revoked_at = now
    user = await db.get(User, saved.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account is unavailable")
    return await issue_tokens(db, user)


@router.post("/logout", status_code=204)
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == hash_token(body.refresh_token)))
    saved = result.scalar_one_or_none()
    if saved and not saved.revoked_at:
        saved.revoked_at = datetime.now(UTC)
        await db.commit()
    return Response(status_code=204)


@router.get("/me", response_model=UserSummary)
async def me(user: User = Depends(current_user)):
    return user_summary(user)
