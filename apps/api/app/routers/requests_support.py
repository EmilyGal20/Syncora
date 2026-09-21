import secrets
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record_audit
from ..database import get_db
from ..dependencies import access_scope, current_user, require_permission
from ..models import (
    BandMemberProfile,
    Dashboard,
    DashboardAssignment,
    Notification,
    Organization,
    RegistrationRequest,
    RegistrationReviewEvent,
    Role,
    SupportMessage,
    SupportTicket,
    User,
    UserPreference,
)
from ..rate_limit import public_limiter
from ..realtime import realtime_hub
from ..schemas import (
    RegistrationDecision,
    RegistrationReject,
    RegistrationRequestInput,
    SupportMessageInput,
    SupportStatusInput,
    SupportTicketInput,
)
from ..security import hash_password, hash_token
from .collaboration import create_notification, notification_json

router = APIRouter(tags=["access and support"])


def registration_json(value: RegistrationRequest, include_internal: bool = False) -> dict:
    result = {
        "id": value.id, "username": value.desired_username, "first_name": value.first_name,
        "last_name": value.last_name, "display_name": value.display_name, "email": value.email,
        "phone": value.phone, "preferred_locale": value.preferred_locale, "timezone": value.timezone,
        "workspace_mode": value.workspace_mode, "workspace_type": value.workspace_type,
        "workspace_name": value.requested_workspace_name, "requested_role": value.requested_role,
        "description": value.description, "details": value.details, "status": value.status,
        "resolved_organization_id": value.resolved_organization_id, "applicant_response": value.applicant_response,
        "created_at": value.created_at, "updated_at": value.updated_at,
    }
    if include_internal:
        result["internal_note"] = value.internal_note
    return result


def ticket_json(ticket: SupportTicket, messages: list[SupportMessage] | None = None, admin: bool = False) -> dict:
    result = {"id": ticket.id, "organization_id": ticket.organization_id, "requester_user_id": ticket.requester_user_id, "requester_name": ticket.requester_name, "contact": ticket.contact, "category": ticket.category, "subject": ticket.subject, "description": ticket.description, "status": ticket.status, "priority": ticket.priority, "current_route": ticket.current_route, "created_at": ticket.created_at, "updated_at": ticket.updated_at}
    if messages is not None:
        result["messages"] = [{"id": m.id, "author_name": m.author_name, "body": m.body, "internal": m.is_internal, "created_at": m.created_at} for m in messages if admin or not m.is_internal]
    return result


async def notify_platform_admins(db: AsyncSession, event_type: str, title: str, message: str, route: str, resource_type: str, resource_id: str) -> list[tuple[Notification, User]]:
    admins = (await db.scalars(select(User).where(User.is_platform_admin.is_(True), User.is_active.is_(True)))).all()
    values = []
    for admin in admins:
        notification = await create_notification(db, organization_id=admin.organization_id, recipient_id=admin.id, event_type=event_type, title=title, message=message, resource_type=resource_type, resource_id=resource_id, route=route)
        values.append((notification, admin))
    return values


@router.post("/public/registration-requests", status_code=201)
async def submit_registration(body: RegistrationRequestInput, request: Request, db: AsyncSession = Depends(get_db)):
    public_limiter.check(request, "registration", 20, 3600)
    username = body.username.strip().lower()
    email = body.email.lower() if body.email else None
    duplicate = await db.scalar(select(RegistrationRequest.id).where(RegistrationRequest.status.in_(["PENDING", "UNDER_REVIEW"]), or_(RegistrationRequest.desired_username == username, RegistrationRequest.email == email) if email else RegistrationRequest.desired_username == username))
    if duplicate:
        raise HTTPException(status_code=409, detail="An active request already uses those account details")
    value = RegistrationRequest(desired_username=username, password_hash=hash_password(body.password), first_name=body.first_name.strip(), last_name=body.last_name.strip(), display_name=body.display_name.strip(), email=email, phone=body.phone, preferred_locale=body.preferred_locale, timezone=body.timezone, workspace_mode=body.workspace_mode, workspace_type=body.workspace_type, requested_workspace_name=body.workspace_name.strip(), requested_role=body.requested_role.strip(), description=body.description, details=body.details, status="PENDING")
    db.add(value)
    await db.flush()
    db.add(RegistrationReviewEvent(request_id=value.id, action="submitted", metadata_json={"workspace_mode": value.workspace_mode}))
    notifications = await notify_platform_admins(db, "registration.submitted", "New access request", f"{value.display_name} requested access to {value.requested_workspace_name}.", "/admin", "registration_request", value.id)
    await db.commit()
    for notification, admin in notifications:
        await realtime_hub.publish(admin.organization_id, "registration.created", {"request_id": value.id}, {admin.id})
        await realtime_hub.publish(admin.organization_id, "notification.created", notification_json(notification), {admin.id})
    return {"id": value.id, "status": value.status}


@router.get("/registration-requests")
async def list_registrations(status: str | None = None, search: str = "", actor: User = Depends(require_permission("access_requests.manage")), db: AsyncSession = Depends(get_db)):
    query = select(RegistrationRequest)
    if not actor.is_platform_admin:
        query = query.where(RegistrationRequest.resolved_organization_id == actor.organization_id)
    if status:
        query = query.where(RegistrationRequest.status == status)
    if search:
        query = query.where(or_(RegistrationRequest.display_name.ilike(f"%{search}%"), RegistrationRequest.desired_username.ilike(f"%{search}%"), RegistrationRequest.requested_workspace_name.ilike(f"%{search}%")))
    values = (await db.scalars(query.order_by(RegistrationRequest.created_at.desc()))).all()
    return [registration_json(value, True) for value in values]


@router.post("/registration-requests/{request_id}/review")
async def review_registration(request_id: str, actor: User = Depends(require_permission("access_requests.manage")), db: AsyncSession = Depends(get_db)):
    value = await db.get(RegistrationRequest, request_id)
    if not value or (not actor.is_platform_admin and value.resolved_organization_id != actor.organization_id):
        raise HTTPException(status_code=404, detail="Request not found")
    if value.status == "PENDING":
        value.status = "UNDER_REVIEW"
        db.add(RegistrationReviewEvent(request_id=value.id, actor_id=actor.id, action="review_started", metadata_json={}))
        await db.commit()
    return registration_json(value, True)


@router.get("/registration-requests/options/{organization_id}")
async def registration_options(organization_id: str, actor: User = Depends(require_permission("access_requests.manage")), db: AsyncSession = Depends(get_db)):
    if not actor.is_platform_admin and organization_id != actor.organization_id:
        raise HTTPException(status_code=403, detail="Cannot configure another workspace")
    organization = await db.get(Organization, organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Workspace not found")
    roles = (await db.scalars(select(Role).where(Role.organization_id == organization_id, Role.is_active.is_(True)).order_by(Role.name))).all()
    dashboards = (await db.scalars(select(Dashboard).where(Dashboard.organization_id == organization_id).order_by(Dashboard.name))).all()
    return {"workspace": {"id": organization.id, "name": organization.name, "type": organization.workspace_type}, "roles": [{"id": role.id, "name": role.name} for role in roles], "dashboards": [{"id": dashboard.id, "name": dashboard.name, "status": dashboard.status} for dashboard in dashboards]}


@router.post("/registration-requests/{request_id}/approve")
async def approve_registration(request_id: str, body: RegistrationDecision, actor: User = Depends(require_permission("access_requests.manage")), db: AsyncSession = Depends(get_db)):
    value = await db.get(RegistrationRequest, request_id)
    organization = await db.get(Organization, body.organization_id)
    if not value or value.status not in {"PENDING", "UNDER_REVIEW"} or not organization:
        raise HTTPException(status_code=404, detail="Request or workspace not found")
    if not actor.is_platform_admin and organization.id != actor.organization_id:
        raise HTTPException(status_code=403, detail="Cannot approve into another workspace")
    if await db.scalar(select(User.id).where(User.organization_id == organization.id, or_(User.username == value.desired_username, User.email == value.email) if value.email else User.username == value.desired_username)):
        raise HTTPException(status_code=409, detail="Account details are no longer available")
    roles = list((await db.scalars(select(Role).where(Role.organization_id == organization.id, Role.id.in_(body.role_ids)))).all()) if body.role_ids else []
    if len(roles) != len(set(body.role_ids)):
        raise HTTPException(status_code=422, detail="Invalid role selection")
    dashboard = await db.scalar(select(Dashboard).where(Dashboard.id == body.dashboard_id, Dashboard.organization_id == organization.id)) if body.dashboard_id else None
    if body.dashboard_id and not dashboard:
        raise HTTPException(status_code=422, detail="Invalid dashboard selection")
    user = User(organization_id=organization.id, username=value.desired_username, email=value.email, full_name=value.display_name, first_name=value.first_name, last_name=value.last_name, phone=value.phone, job_title=value.requested_role or None, notes=value.description or None, password_hash=value.password_hash, locale=value.preferred_locale, team_id=body.team_id, department_id=body.department_id, roles=roles, is_active=True)
    db.add(user)
    await db.flush()
    db.add(UserPreference(user_id=user.id, locale=value.preferred_locale, timezone=value.timezone))
    if dashboard:
        db.add(DashboardAssignment(organization_id=organization.id, dashboard_id=dashboard.id, principal_type="user", principal_id=user.id, assigned_by=actor.id))
    if organization.workspace_type == "band":
        db.add(BandMemberProfile(organization_id=organization.id, user_id=user.id, stage_name=str(value.details.get("stage_name", ""))[:160], instruments=list(value.details.get("instruments", []))[:20], band_role=str(value.details.get("band_role", value.requested_role))[:120], public_details=str(value.details.get("public_details", ""))))
    value.status = "APPROVED";value.resolved_organization_id = organization.id;value.reviewed_by = actor.id;value.reviewed_at = datetime.now(UTC);value.applicant_response = body.applicant_response;value.internal_note = body.internal_note
    db.add(RegistrationReviewEvent(request_id=value.id, actor_id=actor.id, action="approved", metadata_json={"organization_id": organization.id, "role_ids": body.role_ids, "dashboard_id": body.dashboard_id}))
    await db.commit()
    await record_audit(actor, "registration.approved", "registration_request", value.id, {"user_id": user.id, "organization_id": organization.id})
    await realtime_hub.publish(actor.organization_id, "registration.updated", {"request_id": value.id, "status": value.status}, {actor.id})
    return {"user_id": user.id, "status": value.status}


@router.post("/registration-requests/{request_id}/reject")
async def reject_registration(request_id: str, body: RegistrationReject, actor: User = Depends(require_permission("access_requests.manage")), db: AsyncSession = Depends(get_db)):
    value = await db.get(RegistrationRequest, request_id)
    if not value or value.status not in {"PENDING", "UNDER_REVIEW"} or (not actor.is_platform_admin and value.resolved_organization_id != actor.organization_id):
        raise HTTPException(status_code=404, detail="Request not found")
    value.status = "REJECTED";value.reviewed_by = actor.id;value.reviewed_at = datetime.now(UTC);value.applicant_response = body.applicant_response;value.internal_note = body.internal_note
    db.add(RegistrationReviewEvent(request_id=value.id, actor_id=actor.id, action="rejected", metadata_json={}))
    await db.commit()
    await record_audit(actor, "registration.rejected", "registration_request", value.id)
    return {"status": value.status}


async def optional_user(credentials: HTTPAuthorizationCredentials | None, db: AsyncSession) -> User | None:
    return await current_user(credentials, db) if credentials else None


@router.post("/public/support", status_code=201)
async def create_guest_support(body: SupportTicketInput, request: Request, db: AsyncSession = Depends(get_db)):
    public_limiter.check(request, "guest-support", 20, 3600)
    if not body.requester_name.strip() or not body.contact:
        raise HTTPException(status_code=422, detail="Name and contact are required")
    raw_token = secrets.token_urlsafe(32)
    ticket = SupportTicket(requester_name=body.requester_name.strip(), contact=body.contact, guest_token_hash=hash_token(raw_token), category=body.category, subject=body.subject, description=body.description, current_route=body.current_route)
    db.add(ticket);await db.flush();db.add(SupportMessage(ticket_id=ticket.id, author_name=ticket.requester_name, body=ticket.description))
    notifications = await notify_platform_admins(db, "support.created", "New support request", ticket.subject, "/admin", "support_ticket", ticket.id)
    await db.commit()
    for notification, admin in notifications:
        await realtime_hub.publish(admin.organization_id, "support.created", {"ticket_id": ticket.id}, {admin.id});await realtime_hub.publish(admin.organization_id, "notification.created", notification_json(notification), {admin.id})
    return {"id": ticket.id, "access_token": raw_token, "status": ticket.status}


@router.post("/support", status_code=201)
async def create_user_support(body: SupportTicketInput, actor: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    ticket = SupportTicket(organization_id=actor.organization_id, requester_user_id=actor.id, requester_name=actor.full_name, contact=actor.email or actor.phone, category=body.category, subject=body.subject, description=body.description, current_route=body.current_route)
    db.add(ticket);await db.flush();db.add(SupportMessage(ticket_id=ticket.id, author_user_id=actor.id, author_name=actor.full_name, body=ticket.description))
    notifications = await notify_platform_admins(db, "support.created", "New support request", ticket.subject, "/admin", "support_ticket", ticket.id)
    await db.commit()
    for notification, admin in notifications:
        await realtime_hub.publish(admin.organization_id, "support.created", {"ticket_id": ticket.id}, {admin.id});await realtime_hub.publish(admin.organization_id, "notification.created", notification_json(notification), {admin.id})
    return ticket_json(ticket)


@router.get("/support")
async def list_support(actor: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    if access_scope(actor, "support.view") is not None:
        query = select(SupportTicket) if actor.is_platform_admin else select(SupportTicket).where(SupportTicket.organization_id == actor.organization_id)
    else:
        query = select(SupportTicket).where(SupportTicket.requester_user_id == actor.id, SupportTicket.organization_id == actor.organization_id)
    return [ticket_json(value) for value in (await db.scalars(query.order_by(SupportTicket.updated_at.desc()))).all()]


async def visible_ticket(ticket_id: str, actor: User, db: AsyncSession, manage: bool = False) -> SupportTicket:
    ticket = await db.get(SupportTicket, ticket_id)
    admin = access_scope(actor, "support.manage" if manage else "support.view") is not None
    if not ticket or (not (admin and (actor.is_platform_admin or ticket.organization_id == actor.organization_id)) and ticket.requester_user_id != actor.id):
        raise HTTPException(status_code=404, detail="Support ticket not found")
    return ticket


@router.get("/support/{ticket_id}")
async def support_detail(ticket_id: str, actor: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    ticket = await visible_ticket(ticket_id, actor, db)
    admin = access_scope(actor, "support.view") is not None
    messages = (await db.scalars(select(SupportMessage).where(SupportMessage.ticket_id == ticket.id).order_by(SupportMessage.created_at))).all()
    return ticket_json(ticket, messages, admin)


@router.post("/support/{ticket_id}/messages", status_code=201)
async def support_reply(ticket_id: str, body: SupportMessageInput, actor: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    ticket = await visible_ticket(ticket_id, actor, db)
    admin = access_scope(actor, "support.reply") is not None
    if body.internal and access_scope(actor, "support.internal_notes") is None:
        raise HTTPException(status_code=403, detail="Internal note permission required")
    message = SupportMessage(ticket_id=ticket.id, author_user_id=actor.id, author_name=actor.full_name, body=body.body, is_internal=body.internal)
    db.add(message);ticket.updated_at = datetime.now(UTC)
    recipient = ticket.requester_user_id if admin and not body.internal else None
    notification = await create_notification(db, organization_id=ticket.organization_id, recipient_id=recipient, event_type="support.reply", title="New support reply", message=ticket.subject, resource_type="support_ticket", resource_id=ticket.id, route="/support") if recipient and ticket.organization_id else None
    await db.commit()
    recipients = {ticket.requester_user_id} if admin and ticket.requester_user_id and not body.internal else set()
    if not admin:
        recipients = {user.id for user in (await db.scalars(select(User).where(User.is_platform_admin.is_(True), User.is_active.is_(True)))).all()}
    await realtime_hub.publish(ticket.organization_id or actor.organization_id, "support.message", {"ticket_id": ticket.id}, recipients)
    if notification:
        await realtime_hub.publish(ticket.organization_id, "notification.created", notification_json(notification), {recipient})
    return {"id": message.id}


@router.patch("/support/{ticket_id}/status")
async def support_status(ticket_id: str, body: SupportStatusInput, actor: User = Depends(require_permission("support.manage")), db: AsyncSession = Depends(get_db)):
    ticket = await visible_ticket(ticket_id, actor, db, True);ticket.status = body.status;await db.commit()
    await realtime_hub.publish(ticket.organization_id or actor.organization_id, "support.updated", {"ticket_id": ticket.id, "status": ticket.status}, {ticket.requester_user_id} if ticket.requester_user_id else set())
    return ticket_json(ticket)


@router.get("/public/support/{ticket_id}")
async def guest_support_detail(ticket_id: str, token: str, db: AsyncSession = Depends(get_db)):
    ticket = await db.scalar(select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.guest_token_hash == hash_token(token)))
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")
    messages = (await db.scalars(select(SupportMessage).where(SupportMessage.ticket_id == ticket.id, SupportMessage.is_internal.is_(False)).order_by(SupportMessage.created_at))).all()
    return ticket_json(ticket, messages)


@router.post("/public/support/{ticket_id}/messages", status_code=201)
async def guest_support_reply(ticket_id: str, token: str, body: SupportMessageInput, request: Request, db: AsyncSession = Depends(get_db)):
    public_limiter.check(request, "guest-support-reply", 20, 3600)
    ticket = await db.scalar(select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.guest_token_hash == hash_token(token)))
    if not ticket:
        raise HTTPException(status_code=404, detail="Support ticket not found")
    message = SupportMessage(ticket_id=ticket.id, author_name=ticket.requester_name, body=body.body);db.add(message);ticket.updated_at = datetime.now(UTC);await db.commit()
    return {"id": message.id}
