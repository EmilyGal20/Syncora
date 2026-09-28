from datetime import UTC, datetime

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..audit import record_audit
from ..database import SessionLocal, get_db
from ..dependencies import current_user, permission_codes, require_permission
from ..infrastructure.mongodb.models import NotificationDocument
from ..infrastructure.mongodb.repositories import notification_repository
from ..models import (
    Dashboard,
    DashboardAssignment,
    DashboardWidget,
    Notification,
    Role,
    Team,
    User,
    WorkspaceMembership,
)
from ..realtime import realtime_hub
from ..schemas import DashboardAssignmentInput, DashboardInput, DashboardPrincipalAssignment
from ..security import decode_access_token

router = APIRouter(tags=["collaboration"])


def notification_json(value: Notification) -> dict:
    return {"id": value.id, "type": value.type, "title": value.title, "message": value.message, "resource_type": value.resource_type, "resource_id": value.resource_id, "route": value.route, "read_at": value.read_at, "created_at": value.created_at}


async def create_notification(db: AsyncSession, *, organization_id: str, recipient_id: str, event_type: str, title: str, message: str = "", resource_type: str | None = None, resource_id: str | None = None, route: str | None = None) -> Notification:
    value = Notification(organization_id=organization_id, recipient_id=recipient_id, type=event_type, title=title, message=message, resource_type=resource_type, resource_id=resource_id, route=route)
    db.add(value)
    await db.flush()
    await notification_repository.upsert(NotificationDocument(notification_id=value.id, workspace_id=organization_id, recipient_user_id=recipient_id, type=event_type, title_key=title, message_data={"text": message}, resource_type=resource_type, resource_id=resource_id, route=route, created_at=value.created_at))
    return value


@router.get("/notifications")
async def notifications(unread: bool = False, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100), user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    mongo_result = await notification_repository.list(user.organization_id, user.id, unread, page, page_size)
    if mongo_result is not None:
        return {
            **mongo_result,
            "items": [
                {
                    "id": item["notification_id"],
                    "type": item["type"],
                    "title": item["title_key"],
                    "message": item.get("message_data", {}).get("text", ""),
                    "resource_type": item.get("resource_type"),
                    "resource_id": item.get("resource_id"),
                    "route": item.get("route"),
                    "read_at": item.get("read_at"),
                    "created_at": item["created_at"],
                }
                for item in mongo_result["items"]
            ],
        }
    clause = (Notification.organization_id == user.organization_id) & (Notification.recipient_id == user.id)
    if unread:
        clause &= Notification.read_at.is_(None)
    total = await db.scalar(select(func.count()).select_from(Notification).where(clause))
    unread_count = await db.scalar(select(func.count()).select_from(Notification).where(Notification.organization_id == user.organization_id, Notification.recipient_id == user.id, Notification.read_at.is_(None)))
    values = (await db.scalars(select(Notification).where(clause).order_by(Notification.created_at.desc()).offset((page - 1) * page_size).limit(page_size))).all()
    return {"items": [notification_json(value) for value in values], "total": total or 0, "unread": unread_count or 0}


@router.patch("/notifications/{notification_id}/read")
async def read_notification(notification_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    mongo_value = await notification_repository.mark(user.organization_id, user.id, notification_id, True)
    value = await db.scalar(select(Notification).where(Notification.id == notification_id, Notification.organization_id == user.organization_id, Notification.recipient_id == user.id))
    if not value and not mongo_value:
        raise HTTPException(status_code=404, detail="Notification not found")
    if value:
        value.read_at = value.read_at or datetime.now(UTC)
        await db.commit()
        return notification_json(value)
    return {"id": mongo_value["notification_id"], "read_at": mongo_value["read_at"]}


@router.post("/notifications/read-all", status_code=204)
async def read_all_notifications(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await notification_repository.mark_all(user.organization_id, user.id)
    values = (await db.scalars(select(Notification).where(Notification.organization_id == user.organization_id, Notification.recipient_id == user.id, Notification.read_at.is_(None)))).all()
    now = datetime.now(UTC)
    for value in values:
        value.read_at = now
    await db.commit()


async def resolve_dashboard(db: AsyncSession, user: User) -> Dashboard | None:
    role_ids = [role.id for role in user.roles]
    choices = [
        ("user", [user.id]),
        ("team", [user.team_id] if user.team_id else []),
        ("role", role_ids),
    ]
    for principal_type, ids in choices:
        if ids:
            assignment = await db.scalar(select(DashboardAssignment).options(selectinload(DashboardAssignment.dashboard).selectinload(Dashboard.widgets)).where(DashboardAssignment.organization_id == user.organization_id, DashboardAssignment.principal_type == principal_type, DashboardAssignment.principal_id.in_(ids)).order_by(DashboardAssignment.created_at.desc(), DashboardAssignment.id.asc()))
            if assignment and assignment.dashboard.status == "published":
                return assignment.dashboard
    return await db.scalar(select(Dashboard).options(selectinload(Dashboard.widgets)).where(Dashboard.organization_id == user.organization_id, Dashboard.is_default.is_(True), Dashboard.status == "published"))


@router.get("/dashboards/resolved")
async def resolved_dashboard(user: User = Depends(require_permission("dashboard.view")), db: AsyncSession = Depends(get_db)):
    value = await resolve_dashboard(db, user)
    if not value:
        raise HTTPException(status_code=404, detail="Dashboard not configured")
    allowed = permission_codes(user)
    return {"id": value.id, "name": value.name, "status": value.status, "widgets": [{"id": w.id, "type": w.type, "title": w.title, "position": w.position, "width": w.width, "height": w.height, "configuration": w.configuration} for w in value.widgets if not w.required_permission or w.required_permission in allowed]}


@router.get("/dashboards")
async def list_dashboards(user: User = Depends(require_permission("dashboards.edit")), db: AsyncSession = Depends(get_db)):
    values = (await db.scalars(select(Dashboard).where(Dashboard.organization_id == user.organization_id).order_by(Dashboard.name))).all()
    return [{"id": value.id, "name": value.name, "status": value.status, "is_default": value.is_default} for value in values]


@router.post("/dashboards", status_code=201)
async def create_dashboard(body: DashboardInput, actor: User = Depends(require_permission("dashboards.create")), db: AsyncSession = Depends(get_db)):
    if body.status == "published" and "dashboards.publish" not in permission_codes(actor):
        raise HTTPException(status_code=403, detail="Publish permission required")
    value = Dashboard(organization_id=actor.organization_id, name=body.name, status=body.status)
    value.widgets = [DashboardWidget(type=str(w.get("type", "kpi")), title=str(w.get("title", "Widget"))[:100], position=index, width=max(1, min(12, int(w.get("width", 4)))), height=max(1, min(8, int(w.get("height", 1)))), required_permission=w.get("required_permission"), configuration=w.get("configuration", {})) for index, w in enumerate(body.widgets)]
    db.add(value)
    await db.commit()
    return {"id": value.id, "name": value.name, "status": value.status}


def dashboard_json(value: Dashboard) -> dict:
    return {"id": value.id, "name": value.name, "status": value.status, "is_default": value.is_default, "widgets": [{"id": widget.id, "type": widget.type, "title": widget.title, "position": widget.position, "width": widget.width, "height": widget.height, "required_permission": widget.required_permission, "configuration": widget.configuration} for widget in sorted(value.widgets, key=lambda item: item.position)]}


@router.get("/dashboards/{dashboard_id}")
async def dashboard_detail(dashboard_id: str, actor: User = Depends(require_permission("dashboards.edit")), db: AsyncSession = Depends(get_db)):
    value = await db.scalar(select(Dashboard).options(selectinload(Dashboard.widgets)).where(Dashboard.id == dashboard_id, Dashboard.organization_id == actor.organization_id))
    if not value:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard_json(value)


@router.put("/dashboards/{dashboard_id}")
async def update_dashboard(dashboard_id: str, body: DashboardInput, actor: User = Depends(require_permission("dashboards.edit")), db: AsyncSession = Depends(get_db)):
    value = await db.scalar(select(Dashboard).options(selectinload(Dashboard.widgets)).where(Dashboard.id == dashboard_id, Dashboard.organization_id == actor.organization_id))
    if not value:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if body.status == "published" and "dashboards.publish" not in permission_codes(actor):
        raise HTTPException(status_code=403, detail="Publish permission required")
    value.name = body.name
    value.status = body.status
    value.widgets.clear()
    value.widgets.extend([DashboardWidget(type=str(widget.get("type", "kpi"))[:50], title=str(widget.get("title", "Widget"))[:100], position=index, width=max(1, min(12, int(widget.get("width", 4)))), height=max(1, min(8, int(widget.get("height", 1)))), required_permission=widget.get("required_permission"), configuration=widget.get("configuration", {})) for index, widget in enumerate(body.widgets)])
    await db.commit()
    await record_audit(actor, "dashboard.updated", "dashboard", value.id, {"status": value.status})
    await realtime_hub.publish(actor.organization_id, "dashboard.published" if value.status == "published" else "dashboard.updated", {"id": value.id})
    return dashboard_json(value)


@router.post("/dashboards/{dashboard_id}/duplicate", status_code=201)
async def duplicate_dashboard(dashboard_id: str, actor: User = Depends(require_permission("dashboards.create")), db: AsyncSession = Depends(get_db)):
    source = await db.scalar(select(Dashboard).options(selectinload(Dashboard.widgets)).where(Dashboard.id == dashboard_id, Dashboard.organization_id == actor.organization_id))
    if not source:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    value = Dashboard(organization_id=actor.organization_id, name=f"{source.name} copy"[:100], status="draft")
    value.widgets = [DashboardWidget(type=widget.type, title=widget.title, position=index, width=widget.width, height=widget.height, required_permission=widget.required_permission, configuration=dict(widget.configuration or {})) for index, widget in enumerate(source.widgets)]
    db.add(value)
    await db.commit()
    return dashboard_json(value)


@router.delete("/dashboards/{dashboard_id}", status_code=204)
async def delete_dashboard(dashboard_id: str, actor: User = Depends(require_permission("dashboards.delete")), db: AsyncSession = Depends(get_db)):
    value = await db.scalar(select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.organization_id == actor.organization_id))
    if not value:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    assigned = await db.scalar(select(DashboardAssignment.id).where(DashboardAssignment.dashboard_id == value.id).limit(1))
    if value.is_default or assigned:
        raise HTTPException(status_code=409, detail="Remove dashboard assignments before deleting")
    await db.delete(value)
    await db.commit()
    await record_audit(actor, "dashboard.deleted", "dashboard", dashboard_id)


@router.get("/dashboards/{dashboard_id}/assignments")
async def dashboard_assignments(dashboard_id: str, actor: User = Depends(require_permission("dashboards.assign")), db: AsyncSession = Depends(get_db)):
    dashboard = await db.scalar(select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.organization_id == actor.organization_id))
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    values = (await db.scalars(select(DashboardAssignment).where(DashboardAssignment.dashboard_id == dashboard.id, DashboardAssignment.organization_id == actor.organization_id).order_by(DashboardAssignment.principal_type, DashboardAssignment.created_at))).all()
    result = [{"id": value.id, "principal_type": value.principal_type, "principal_id": value.principal_id} for value in values]
    if dashboard.is_default:
        result.insert(0, {"id": "organization", "principal_type": "organization", "principal_id": actor.organization_id})
    return result


@router.put("/dashboards/{dashboard_id}/assignments", status_code=201)
async def assign_dashboard(dashboard_id: str, body: DashboardPrincipalAssignment, actor: User = Depends(require_permission("dashboards.assign")), db: AsyncSession = Depends(get_db)):
    dashboard = await db.scalar(select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.organization_id == actor.organization_id))
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    if body.principal_type == "organization":
        current = (await db.scalars(select(Dashboard).where(Dashboard.organization_id == actor.organization_id, Dashboard.is_default.is_(True)))).all()
        for value in current:
            value.is_default = False
        dashboard.is_default = True
        await db.commit()
        await record_audit(actor, "dashboard.default_assigned", "dashboard", dashboard.id)
        return {"principal_type": "organization", "principal_id": actor.organization_id}
    if not body.principal_id:
        raise HTTPException(status_code=422, detail="A role, team, or user is required")
    model = {"role": Role, "team": Team, "user": User}[body.principal_type]
    principal = await db.scalar(select(model.id).where(model.id == body.principal_id, model.organization_id == actor.organization_id))
    if not principal:
        raise HTTPException(status_code=404, detail="Assignment target not found")
    existing = await db.scalar(select(DashboardAssignment).where(DashboardAssignment.organization_id == actor.organization_id, DashboardAssignment.principal_type == body.principal_type, DashboardAssignment.principal_id == body.principal_id))
    if existing:
        existing.dashboard_id = dashboard.id
        existing.assigned_by = actor.id
        value = existing
    else:
        value = DashboardAssignment(organization_id=actor.organization_id, dashboard_id=dashboard.id, principal_type=body.principal_type, principal_id=body.principal_id, assigned_by=actor.id)
        db.add(value)
    await db.commit()
    await record_audit(actor, "dashboard.assigned", "dashboard", dashboard.id, body.model_dump())
    return {"id": value.id, **body.model_dump()}


@router.delete("/dashboards/{dashboard_id}/assignments/{assignment_id}", status_code=204)
async def remove_dashboard_assignment(dashboard_id: str, assignment_id: str, actor: User = Depends(require_permission("dashboards.assign")), db: AsyncSession = Depends(get_db)):
    if assignment_id == "organization":
        dashboard = await db.scalar(select(Dashboard).where(Dashboard.id == dashboard_id, Dashboard.organization_id == actor.organization_id))
        if not dashboard:
            raise HTTPException(status_code=404, detail="Dashboard not found")
        dashboard.is_default = False
    else:
        value = await db.scalar(select(DashboardAssignment).where(DashboardAssignment.id == assignment_id, DashboardAssignment.dashboard_id == dashboard_id, DashboardAssignment.organization_id == actor.organization_id))
        if not value:
            raise HTTPException(status_code=404, detail="Assignment not found")
        await db.delete(value)
    await db.commit()
    await record_audit(actor, "dashboard.assignment_removed", "dashboard", dashboard_id, {"assignment_id": assignment_id})


@router.put("/users/{user_id}/dashboard")
async def assign_user_dashboard(user_id: str, body: DashboardAssignmentInput, actor: User = Depends(require_permission("dashboards.assign")), db: AsyncSession = Depends(get_db)):
    target = await db.scalar(select(User).where(User.id == user_id, User.organization_id == actor.organization_id))
    dashboard = await db.scalar(select(Dashboard).where(Dashboard.id == body.dashboard_id, Dashboard.organization_id == actor.organization_id))
    if not target or not dashboard:
        raise HTTPException(status_code=404, detail="User or dashboard not found")
    assignment = await db.scalar(select(DashboardAssignment).where(DashboardAssignment.organization_id == actor.organization_id, DashboardAssignment.principal_type == "user", DashboardAssignment.principal_id == target.id))
    if assignment:
        assignment.dashboard_id = dashboard.id
        assignment.assigned_by = actor.id
    else:
        db.add(DashboardAssignment(organization_id=actor.organization_id, dashboard_id=dashboard.id, principal_type="user", principal_id=target.id, assigned_by=actor.id))
    notification = await create_notification(db, organization_id=actor.organization_id, recipient_id=target.id, event_type="dashboard.assigned", title="Your dashboard was updated", resource_type="dashboard", resource_id=dashboard.id, route="/dashboard")
    await db.commit()
    await realtime_hub.publish(actor.organization_id, "dashboard.assigned", {"dashboard_id": dashboard.id}, {target.id})
    await realtime_hub.publish(actor.organization_id, "notification.created", notification_json(notification), {target.id})
    return {"dashboard_id": dashboard.id}


@router.delete("/users/{user_id}/dashboard", status_code=204)
async def remove_user_dashboard(user_id: str, actor: User = Depends(require_permission("dashboards.assign")), db: AsyncSession = Depends(get_db)):
    assignment = await db.scalar(select(DashboardAssignment).where(DashboardAssignment.organization_id == actor.organization_id, DashboardAssignment.principal_type == "user", DashboardAssignment.principal_id == user_id))
    if assignment:
        await db.delete(assignment)
        await db.commit()


@router.websocket("/realtime")
async def realtime(websocket: WebSocket):
    protocols = [value.strip() for value in websocket.headers.get("sec-websocket-protocol", "").split(",")]
    token = protocols[1] if len(protocols) == 2 and protocols[0] == "syncora" else ""
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        await websocket.close(code=4401)
        return
    user_id, workspace_id = payload.get("sub"), payload.get("org")
    async with SessionLocal() as db:
        user = await db.scalar(select(User).where(User.id == user_id, User.is_active.is_(True)))
        if not user or not workspace_id:
            await websocket.close(code=4401)
            return
        if workspace_id != user.organization_id:
            membership = await db.scalar(select(WorkspaceMembership.id).where(WorkspaceMembership.user_id == user.id, WorkspaceMembership.organization_id == workspace_id, WorkspaceMembership.is_active.is_(True)))
            if not user.is_platform_admin or not membership:
                await websocket.close(code=4403)
                return
    await realtime_hub.connect(workspace_id, user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        realtime_hub.disconnect(workspace_id, user_id, websocket)
