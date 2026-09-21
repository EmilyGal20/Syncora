from collections import defaultdict
from typing import Any

from fastapi import WebSocket


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
        users = self._connections.get(workspace_id, {})
        targets = recipients if recipients is not None else set(users)
        stale: list[tuple[str, WebSocket]] = []
        for user_id in targets:
            for socket in tuple(users.get(user_id, set())):
                try:
                    await socket.send_json({"type": event, "data": data})
                except Exception:
                    stale.append((user_id, socket))
        for user_id, socket in stale:
            self.disconnect(workspace_id, user_id, socket)


realtime_hub = RealtimeHub()
