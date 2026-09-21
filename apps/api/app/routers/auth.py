from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import get_settings
from ..database import get_db
from ..dependencies import current_user, permission_codes, permission_scopes
from ..models import Organization, RefreshToken, Role, User, WorkspaceMembership
from ..rate_limit import public_limiter
from ..schemas import LoginRequest, RefreshRequest, TokenResponse, UserSummary
from ..security import create_access_token, hash_token, new_refresh_token, verify_password

router = APIRouter(prefix="/auth", tags=["authentication"])
settings = get_settings()


def user_summary(user: User) -> UserSummary:
    workspace = user._workspace
    return UserSummary(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        organization_id=user.organization_id,
        department_id=user.department_id,
        team_id=user.team_id,
        locale=user.locale,
        last_login_at=user.last_login_at,
        created_at=user.created_at,
        roles=[role.name for role in user.roles],
        permissions=sorted(permission_codes(user)),
        scopes=permission_scopes(user),
        is_platform_admin=user.is_platform_admin,
        workspace_name=workspace.name,
        workspace_slug=workspace.slug,
        workspace_type=workspace.workspace_type,
        workspace_logo_url="/api/v1/workspace/logo" if workspace.logo_storage_key else None,
        workspace_primary_color=workspace.primary_color,
        workspace_secondary_color=workspace.secondary_color,
        enabled_modules=workspace.enabled_modules or [],
    )


async def issue_tokens(
    db: AsyncSession, user: User, response: Response, organization_id: str | None = None
) -> TokenResponse:
    workspace_id = organization_id or user.organization_id
    raw, digest = new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            organization_id=workspace_id,
            token_hash=digest,
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
        )
    )
    await db.commit()
    secure_cookie = (
        settings.cookie_secure if settings.cookie_secure is not None else settings.environment == "production"
    )
    response.set_cookie(
        "syncora_refresh",
        raw,
        httponly=True,
        secure=secure_cookie,
        samesite="lax",
        path="/api/v1/auth",
        max_age=settings.refresh_token_days * 86400,
    )
    return TokenResponse(
        access_token=create_access_token(user.id, workspace_id), expires_in=settings.access_token_minutes * 60
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    public_limiter.check(request, f"login:{(body.identifier or body.email or '').lower()}", 30, 300)
    identifier = (body.identifier or body.email or "").strip().lower()
    if not identifier:
        raise HTTPException(status_code=422, detail="Username or email is required")
    query = (
        select(User)
        .options(selectinload(User.roles).selectinload(Role.permissions))
        .where(or_(User.username == identifier, User.email == identifier))
    )
    if body.workspace_slug:
        query = query.join(Organization, Organization.id == User.organization_id).where(
            Organization.slug == body.workspace_slug
        )
    users = list((await db.scalars(query)).unique().all())
    if len(users) > 1:
        raise HTTPException(status_code=409, detail="Workspace selection is required")
    user = users[0] if users else None
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username/email or password")
    user.last_login_at = datetime.now(UTC)
    return await issue_tokens(db, user, response)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    body: RefreshRequest | None = None,
    syncora_refresh: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    raw_token = syncora_refresh or (body.refresh_token if body else None)
    if not raw_token:
        raise HTTPException(status_code=401, detail="Refresh token required")
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token)))
    saved = result.scalar_one_or_none()
    now = datetime.now(UTC)
    if not saved or saved.revoked_at or saved.expires_at.replace(tzinfo=UTC) <= now:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    saved.revoked_at = now
    user = await db.get(User, saved.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account is unavailable")
    workspace_id = saved.organization_id or user.organization_id
    if workspace_id != user.organization_id:
        authorized = user.is_platform_admin and await db.scalar(
            select(WorkspaceMembership.id).where(
                WorkspaceMembership.user_id == user.id,
                WorkspaceMembership.organization_id == workspace_id,
                WorkspaceMembership.is_active.is_(True),
            )
        )
        if not authorized:
            raise HTTPException(status_code=401, detail="Workspace access is unavailable")
    return await issue_tokens(db, user, response, workspace_id)


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    body: RefreshRequest | None = None,
    syncora_refresh: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    raw_token = syncora_refresh or (body.refresh_token if body else None)
    result = (
        await db.execute(select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token)))
        if raw_token
        else None
    )
    saved = result.scalar_one_or_none() if result else None
    if saved and not saved.revoked_at:
        saved.revoked_at = datetime.now(UTC)
        await db.commit()
    response.delete_cookie("syncora_refresh", path="/api/v1/auth")
    response.status_code = 204
    return response


@router.get("/me", response_model=UserSummary)
async def me(user: User = Depends(current_user)):
    return user_summary(user)
