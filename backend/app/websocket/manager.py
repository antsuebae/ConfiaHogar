from fastapi import WebSocket
from typing import Dict, Set
import json


class ConnectionManager:
    def __init__(self):
        # user_id -> set of websockets (múltiples pestañas)
        self._connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self._connections:
            self._connections[user_id] = set()
        self._connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self._connections:
            self._connections[user_id].discard(websocket)
            if not self._connections[user_id]:
                del self._connections[user_id]

    async def send_to_user(self, user_id: int, data: dict):
        if user_id in self._connections:
            dead = set()
            for ws in self._connections[user_id]:
                try:
                    await ws.send_text(json.dumps(data))
                except Exception:
                    dead.add(ws)
            self._connections[user_id] -= dead

    async def broadcast_conversation(self, conversacion_id: int, data: dict, exclude_user: int = None):
        payload = json.dumps(data)
        # Enviar a todos los conectados — el frontend filtra por conversacion_id
        for user_id, sockets in list(self._connections.items()):
            if user_id == exclude_user:
                continue
            dead = set()
            for ws in sockets:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.add(ws)
            self._connections[user_id] -= dead

    def is_online(self, user_id: int) -> bool:
        return user_id in self._connections and bool(self._connections[user_id])


manager = ConnectionManager()
