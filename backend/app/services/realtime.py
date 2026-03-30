from __future__ import annotations

from collections import defaultdict

from fastapi import WebSocket


class RealtimeManager:
    def __init__(self) -> None:
        self.connections: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, auction_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections[auction_id].add(websocket)

    def disconnect(self, auction_id: int, websocket: WebSocket) -> None:
        sockets = self.connections.get(auction_id)
        if not sockets:
            return
        sockets.discard(websocket)
        if not sockets:
            self.connections.pop(auction_id, None)

    async def broadcast(self, auction_id: int, payload: dict) -> None:
        dead: list[WebSocket] = []
        for socket in self.connections.get(auction_id, set()):
            try:
                await socket.send_json(payload)
            except Exception:
                dead.append(socket)
        for socket in dead:
            self.disconnect(auction_id, socket)
