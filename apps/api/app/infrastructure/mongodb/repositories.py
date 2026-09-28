from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from pymongo import ReturnDocument

from .client import mongo
from .models import ActivityDocument, NotificationDocument, RealtimeEventDocument, SupportMessageDocument


def _document(value: Any) -> dict[str, Any]:
    return value.model_dump(mode="python")


class NotificationRepository:
    @property
    def collection(self):
        return mongo.database.notifications if mongo.available else None

    async def upsert(self, value: NotificationDocument) -> None:
        if self.collection is None:
            return
        await self.collection.update_one({"workspace_id": value.workspace_id, "notification_id": value.notification_id}, {"$setOnInsert": _document(value)}, upsert=True)

    async def list(self, workspace_id: str, recipient_id: str, unread: bool, page: int, page_size: int) -> dict[str, Any] | None:
        if self.collection is None:
            return None
        query: dict[str, Any] = {"workspace_id": workspace_id, "recipient_user_id": recipient_id}
        if unread:
            query["read"] = False
        items = await self.collection.find(query, {"_id": 0}).sort("created_at", -1).skip((page - 1) * page_size).limit(page_size).to_list(page_size)
        total = await self.collection.count_documents(query)
        unread_count = await self.collection.count_documents({"workspace_id": workspace_id, "recipient_user_id": recipient_id, "read": False})
        return {"items": items, "total": total, "unread": unread_count}

    async def mark(self, workspace_id: str, recipient_id: str, notification_id: str, read: bool) -> dict[str, Any] | None:
        if self.collection is None:
            return None
        changed = await self.collection.find_one_and_update(
            {"workspace_id": workspace_id, "recipient_user_id": recipient_id, "notification_id": notification_id},
            {"$set": {"read": read, "read_at": datetime.now(UTC) if read else None}},
            return_document=ReturnDocument.AFTER,
            projection={"_id": 0},
        )
        return changed

    async def mark_all(self, workspace_id: str, recipient_id: str) -> bool:
        if self.collection is None:
            return False
        await self.collection.update_many({"workspace_id": workspace_id, "recipient_user_id": recipient_id, "read": False}, {"$set": {"read": True, "read_at": datetime.now(UTC)}})
        return True


class RealtimeRepository:
    async def append(self, value: RealtimeEventDocument) -> None:
        if mongo.available:
            await mongo.database.realtime_events.update_one({"workspace_id": value.workspace_id, "event_id": value.event_id}, {"$setOnInsert": _document(value)}, upsert=True)


class ActivityRepository:
    async def append(self, value: ActivityDocument) -> None:
        if mongo.available:
            await mongo.database.activity_events.update_one({"workspace_id": value.workspace_id, "activity_id": value.activity_id}, {"$setOnInsert": _document(value)}, upsert=True)

    async def list(self, workspace_id: str, actor_user_id: str | None, before: datetime | None, limit: int) -> list[dict[str, Any]]:
        if not mongo.available:
            raise HTTPException(status_code=503, detail="Activity service is temporarily unavailable")
        query: dict[str, Any] = {"workspace_id": workspace_id}
        if actor_user_id:
            query["actor_user_id"] = actor_user_id
        if before:
            query["timestamp"] = {"$lt": before}
        return await mongo.database.activity_events.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)


class SupportRepository:
    async def upsert(self, value: SupportMessageDocument) -> None:
        if not mongo.available:
            raise HTTPException(status_code=503, detail="Support conversation storage is temporarily unavailable")
        await mongo.database.support_messages.update_one({"workspace_id": value.workspace_id, "message_id": value.message_id}, {"$setOnInsert": _document(value)}, upsert=True)

    async def list(self, workspace_id: str, ticket_id: str, include_internal: bool) -> list[dict[str, Any]]:
        if not mongo.available:
            raise HTTPException(status_code=503, detail="Support conversation storage is temporarily unavailable")
        query: dict[str, Any] = {"workspace_id": workspace_id, "ticket_id": ticket_id}
        if not include_internal:
            query["message_type"] = "message"
        return await mongo.database.support_messages.find(query, {"_id": 0}).sort("created_at", 1).to_list(500)


notification_repository = NotificationRepository()
realtime_repository = RealtimeRepository()
activity_repository = ActivityRepository()
support_repository = SupportRepository()
