from datetime import UTC, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(UTC)


class NotificationDocument(BaseModel):
    notification_id: str
    workspace_id: str
    recipient_user_id: str
    type: str
    title_key: str
    title_data: dict[str, Any] = Field(default_factory=dict)
    message_data: dict[str, Any] = Field(default_factory=dict)
    resource_type: str | None = None
    resource_id: str | None = None
    route: str | None = None
    read: bool = False
    read_at: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)
    metadata: dict[str, Any] = Field(default_factory=dict)
    schema_version: int = 1


class RealtimeEventDocument(BaseModel):
    event_id: str
    workspace_id: str
    event_type: str
    resource_type: str | None = None
    resource_id: str | None = None
    actor_user_id: str | None = None
    target_user_ids: list[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=utc_now)
    payload: dict[str, Any] = Field(default_factory=dict)
    schema_version: int = 1


class ActivityDocument(BaseModel):
    activity_id: str
    workspace_id: str
    event_type: str
    actor_user_id: str | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    timestamp: datetime = Field(default_factory=utc_now)
    payload: dict[str, Any] = Field(default_factory=dict)
    schema_version: int = 1


class SupportMessageDocument(BaseModel):
    message_id: str
    ticket_id: str
    workspace_id: str
    sender_user_id: str | None = None
    sender_name: str
    sender_type: Literal["guest", "user", "admin"]
    message: str
    attachment_ids: list[str] = Field(default_factory=list)
    message_type: Literal["message", "internal_note"] = "message"
    created_at: datetime = Field(default_factory=utc_now)
    schema_version: int = 1
