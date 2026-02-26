"""
DigiBist — WebSocket Bağlantı Yöneticisi (ConnectionManager)
═════════════════════════════════════════════════════

FastAPI WebSocket bağlantılarını yöneten Singleton manager.
main.py'den `from app.core.ws_manager import manager` ile kullanılır.

AMAÇ:
  - Frontend React client'ları WS üzerinden gerçek zamanlı fiyat akışı alır
  - MARKET_UPDATE mesajları tüm bağlı client'lara broadcast edilir
  - OPPORTUNITY_ALERT mesajları opportunity_scanner tarafından tetiklenir

KULLANIM:
  await manager.connect(websocket)     # client bağlandı
  manager.disconnect(websocket)        # client ayrıldı
  await manager.broadcast({...})       # tüm client'lara mesaj gönder

NOTLAR:
  - Broadcast sırasında bağlantı kopmuş client'lar otomatik temizlenir
  - active_connections list'i in-memory tutulur (worker başına ayrı)
  - 4 uvicorn worker varsa her worker kendi ConnectionManager instance'ına sahiptir
"""

from fastapi import WebSocket
from typing import List
import logging

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New WebSocket connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()
