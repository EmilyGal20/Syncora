from typing import Any

from pymongo import ASCENDING, DESCENDING, AsyncMongoClient
from pymongo.server_api import ServerApi

from ...config import get_settings


class MongoState:
    def __init__(self) -> None:
        self.client: AsyncMongoClient[dict[str, Any]] | None = None
        self.database: Any = None
        self.available = False
        self.error: str | None = None

    async def connect(self) -> None:
        settings = get_settings()
        if settings.app_mode:
            self.available = False
            self.error = "disabled-in-app-mode"
            return
        try:
            self.client = AsyncMongoClient(
                settings.mongodb_uri,
                server_api=ServerApi("1"),
                serverSelectionTimeoutMS=3000,
                connectTimeoutMS=3000,
            )
            await self.client.admin.command("ping")
            self.database = self.client[settings.mongodb_database]
            await self._indexes()
            self.available = True
            self.error = None
        except Exception as exc:
            self.available = False
            self.error = type(exc).__name__

    async def _indexes(self) -> None:
        await self.database.notifications.create_index("notification_id", unique=True, name="notification_id_unique")
        await self.database.notifications.create_index([("workspace_id", ASCENDING), ("recipient_user_id", ASCENDING), ("created_at", DESCENDING)], name="notification_feed")
        await self.database.notifications.create_index([("workspace_id", ASCENDING), ("recipient_user_id", ASCENDING), ("read", ASCENDING), ("created_at", DESCENDING)], name="notification_unread")
        await self.database.realtime_events.create_index("event_id", unique=True, name="event_id_unique")
        await self.database.realtime_events.create_index([("workspace_id", ASCENDING), ("timestamp", DESCENDING)], name="realtime_workspace")
        await self.database.realtime_events.create_index([("workspace_id", ASCENDING), ("event_type", ASCENDING), ("timestamp", DESCENDING)], name="realtime_type")
        await self.database.activity_events.create_index("activity_id", unique=True, name="activity_id_unique")
        await self.database.activity_events.create_index([("workspace_id", ASCENDING), ("timestamp", DESCENDING)], name="activity_workspace")
        await self.database.activity_events.create_index([("workspace_id", ASCENDING), ("actor_user_id", ASCENDING), ("timestamp", DESCENDING)], name="activity_actor")
        await self.database.support_messages.create_index("message_id", unique=True, name="message_id_unique")
        await self.database.support_messages.create_index([("workspace_id", ASCENDING), ("ticket_id", ASCENDING), ("created_at", ASCENDING)], name="support_conversation")

    async def close(self) -> None:
        if self.client:
            await self.client.close()
        self.client = None
        self.database = None
        self.available = False


mongo = MongoState()
