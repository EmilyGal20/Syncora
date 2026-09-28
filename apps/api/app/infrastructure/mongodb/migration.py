from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...models import Notification, SupportMessage, SupportTicket
from .client import mongo
from .models import NotificationDocument, SupportMessageDocument
from .repositories import notification_repository, support_repository


async def migrate_compatibility_documents(db: AsyncSession) -> dict[str, int]:
    """Idempotently copy legacy documents while PostgreSQL compatibility rows remain."""
    if not mongo.available:
        return {"notifications": 0, "support_messages": 0}
    notification_count = 0
    for value in (await db.scalars(select(Notification))).all():
        await notification_repository.upsert(
            NotificationDocument(
                notification_id=value.id,
                workspace_id=value.organization_id,
                recipient_user_id=value.recipient_id,
                type=value.type,
                title_key=value.title,
                message_data={"text": value.message},
                resource_type=value.resource_type,
                resource_id=value.resource_id,
                route=value.route,
                read=value.read_at is not None,
                read_at=value.read_at,
                created_at=value.created_at,
            )
        )
        notification_count += 1
    message_count = 0
    rows = await db.execute(select(SupportMessage, SupportTicket).join(SupportTicket, SupportTicket.id == SupportMessage.ticket_id))
    for message, ticket in rows.all():
        await support_repository.upsert(
            SupportMessageDocument(
                message_id=message.id,
                ticket_id=ticket.id,
                workspace_id=ticket.organization_id or "platform",
                sender_user_id=message.author_user_id,
                sender_name=message.author_name,
                sender_type="admin" if message.is_internal else "user" if message.author_user_id else "guest",
                message=message.body,
                message_type="internal_note" if message.is_internal else "message",
                created_at=message.created_at,
            )
        )
        message_count += 1
    return {"notifications": notification_count, "support_messages": message_count}
