from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..audit import record_audit
from ..database import get_db
from ..dependencies import access_scope, current_user, permission_codes, require_permission
from ..models import Dashboard, NavigationItem, Permission, Role, Task, User, UserPreference
from ..schemas import NavigationInput, RoleCreate, TaskCreate, UserCreate, UserUpdate
from ..security import hash_password

router = APIRouter(tags=["workspace"])


def user_json(user: User) -> dict:
    return {
        "id": user.id, "email": user.email, "full_name": user.full_name,
        "is_active": user.is_active, "department_id": user.department_id,
        "team_id": user.team_id, "locale": user.locale, "last_login_at": user.last_login_at,
        "created_at": user.created_at, "roles": [r.name for r in user.roles],
    }


@router.get("/users")
async def users(
    search: str = "", page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
    role_id: str | None = None, team_id: str | None = None, department_id: str | None = None, status_filter: str | None = Query(None, alias="status"),
    user: User = Depends(require_permission("users.view")), db: AsyncSession = Depends(get_db),
):
    clause = User.organization_id == user.organization_id
    if search:
        clause = clause & or_(User.full_name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%"))
    if role_id:
        clause = clause & User.roles.any(Role.id == role_id)
    if team_id:
        clause = clause & (User.team_id == team_id)
    if department_id:
        clause = clause & (User.department_id == department_id)
    if status_filter in {"active", "inactive"}:
        clause = clause & (User.is_active.is_(status_filter == "active"))
    total = await db.scalar(select(func.count()).select_from(User).where(clause))
    result = await db.execute(select(User).options(selectinload(User.roles)).where(clause).order_by(User.full_name).offset((page - 1) * page_size).limit(page_size))
    return {"items": [user_json(item) for item in result.scalars()], "total": total, "page": page, "page_size": page_size}


@router.post("/users", status_code=201)
async def create_user(body: UserCreate, actor: User = Depends(require_permission("users.create")), db: AsyncSession = Depends(get_db)):
    exists = await db.scalar(select(User.id).where(User.organization_id == actor.organization_id, User.email == body.email.lower()))
    if exists:
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    roles = list((await db.scalars(select(Role).where(Role.organization_id == actor.organization_id, Role.id.in_(body.role_ids)))).all()) if body.role_ids else []
    created = User(organization_id=actor.organization_id, email=body.email.lower(), full_name=body.full_name, password_hash=hash_password(body.password), department_id=body.department_id, team_id=body.team_id, locale=body.locale, roles=roles)
    db.add(created)
    await db.flush()
    db.add(UserPreference(user_id=created.id, locale=body.locale or "en"))
    await db.commit()
    await record_audit(actor, "user.created", "user", created.id, {"email": created.email})
    return user_json(created)


@router.patch("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, actor: User = Depends(require_permission("users.edit")), db: AsyncSession = Depends(get_db)):
    target = await db.scalar(select(User).options(selectinload(User.roles)).where(User.id == user_id, User.organization_id == actor.organization_id))
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    old_roles = sorted(role.id for role in target.roles)
    values = body.model_dump(exclude_unset=True, exclude={"role_ids"})
    for key, value in values.items():
        setattr(target, key, value)
    if body.role_ids is not None:
        target.roles = list((await db.scalars(select(Role).where(Role.organization_id == actor.organization_id, Role.id.in_(body.role_ids)))).all())
    await db.commit()
    await record_audit(actor, "user.updated", "user", target.id, {"active": target.is_active, "role_ids": {"old": old_roles, "new": sorted(role.id for role in target.roles)}})
    return user_json(target)


@router.get("/permissions")
async def permissions(_: User = Depends(require_permission("roles.manage")), db: AsyncSession = Depends(get_db)):
    values = (await db.scalars(select(Permission).order_by(Permission.group, Permission.code))).all()
    return [{"id": p.id, "code": p.code, "group": p.group, "description": p.description} for p in values]


@router.get("/roles")
async def roles(user: User = Depends(require_permission("roles.manage")), db: AsyncSession = Depends(get_db)):
    values = (await db.scalars(select(Role).options(selectinload(Role.permissions)).where(Role.organization_id == user.organization_id).order_by(Role.name))).all()
    return [{"id": r.id, "name": r.name, "description": r.description, "permissions": [p.code for p in r.permissions]} for r in values]


@router.post("/roles", status_code=201)
async def create_role(body: RoleCreate, actor: User = Depends(require_permission("roles.manage")), db: AsyncSession = Depends(get_db)):
    perms = list((await db.scalars(select(Permission).where(Permission.code.in_(body.permission_codes)))).all())
    role = Role(organization_id=actor.organization_id, name=body.name, description=body.description, permissions=perms)
    db.add(role)
    await db.commit()
    await record_audit(actor, "role.created", "role", role.id)
    return {"id": role.id, "name": role.name, "permissions": [p.code for p in role.permissions]}


@router.get("/navigation")
async def navigation(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    allowed = permission_codes(user)
    locale = user.locale or next((role.default_locale for role in user.roles if role.default_locale), None) or "en"
    values = (await db.scalars(select(NavigationItem).where(NavigationItem.organization_id == user.organization_id, NavigationItem.enabled.is_(True)).order_by(NavigationItem.order))).all()
    return [{"id": n.id, "parent_id": n.parent_id, "title": (n.title_he if locale == "he" else n.title_en) or n.title, "icon": n.icon, "route": n.route, "item_type": n.item_type, "order": n.order, "required_permission": n.required_permission, "module": n.module, "enabled": n.enabled} for n in values if not n.required_permission or n.required_permission in allowed or user.is_platform_admin]


@router.get("/navigation/all")
async def all_navigation(user: User = Depends(require_permission("navigation.manage")), db: AsyncSession = Depends(get_db)):
    values = (await db.scalars(select(NavigationItem).where(NavigationItem.organization_id == user.organization_id).order_by(NavigationItem.order))).all()
    return values


@router.post("/navigation", status_code=201)
async def create_navigation(body: NavigationInput, actor: User = Depends(require_permission("navigation.manage")), db: AsyncSession = Depends(get_db)):
    item = NavigationItem(organization_id=actor.organization_id, **body.model_dump())
    db.add(item)
    await db.commit()
    await record_audit(actor, "navigation.created", "navigation_item", item.id)
    return item


@router.delete("/navigation/{item_id}", status_code=204)
async def delete_navigation(item_id: str, actor: User = Depends(require_permission("navigation.manage")), db: AsyncSession = Depends(get_db)):
    item = await db.scalar(select(NavigationItem).where(NavigationItem.id == item_id, NavigationItem.organization_id == actor.organization_id))
    if not item:
        raise HTTPException(status_code=404, detail="Navigation item not found")
    await db.delete(item)
    await db.commit()
    await record_audit(actor, "navigation.deleted", "navigation_item", item_id)
    return Response(status_code=204)


@router.get("/dashboards/default")
async def dashboard(user: User = Depends(require_permission("dashboard.view")), db: AsyncSession = Depends(get_db)):
    value = await db.scalar(select(Dashboard).options(selectinload(Dashboard.widgets)).where(Dashboard.organization_id == user.organization_id, Dashboard.is_default.is_(True)))
    if not value:
        raise HTTPException(status_code=404, detail="Dashboard not configured")
    allowed = permission_codes(user)
    return {"id": value.id, "name": value.name, "widgets": [{"id": w.id, "type": w.type, "title": w.title, "position": w.position, "width": w.width, "height": w.height, "configuration": w.configuration} for w in value.widgets if not w.required_permission or w.required_permission in allowed]}


@router.get("/tasks")
async def tasks(user: User = Depends(require_permission("tasks.view")), db: AsyncSession = Depends(get_db)):
    scope = access_scope(user, "tasks.view")
    query = select(Task).where(Task.organization_id == user.organization_id)
    if scope == "OWN":
        query = query.where(or_(Task.assignee_id == user.id, Task.creator_id == user.id))
    elif scope == "TEAM":
        query = query.where(or_(Task.assignee_id == user.id, Task.creator_id == user.id, Task.team_id == user.team_id))
    elif scope == "DEPARTMENT":
        query = query.where(or_(Task.assignee_id == user.id, Task.creator_id == user.id, Task.department_id == user.department_id))
    values = (await db.scalars(query.order_by(Task.created_at.desc()))).all()
    return values


@router.post("/tasks", status_code=201)
async def create_task(body: TaskCreate, actor: User = Depends(require_permission("tasks.create")), db: AsyncSession = Depends(get_db)):
    scope = access_scope(actor, "tasks.create")
    if scope == "OWN" and body.assignee_id not in (None, actor.id):
        raise HTTPException(status_code=403, detail="You may only assign tasks to yourself")
    if body.assignee_id and not await db.scalar(select(User.id).where(User.id == body.assignee_id, User.organization_id == actor.organization_id)):
        raise HTTPException(status_code=422, detail="Assignee does not belong to this organization")
    values = body.model_dump()
    values["assignee_id"] = values["assignee_id"] or actor.id
    values["department_id"] = actor.department_id
    task = Task(organization_id=actor.organization_id, creator_id=actor.id, **values)
    db.add(task)
    await db.commit()
    return task
