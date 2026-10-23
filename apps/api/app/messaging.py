from datetime import UTC, datetime
from typing import Any

import httpx

from fastapi import Request

from .config import get_settings
from .models import BookingRequest, DomainOutbox
from .origin import public_app_origin


def guest_status_url(token: str, request: Request | None = None) -> str:
    base = public_app_origin(request)
    return f"{base}/book/status/{token}"


async def send_sms(phone: str, body: str) -> str:
    settings = get_settings()
    if not phone.strip():
        return "skipped"
    if not (settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_from_number):
        return "logged"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                url,
                auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                data={"From": settings.twilio_from_number, "To": phone, "Body": body},
            )
        return "sent" if response.is_success else "failed"
    except Exception:
        return "failed"


async def notify_guest(db, booking: BookingRequest, kind: str, body: str, request: Request | None = None) -> None:
    history = list(booking.messages or [])
    history.append({"at": datetime.now(UTC).isoformat(), "kind": kind, "body": body})
    booking.messages = history[-40:]
    db.add(
        DomainOutbox(
            organization_id=booking.organization_id,
            event_type=f"booking.{kind}",
            aggregate_type="booking_request",
            aggregate_id=booking.id,
            payload={"phone": booking.guest_phone, "email": booking.guest_email, "body": body, "token": booking.guest_token},
        )
    )
    if booking.guest_phone:
        status = await send_sms(booking.guest_phone, f"{body} View details: {guest_status_url(booking.guest_token, request)}")
        history[-1]["sms"] = status
        booking.messages = history[-40:]
