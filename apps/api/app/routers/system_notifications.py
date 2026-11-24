from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record_audit
from ..database import get_db
from ..dependencies import current_user, permission_codes, require_any_permission
from ..models import Organization, Role, User
from ..system_notifications import normalize_system_notifications, should_deliver

router = APIRouter(tags=["system-notifications"])


class SystemNotificationPolicy(BaseModel):
    types: dict[str, bool] = Field(default_factory=dict)
    audience: str = "organization"
    target_ids: list[str] = Field(default_factory=list)


def _policy(user: User) -> dict:
    workspace = getattr(user, "_workspace", None)
    return normalize_system_notifications(getattr(workspace, "system_notifications", None) if workspace else None)


def _deliver(user: User, policy: dict) -> bool:
    role_ids = {role.id for role in user.roles}
    return should_deliver(permission_codes(user), user.id, role_ids, policy)


@router.get("/system-notifications")
async def read_system_notifications(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    policy = _policy(user)
    manage = "system_notifications.manage" in permission_codes(user)
    payload = {"types": policy["types"], "deliver": _deliver(user, policy), "audience": policy["audience"], "target_ids": policy["target_ids"]}
    if not manage:
        return payload
    roles = (await db.scalars(select(Role).where(Role.organization_id == user.organization_id).order_by(Role.name))).all()
    people = (
        await db.scalars(select(User).where(User.organization_id == user.organization_id, User.is_active.is_(True)).order_by(User.full_name))
    ).all()
    payload["roles"] = [{"id": role.id, "name": role.name} for role in roles]
    payload["users"] = [{"id": person.id, "full_name": person.full_name} for person in people]
    return payload


@router.patch("/system-notifications")
async def update_system_notifications(
    body: SystemNotificationPolicy,
    user: User = Depends(require_any_permission("system_notifications.manage", "settings.manage")),
    db: AsyncSession = Depends(get_db),
):
    org = await db.get(Organization, user.organization_id)
    org.system_notifications = normalize_system_notifications(body.model_dump())
    await db.commit()
    await record_audit(user, "workspace.system_notifications.changed", "organization", org.id)
    return org.system_notifications
