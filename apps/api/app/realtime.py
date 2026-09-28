from collections import defaultdict
from typing import Any
from uuid import uuid4

from fastapi import WebSocket

from .infrastructure.mongodb.models import ActivityDocument, RealtimeEventDocument
from .infrastructure.mongodb.repositories import activity_repository, realtime_repository


class RealtimeHub:
    def __init__(self):
        self._connections: dict[str, dict[str, set[WebSocket]]] = defaultdict(lambda: defaultdict(set))

    async def connect(self, workspace_id: str, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept(subprotocol="syncora")
        self._connections[workspace_id][user_id].add(websocket)

    def disconnect(self, workspace_id: str, user_id: str, websocket: WebSocket) -> None:
        users = self._connections.get(workspace_id)
        if not users:
            return
        users[user_id].discard(websocket)
        if not users[user_id]:
            users.pop(user_id, None)
        if not users:
            self._connections.pop(workspace_id, None)

    async def publish(self, workspace_id: str, event: str, data: dict[str, Any], recipients: set[str] | None = None) -> None:
        event_id = str(uuid4())
        safe_data = {key: value for key, value in data.items() if key.lower() not in {"password", "token", "secret", "password_hash"}}
        try:
            await realtime_repository.append(RealtimeEventDocument(event_id=event_id, workspace_id=workspace_id, event_type=event, target_user_ids=sorted(recipients or []), payload=safe_data))
            await activity_repository.append(ActivityDocument(activity_id=event_id, workspace_id=workspace_id, event_type=event, resource_id=str(data.get("id") or data.get("ticket_id") or data.get("request_id") or "") or None, payload=safe_data))
        except Exception:
            # Delivery remains available if best-effort event history is down.
            pass
        users = self._connections.get(workspace_id, {})
        targets = recipients if recipients is not None else set(users)
        stale: list[tuple[str, WebSocket]] = []
        for user_id in targets:
            for socket in tuple(users.get(user_id, set())):
                try:
                    await socket.send_json({"type": event, "data": data, "event_id": event_id})
                except Exception:
                    stale.append((user_id, socket))
        for user_id, socket in stale:
            self.disconnect(workspace_id, user_id, socket)


realtime_hub = RealtimeHub()
