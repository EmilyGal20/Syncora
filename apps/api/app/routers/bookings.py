import re
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes

from ..config import get_settings
from ..database import get_db
from ..dependencies import current_user, permission_codes, require_permission
from ..messaging import guest_status_url, notify_guest
from ..models import BookingLink, BookingRequest, Event, Organization, User
from ..rate_limit import public_limiter
from ..realtime import realtime_hub
from ..routers.collaboration import create_notification

router = APIRouter(tags=["bookings"])


class BookingLinkUpdate(BaseModel):
    slug: str | None = Field(default=None, min_length=3, max_length=80)
    title: str | None = Field(default=None, min_length=2, max_length=160)
    enabled: bool | None = None
    duration_minutes: int | None = Field(default=None, ge=15, le=480)


class PublicBookingInput(BaseModel):
    guest_name: str = Field(min_length=2, max_length=160)
    guest_organization: str = Field(default="", max_length=160)
    guest_email: str | None = Field(default=None, max_length=254)
    guest_phone: str | None = Field(default=None, max_length=40)
    reason: str = Field(min_length=2, max_length=240)
    notes: str = Field(default="", max_length=4000)
    starts_at: datetime
    ends_at: datetime | None = None
    timezone: str = Field(default="UTC", max_length=80)


class HostBookingInput(PublicBookingInput):
    kind: str = Field(pattern="^(meeting|appointment)$")


class BookingDecision(BaseModel):
    reason: str = Field(default="", max_length=1000)


def slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.strip().lower())
    return cleaned.strip("-")[:70] or "booking"


async def unique_slug(db: AsyncSession, base: str, exclude_id: str | None = None) -> str:
    candidate = slugify(base)
    index = 2
    while True:
        existing = await db.scalar(select(BookingLink).where(BookingLink.slug == candidate))
        if not existing or existing.id == exclude_id:
            return candidate
        candidate = f"{slugify(base)[:60]}-{index}"
        index += 1


def link_json(value: BookingLink) -> dict:
    origin = get_settings().public_app_url.rstrip("/")
    path = f"/book/{value.slug}"
    return {
        "id": value.id,
        "kind": value.kind,
        "slug": value.slug,
        "title": value.title,
        "enabled": value.enabled,
        "duration_minutes": value.duration_minutes,
        "owner_user_id": value.owner_user_id,
        "path": path,
        "url": f"{origin}{path}" if origin else path,
    }


def request_json(value: BookingRequest, include_token: bool = False) -> dict:
    payload = {
        "id": value.id,
        "link_id": value.link_id,
        "host_user_id": value.host_user_id,
        "event_id": value.event_id,
        "guest_name": value.guest_name,
        "guest_organization": value.guest_organization,
        "guest_email": value.guest_email,
        "guest_phone": value.guest_phone,
        "reason": value.reason,
        "notes": value.notes,
        "starts_at": value.starts_at,
        "ends_at": value.ends_at,
        "timezone": value.timezone,
        "status": value.status,
        "rejection_reason": value.rejection_reason,
        "messages": value.messages or [],
        "created_at": value.created_at,
        "status_url": guest_status_url(value.guest_token),
    }
    if include_token:
        payload["guest_token"] = value.guest_token
    return payload


def is_admin(user: User) -> bool:
    codes = permission_codes(user)
    return "booking.manage" in codes or "settings.manage" in codes or "schedule.manage" in codes


async def ensure_links(db: AsyncSession, user: User, org: Organization) -> list[BookingLink]:
    existing = list(
        (
            await db.scalars(
                select(BookingLink).where(
                    BookingLink.organization_id == org.id,
                    (BookingLink.owner_user_id == user.id) | (BookingLink.owner_user_id.is_(None)),
                )
            )
        ).all()
    )
    specs = [
        (user.id, "meeting", f"{user.username}-meeting", f"Meet with {user.full_name}"),
        (user.id, "appointment", f"{user.username}-appointments", f"Appointments with {user.full_name}"),
    ]
    if is_admin(user):
        specs.extend(
            [
                (None, "meeting", f"{org.slug}-meeting", f"Meet with {org.name}"),
                (None, "appointment", f"{org.slug}-appointments", f"Appointments with {org.name}"),
            ]
        )
    created: list[BookingLink] = []
    for owner_id, kind, default_slug, title in specs:
        if any(item.owner_user_id == owner_id and item.kind == kind for item in existing):
            continue
        link = BookingLink(
            organization_id=org.id,
            owner_user_id=owner_id,
            kind=kind,
            slug=await unique_slug(db, default_slug),
            title=title,
            enabled=True,
            duration_minutes=60,
        )
        db.add(link)
        created.append(link)
    if created:
        await db.flush()
        existing.extend(created)
    return existing


async def get_org(db: AsyncSession, organization_id: str) -> Organization:
    org = await db.scalar(select(Organization).where(Organization.id == organization_id))
    if not org:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return org


@router.get("/booking-links")
async def list_booking_links(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    org = await get_org(db, user.organization_id)
    links = await ensure_links(db, user, org)
    await db.commit()
    personal = [item for item in links if item.owner_user_id == user.id]
    workspace = [item for item in links if item.owner_user_id is None]
    return {"personal": [link_json(item) for item in personal], "workspace": [link_json(item) for item in workspace]}


@router.patch("/booking-links/{link_id}")
async def update_booking_link(
    link_id: str,
    body: BookingLinkUpdate,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    link = await db.scalar(select(BookingLink).where(BookingLink.id == link_id, BookingLink.organization_id == user.organization_id))
    if not link:
        raise HTTPException(status_code=404, detail="Booking link not found")
    admin = is_admin(user)
    if link.owner_user_id not in {user.id, None} and not admin:
        raise HTTPException(status_code=403, detail="Cannot edit this booking link")
    if link.owner_user_id is None and not admin:
        raise HTTPException(status_code=403, detail="Only administrators can edit workspace booking links")
    if body.slug is not None:
        slug = slugify(body.slug)
        if len(slug) < 3:
            raise HTTPException(status_code=422, detail="Link name is too short")
        link.slug = await unique_slug(db, slug, link.id)
    if body.title is not None:
        link.title = body.title.strip()
    if body.enabled is not None:
        link.enabled = body.enabled
    if body.duration_minutes is not None:
        link.duration_minutes = body.duration_minutes
    await db.commit()
    return link_json(link)


async def _schedule_approved(db: AsyncSession, user: User, booking: BookingRequest, kind: str, message: str) -> Event:
    event = Event(
        organization_id=user.organization_id,
        title=f"{booking.guest_name} — {booking.reason}",
        description=_event_description(booking),
        starts_at=booking.starts_at,
        ends_at=booking.ends_at,
        visibility="private",
        all_day=False,
        location="",
        creator_id=user.id,
        owner_user_id=booking.host_user_id,
        color_key="teal" if kind == "appointment" else "violet",
        event_type="appointment" if kind == "appointment" else "meeting",
        timezone=booking.timezone,
    )
    db.add(event)
    await db.flush()
    booking.status = "approved"
    booking.event_id = event.id
    await notify_guest(db, booking, "approved", message)
    attributes.flag_modified(booking, "messages")
    return event


@router.get("/bookings")
async def list_bookings(status: str | None = None, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    filters = [BookingRequest.organization_id == user.organization_id]
    if not is_admin(user):
        filters.append(BookingRequest.host_user_id == user.id)
    if status:
        filters.append(BookingRequest.status == status)
    values = (await db.scalars(select(BookingRequest).where(and_(*filters)).order_by(BookingRequest.created_at.desc()))).all()
    return [request_json(value) for value in values]


@router.post("/bookings", status_code=201)
async def create_host_booking(
    body: HostBookingInput,
    user: User = Depends(require_permission("schedule.create")),
    db: AsyncSession = Depends(get_db),
):
    org = await get_org(db, user.organization_id)
    links = await ensure_links(db, user, org)
    link = next((item for item in links if item.owner_user_id == user.id and item.kind == body.kind), None)
    if not link:
        raise HTTPException(status_code=404, detail="Booking link not found")
    starts = body.starts_at if body.starts_at.tzinfo else body.starts_at.replace(tzinfo=UTC)
    ends = body.ends_at if body.ends_at else starts + timedelta(minutes=link.duration_minutes)
    if ends.tzinfo is None:
        ends = ends.replace(tzinfo=UTC)
    if ends <= starts:
        raise HTTPException(status_code=422, detail="End must be after start")
    booking = BookingRequest(
        organization_id=user.organization_id,
        link_id=link.id,
        host_user_id=user.id,
        guest_token=secrets.token_urlsafe(24),
        guest_name=body.guest_name.strip(),
        guest_organization=body.guest_organization.strip(),
        guest_email=body.guest_email,
        guest_phone=body.guest_phone,
        reason=body.reason.strip(),
        notes=body.notes.strip(),
        starts_at=starts,
        ends_at=ends,
        timezone=body.timezone,
        status="pending",
        messages=[],
    )
    db.add(booking)
    await db.flush()
    event = await _schedule_approved(db, user, booking, body.kind, f"Your meeting with {user.full_name} was scheduled.")
    await db.commit()
    await realtime_hub.publish(user.organization_id, "event.created", {"id": event.id}, {user.id})
    await realtime_hub.publish(user.organization_id, "booking.updated", {"id": booking.id}, {user.id})
    return request_json(booking)


@router.post("/bookings/{booking_id}/approve")
async def approve_booking(booking_id: str, user: User = Depends(require_permission("schedule.create")), db: AsyncSession = Depends(get_db)):
    booking = await _host_booking(db, user, booking_id)
    if booking.status != "pending":
        raise HTTPException(status_code=409, detail="This request was already handled")
    link = await db.scalar(select(BookingLink).where(BookingLink.id == booking.link_id))
    kind = link.kind if link else "meeting"
    event = await _schedule_approved(db, user, booking, kind, f"Your meeting with {user.full_name} was approved.")
    await create_notification(
        db,
        organization_id=user.organization_id,
        recipient_id=booking.host_user_id,
        event_type="booking.approved",
        title="Meeting approved",
        message=f"{booking.guest_name} is on your schedule.",
        resource_type="booking_request",
        resource_id=booking.id,
        route="/schedule",
    )
    await db.commit()
    await realtime_hub.publish(user.organization_id, "event.created", {"id": event.id}, {booking.host_user_id})
    await realtime_hub.publish(user.organization_id, "booking.updated", {"id": booking.id}, {booking.host_user_id})
    await realtime_hub.publish(user.organization_id, "notification.created", {}, {booking.host_user_id})
    return request_json(booking)


@router.post("/bookings/{booking_id}/reject")
async def reject_booking(
    booking_id: str,
    body: BookingDecision,
    user: User = Depends(require_permission("schedule.create")),
    db: AsyncSession = Depends(get_db),
):
    booking = await _host_booking(db, user, booking_id)
    if booking.status != "pending":
        raise HTTPException(status_code=409, detail="This request was already handled")
    booking.status = "rejected"
    booking.rejection_reason = body.reason.strip()
    reason_text = booking.rejection_reason or "No reason was provided."
    await notify_guest(db, booking, "rejected", f"Your meeting request was not approved. {reason_text}")
    attributes.flag_modified(booking, "messages")
    await create_notification(
        db,
        organization_id=user.organization_id,
        recipient_id=booking.host_user_id,
        event_type="booking.rejected",
        title="Meeting declined",
        message=f"{booking.guest_name}: {reason_text}",
        resource_type="booking_request",
        resource_id=booking.id,
        route="/schedule",
    )
    await db.commit()
    await realtime_hub.publish(user.organization_id, "booking.updated", {"id": booking.id}, {booking.host_user_id})
    await realtime_hub.publish(user.organization_id, "notification.created", {}, {booking.host_user_id})
    return request_json(booking)


@router.get("/public/booking-links/{slug}")
async def public_booking_link(slug: str, db: AsyncSession = Depends(get_db)):
    link = await db.scalar(select(BookingLink).where(BookingLink.slug == slug, BookingLink.enabled.is_(True)))
    if not link:
        raise HTTPException(status_code=404, detail="Booking page not found")
    org = await get_org(db, link.organization_id)
    host = await db.scalar(select(User).where(User.id == link.owner_user_id)) if link.owner_user_id else None
    return {
        "slug": link.slug,
        "kind": link.kind,
        "title": link.title,
        "duration_minutes": link.duration_minutes,
        "workspace_name": org.name,
        "host_name": host.full_name if host else org.name,
    }


@router.post("/public/booking-links/{slug}/requests")
async def public_create_booking(slug: str, body: PublicBookingInput, request: Request, db: AsyncSession = Depends(get_db)):
    public_limiter.check(request, f"booking:{slug}", 20, 3600)
    link = await db.scalar(select(BookingLink).where(BookingLink.slug == slug, BookingLink.enabled.is_(True)))
    if not link:
        raise HTTPException(status_code=404, detail="Booking page not found")
    if body.ends_at and body.ends_at <= body.starts_at:
        raise HTTPException(status_code=422, detail="End must be after start")
    if not body.guest_email and not body.guest_phone:
        raise HTTPException(status_code=422, detail="Provide an email or phone number")
    starts = body.starts_at if body.starts_at.tzinfo else body.starts_at.replace(tzinfo=UTC)
    ends = body.ends_at if body.ends_at else starts + timedelta(minutes=link.duration_minutes)
    if ends.tzinfo is None:
        ends = ends.replace(tzinfo=UTC)
    host_id = link.owner_user_id
    if not host_id:
        admin_user = await db.scalar(
            select(User).where(User.organization_id == link.organization_id, User.is_active.is_(True)).order_by(User.created_at)
        )
        host_id = admin_user.id if admin_user else None
    if not host_id:
        raise HTTPException(status_code=422, detail="This booking page has no host")
    booking = BookingRequest(
        organization_id=link.organization_id,
        link_id=link.id,
        host_user_id=host_id,
        guest_token=secrets.token_urlsafe(24),
        guest_name=body.guest_name.strip(),
        guest_organization=body.guest_organization.strip(),
        guest_email=body.guest_email,
        guest_phone=body.guest_phone,
        reason=body.reason.strip(),
        notes=body.notes.strip(),
        starts_at=starts,
        ends_at=ends,
        timezone=body.timezone,
        status="pending",
        messages=[],
    )
    db.add(booking)
    await db.flush()
    details = f"{booking.guest_name} ({booking.guest_organization or 'individual'}) · {booking.reason}"
    await create_notification(
        db,
        organization_id=link.organization_id,
        recipient_id=host_id,
        event_type="booking.created",
        title="New meeting request",
        message=details,
        resource_type="booking_request",
        resource_id=booking.id,
        route=f"/schedule?booking={booking.id}",
    )
    await db.commit()
    await realtime_hub.publish(link.organization_id, "notification.created", {"id": booking.id}, {host_id})
    await realtime_hub.publish(link.organization_id, "booking.created", {"id": booking.id}, {host_id})
    return {"status": "submitted", "guest_token": booking.guest_token, "status_url": guest_status_url(booking.guest_token)}


@router.get("/public/bookings/{token}")
async def public_booking_status(token: str, db: AsyncSession = Depends(get_db)):
    booking = await db.scalar(select(BookingRequest).where(BookingRequest.guest_token == token))
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    org = await get_org(db, booking.organization_id)
    host = await db.scalar(select(User).where(User.id == booking.host_user_id))
    payload = request_json(booking, include_token=True)
    payload["workspace_name"] = org.name
    payload["host_name"] = host.full_name if host else org.name
    return payload


async def notify_booking_event_change(db: AsyncSession, event: Event) -> None:
    booking = await db.scalar(select(BookingRequest).where(BookingRequest.event_id == event.id))
    if not booking or booking.status != "approved":
        return
    booking.starts_at = event.starts_at
    booking.ends_at = event.ends_at
    booking.timezone = event.timezone
    body = f"Your meeting was updated to {event.starts_at.isoformat()} - {event.ends_at.isoformat()}."
    await notify_guest(db, booking, "updated", body)
    attributes.flag_modified(booking, "messages")


async def _host_booking(db: AsyncSession, user: User, booking_id: str) -> BookingRequest:
    booking = await db.scalar(
        select(BookingRequest).where(BookingRequest.id == booking_id, BookingRequest.organization_id == user.organization_id)
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.host_user_id != user.id and not is_admin(user):
        raise HTTPException(status_code=403, detail="Cannot review this booking")
    return booking


def _event_description(booking: BookingRequest) -> str:
    lines = [
        f"Guest: {booking.guest_name}",
        f"Organization: {booking.guest_organization or '-'}",
        f"Email: {booking.guest_email or '-'}",
        f"Phone: {booking.guest_phone or '-'}",
        f"Reason: {booking.reason}",
    ]
    if booking.notes:
        lines.append(booking.notes)
    return "\n".join(lines)
