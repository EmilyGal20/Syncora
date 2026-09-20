from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..audit import record_audit
from ..database import get_db
from ..dependencies import access_scope, current_user, permission_scopes, require_permission
from ..models import (
    AccessGrant,
    Announcement,
    Department,
    Event,
    Organization,
    Permission,
    Role,
    Task,
    Team,
    User,
    UserPreference,
    team_members,
)
from ..schemas import AnnouncementInput, EventInput, GrantInput, PreferenceUpdate, RoleUpdate, TaskUpdate, TeamInput

router = APIRouter(tags=["phase-2 workspace"])


@router.put("/navigation/order")
async def reorder_navigation(ids: list[str], actor: User = Depends(require_permission("navigation.manage")), db: AsyncSession = Depends(get_db)):
    from ..models import NavigationItem
    items = list((await db.scalars(select(NavigationItem).where(NavigationItem.organization_id == actor.organization_id, NavigationItem.id.in_(ids)))).all())
    if len(items) != len(set(ids)): raise HTTPException(status_code=422, detail="Invalid navigation item")
    positions = {value: index for index, value in enumerate(ids)}
    for item in items: item.order = positions[item.id]
    await db.commit(); await record_audit(actor, "navigation.reordered", "navigation_item", actor.organization_id)
    return {"updated": len(items)}


def scoped_clause(model, user: User, scope: str, owner, team=None, department=None):
    if scope == "ORGANIZATION":
        return model.organization_id == user.organization_id
    checks = [owner == user.id]
    if scope == "TEAM" and team is not None and user.team_id:
        checks.append(team == user.team_id)
    if scope == "DEPARTMENT" and department is not None and user.department_id:
        checks.append(department == user.department_id)
    return (model.organization_id == user.organization_id) & or_(*checks)


async def validate_users(db: AsyncSession, organization_id: str, ids: list[str]) -> list[User]:
    users = list((await db.scalars(select(User).where(User.organization_id == organization_id, User.id.in_(ids)))).all()) if ids else []
    if len(users) != len(set(ids)):
        raise HTTPException(status_code=422, detail="One or more users are outside this organization")
    return users


@router.get("/access/roles")
async def role_access(actor: User = Depends(require_permission("roles.manage")), db: AsyncSession = Depends(get_db)):
    roles = list((await db.scalars(select(Role).where(Role.organization_id == actor.organization_id).order_by(Role.name))).all())
    grants = list((await db.scalars(select(AccessGrant).options(selectinload(AccessGrant.permission)).where(AccessGrant.organization_id == actor.organization_id, AccessGrant.principal_type == "role"))).all())
    return [{"id": r.id, "name": r.name, "description": r.description, "is_active": r.is_active, "default_locale": r.default_locale,
             "grants": [{"permission_code": g.permission.code, "scope": g.scope, "effect": g.effect} for g in grants if g.principal_id == r.id]} for r in roles]


async def replace_grants(db: AsyncSession, actor: User, principal_type: str, principal_id: str, grants: list[GrantInput]):
    previous = list((await db.scalars(select(AccessGrant).options(selectinload(AccessGrant.permission)).where(AccessGrant.organization_id == actor.organization_id, AccessGrant.principal_type == principal_type, AccessGrant.principal_id == principal_id))).all())
    await db.execute(delete(AccessGrant).where(AccessGrant.organization_id == actor.organization_id, AccessGrant.principal_type == principal_type, AccessGrant.principal_id == principal_id))
    permissions = {p.code: p for p in (await db.scalars(select(Permission).where(Permission.code.in_([g.permission_code for g in grants])))).all()}
    if len(permissions) != len({g.permission_code for g in grants}):
        raise HTTPException(status_code=422, detail="Unknown permission code")
    db.add_all([AccessGrant(organization_id=actor.organization_id, principal_type=principal_type, principal_id=principal_id, permission_id=permissions[g.permission_code].id, scope=g.scope, effect=g.effect) for g in grants])
    old = {g.permission.code: {"effect": g.effect, "scope": g.scope} for g in previous}
    new = {g.permission_code: {"effect": g.effect, "scope": g.scope} for g in grants}
    return [{"permission": code, "old": old.get(code), "new": new.get(code)} for code in sorted(old.keys() | new.keys()) if old.get(code) != new.get(code)]


@router.patch("/roles/{role_id}")
async def update_role(role_id: str, body: RoleUpdate, actor: User = Depends(require_permission("roles.manage")), db: AsyncSession = Depends(get_db)):
    role = await db.scalar(select(Role).where(Role.id == role_id, Role.organization_id == actor.organization_id))
    if not role: raise HTTPException(status_code=404, detail="Role not found")
    for key, value in body.model_dump(exclude_unset=True, exclude={"grants"}).items(): setattr(role, key, value)
    changes = await replace_grants(db, actor, "role", role.id, body.grants) if body.grants is not None else []
    await db.commit(); await record_audit(actor, "role.permissions.changed" if changes else "role.changed", "role", role.id, {"changes": changes})
    return {"id": role.id, "name": role.name}


@router.post("/roles/{role_id}/duplicate", status_code=201)
async def duplicate_role(role_id: str, actor: User = Depends(require_permission("roles.manage")), db: AsyncSession = Depends(get_db)):
    source = await db.scalar(select(Role).where(Role.id == role_id, Role.organization_id == actor.organization_id))
    if not source: raise HTTPException(status_code=404, detail="Role not found")
    created = Role(organization_id=actor.organization_id, name=f"{source.name} copy", description=source.description, default_locale=source.default_locale)
    db.add(created); await db.flush()
    grants = list((await db.scalars(select(AccessGrant).where(AccessGrant.principal_type == "role", AccessGrant.principal_id == role_id))).all())
    db.add_all([AccessGrant(organization_id=actor.organization_id, principal_type="role", principal_id=created.id, permission_id=g.permission_id, scope=g.scope, effect=g.effect) for g in grants])
    await db.commit(); await record_audit(actor, "role.duplicated", "role", created.id)
    return {"id": created.id, "name": created.name}


@router.put("/users/{user_id}/grants")
async def user_grants(user_id: str, body: list[GrantInput], actor: User = Depends(require_permission("users.edit")), db: AsyncSession = Depends(get_db)):
    target = await db.scalar(select(User).where(User.id == user_id, User.organization_id == actor.organization_id))
    if not target: raise HTTPException(status_code=404, detail="User not found")
    changes = await replace_grants(db, actor, "user", target.id, body); await db.commit()
    await record_audit(actor, "user.permissions.changed", "user", target.id, {"changes": changes})
    return {"updated": True}


@router.get("/users/{user_id}/access")
async def user_access(user_id: str, actor: User = Depends(require_permission("users.view")), db: AsyncSession = Depends(get_db)):
    target = await db.scalar(select(User).options(selectinload(User.roles).selectinload(Role.permissions)).where(User.id == user_id, User.organization_id == actor.organization_id))
    if not target: raise HTTPException(status_code=404, detail="User not found")
    role_ids = [role.id for role in target.roles]
    grants = list((await db.scalars(select(AccessGrant).options(selectinload(AccessGrant.permission)).where(
        AccessGrant.organization_id == actor.organization_id,
        ((AccessGrant.principal_type == "user") & (AccessGrant.principal_id == target.id)) |
        ((AccessGrant.principal_type == "role") & (AccessGrant.principal_id.in_(role_ids))),
    ))).all())
    target._access_grants = grants
    role_grants = [g for g in grants if g.principal_type == "role" and g.effect == "allow"]
    direct_grants = [g for g in grants if g.principal_type == "user"]
    return {
        "user_id": target.id,
        "role_grants": [{"permission_code": g.permission.code, "scope": g.scope, "effect": g.effect} for g in role_grants],
        "overrides": [{"permission_code": g.permission.code, "scope": g.scope, "effect": g.effect} for g in direct_grants],
        "effective": permission_scopes(target),
    }


@router.get("/users/{user_id}/preferences")
async def admin_user_preferences(user_id: str, actor: User = Depends(require_permission("users.view")), db: AsyncSession = Depends(get_db)):
    target = await db.scalar(select(User).where(User.id == user_id, User.organization_id == actor.organization_id))
    if not target: raise HTTPException(status_code=404, detail="User not found")
    pref = await db.get(UserPreference, target.id)
    return {"locale": target.locale, "theme": pref.theme if pref else "system", "timezone": pref.timezone if pref else "UTC"}


@router.patch("/users/{user_id}/preferences")
async def admin_update_user_preferences(user_id: str, body: PreferenceUpdate, actor: User = Depends(require_permission("users.edit")), db: AsyncSession = Depends(get_db)):
    target = await db.scalar(select(User).where(User.id == user_id, User.organization_id == actor.organization_id))
    if not target: raise HTTPException(status_code=404, detail="User not found")
    pref = await db.get(UserPreference, target.id)
    if not pref:
        pref = UserPreference(user_id=target.id)
        db.add(pref)
    if body.locale is not None: target.locale = body.locale
    for key in ["theme", "sidebar_collapsed", "timezone"]:
        value = getattr(body, key)
        if value is not None: setattr(pref, key, value)
    await db.commit()
    await record_audit(actor, "user.preferences.changed", "user", target.id, {"locale": target.locale, "theme": pref.theme})
    return {"locale": target.locale, "theme": pref.theme, "timezone": pref.timezone}


@router.get("/preferences")
async def preferences(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    pref = await db.get(UserPreference, user.id)
    org = await db.get(Organization, user.organization_id)
    role_locale = next((r.default_locale for r in user.roles if r.default_locale), None)
    return {"locale": user.locale or role_locale or org.default_locale, "theme": pref.theme or org.default_theme,
            "sidebar_collapsed": pref.sidebar_collapsed, "timezone": pref.timezone,
            "allow_locale": org.allow_user_locale, "allow_theme": org.allow_user_theme}


@router.patch("/preferences")
async def update_preferences(body: PreferenceUpdate, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    pref = await db.get(UserPreference, user.id); org = await db.get(Organization, user.organization_id)
    if body.locale and not org.allow_user_locale: raise HTTPException(status_code=403, detail="Language is managed by your organization")
    if body.theme and not org.allow_user_theme: raise HTTPException(status_code=403, detail="Theme is managed by your organization")
    if body.locale: user.locale = body.locale
    for key in ["theme", "sidebar_collapsed", "timezone"]:
        value = getattr(body, key)
        if value is not None: setattr(pref, key, value)
    await db.commit(); return await preferences(user, db)


def task_visible(task: Task, user: User, scope: str) -> bool:
    return task.organization_id == user.organization_id and (scope == "ORGANIZATION" or task.assignee_id == user.id or task.creator_id == user.id or (scope == "TEAM" and task.team_id == user.team_id) or (scope == "DEPARTMENT" and task.department_id == user.department_id))


@router.get("/tasks/{task_id}")
async def task_detail(task_id: str, user: User = Depends(require_permission("tasks.view")), db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task or not task_visible(task, user, access_scope(user, "tasks.view") or "OWN"): raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/tasks/{task_id}")
async def update_task(task_id: str, body: TaskUpdate, user: User = Depends(require_permission("tasks.edit")), db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task or not task_visible(task, user, access_scope(user, "tasks.edit") or "OWN"): raise HTTPException(status_code=404, detail="Task not found")
    for key, value in body.model_dump(exclude_unset=True).items(): setattr(task, key, value)
    await db.commit(); return task


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: str, user: User = Depends(require_permission("tasks.delete")), db: AsyncSession = Depends(get_db)):
    task = await db.get(Task, task_id)
    if not task or not task_visible(task, user, access_scope(user, "tasks.delete") or "OWN"): raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task); await db.commit(); return Response(status_code=204)


def event_clause(user: User, scope: str):
    own = or_(Event.owner_user_id == user.id, Event.creator_id == user.id, Event.participants.any(User.id == user.id))
    if scope == "ORGANIZATION": return Event.organization_id == user.organization_id
    if scope == "TEAM": own = or_(own, Event.team_id == user.team_id)
    if scope == "DEPARTMENT": own = or_(own, Event.department_id == user.department_id)
    return (Event.organization_id == user.organization_id) & own


@router.get("/events")
async def events(user_id: str | None = None, user: User = Depends(require_permission("schedule.view")), db: AsyncSession = Depends(get_db)):
    scope = access_scope(user, "schedule.view") or "OWN"
    if user_id and user_id != user.id and scope != "ORGANIZATION": raise HTTPException(status_code=403, detail="Organization schedule scope required")
    query = select(Event).options(selectinload(Event.participants)).where(event_clause(user, scope))
    if user_id: query = query.where(or_(Event.owner_user_id == user_id, Event.participants.any(User.id == user_id)))
    return list((await db.scalars(query.order_by(Event.starts_at))).unique().all())


@router.get("/events/{event_id}")
async def event_detail(event_id: str, user: User = Depends(require_permission("schedule.view")), db: AsyncSession = Depends(get_db)):
    event = await db.scalar(select(Event).options(selectinload(Event.participants)).where(Event.id == event_id, event_clause(user, access_scope(user, "schedule.view") or "OWN")))
    if not event: raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.post("/events", status_code=201)
async def create_event(body: EventInput, actor: User = Depends(require_permission("schedule.create")), db: AsyncSession = Depends(get_db)):
    if body.ends_at <= body.starts_at: raise HTTPException(status_code=422, detail="End must be after start")
    participants = await validate_users(db, actor.organization_id, body.participant_ids)
    owner = body.owner_user_id or actor.id
    if owner != actor.id and access_scope(actor, "schedule.create") != "ORGANIZATION": raise HTTPException(status_code=403, detail="Cannot create events for another user")
    event = Event(organization_id=actor.organization_id, creator_id=actor.id, owner_user_id=owner, participants=participants, **body.model_dump(exclude={"participant_ids", "owner_user_id"}))
    db.add(event); await db.commit(); await record_audit(actor, "schedule.created", "event", event.id)
    return event


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(event_id: str, actor: User = Depends(require_permission("schedule.delete")), db: AsyncSession = Depends(get_db)):
    event = await db.scalar(select(Event).where(Event.id == event_id, event_clause(actor, access_scope(actor, "schedule.delete") or "OWN")))
    if not event: raise HTTPException(status_code=404, detail="Event not found")
    await db.delete(event); await db.commit(); await record_audit(actor, "schedule.deleted", "event", event_id); return Response(status_code=204)


@router.get("/teams")
async def teams(user: User = Depends(require_permission("teams.view")), db: AsyncSession = Depends(get_db)):
    scope = access_scope(user, "teams.view") or "OWN"; query = select(Team).where(Team.organization_id == user.organization_id)
    if scope != "ORGANIZATION": query = query.where(or_(Team.id == user.team_id, Team.manager_id == user.id))
    return list((await db.scalars(query.order_by(Team.name))).all())


@router.get("/departments")
async def departments(user: User = Depends(require_permission("users.view")), db: AsyncSession = Depends(get_db)):
    return list((await db.scalars(select(Department).where(Department.organization_id == user.organization_id).order_by(Department.name))).all())


@router.post("/teams", status_code=201)
async def create_team(body: TeamInput, actor: User = Depends(require_permission("teams.manage")), db: AsyncSession = Depends(get_db)):
    members = await validate_users(db, actor.organization_id, body.member_ids)
    team = Team(organization_id=actor.organization_id, name=body.name, description=body.description, manager_id=body.manager_id, is_active=body.is_active)
    db.add(team); await db.flush(); await db.execute(team_members.insert(), [{"team_id": team.id, "user_id": u.id} for u in members]) if members else None
    await db.commit(); await record_audit(actor, "team.created", "team", team.id); return team


@router.get("/announcements")
async def announcements(user: User = Depends(require_permission("announcements.view")), db: AsyncSession = Depends(get_db)):
    now = datetime.now(UTC); visible = or_(Announcement.audience == "organization", (Announcement.audience == "team") & (Announcement.team_id == user.team_id), (Announcement.audience == "department") & (Announcement.department_id == user.department_id), Announcement.target_users.any(User.id == user.id))
    return list((await db.scalars(select(Announcement).where(Announcement.organization_id == user.organization_id, Announcement.published.is_(True), or_(Announcement.publish_at.is_(None), Announcement.publish_at <= now), or_(Announcement.expires_at.is_(None), Announcement.expires_at > now), visible).order_by(Announcement.created_at.desc()))).all())


@router.post("/announcements", status_code=201)
async def create_announcement(body: AnnouncementInput, actor: User = Depends(require_permission("announcements.manage")), db: AsyncSession = Depends(get_db)):
    targets = await validate_users(db, actor.organization_id, body.target_user_ids)
    item = Announcement(organization_id=actor.organization_id, creator_id=actor.id, target_users=targets, **body.model_dump(exclude={"target_user_ids"}))
    db.add(item); await db.commit(); await record_audit(actor, "announcement.created", "announcement", item.id); return item


@router.get("/dashboard/summary")
async def dashboard_summary(user: User = Depends(require_permission("dashboard.view")), db: AsyncSession = Depends(get_db)):
    scope = access_scope(user, "tasks.view") or "OWN"
    query = select(Task).where(Task.organization_id == user.organization_id)
    if scope == "OWN": query = query.where(or_(Task.assignee_id == user.id, Task.creator_id == user.id))
    elif scope == "TEAM": query = query.where(or_(Task.assignee_id == user.id, Task.creator_id == user.id, Task.team_id == user.team_id))
    elif scope == "DEPARTMENT": query = query.where(or_(Task.assignee_id == user.id, Task.creator_id == user.id, Task.department_id == user.department_id))
    tasks = await db.scalars(query)
    task_list = list(tasks.all()); event_list = await events(None, user, db); announcement_list = await announcements(user, db)
    return {"open_tasks": sum(t.status.value != "completed" for t in task_list), "completed_tasks": sum(t.status.value == "completed" for t in task_list), "upcoming_events": event_list[:5], "announcements": announcement_list[:5]}
