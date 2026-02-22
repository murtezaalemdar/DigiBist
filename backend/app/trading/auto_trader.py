"""
Auto Trade Orchestrator — PostgreSQL destekli.
Tüm loglar kalıcı olarak veritabanına kaydedilir.
"""

import asyncio
import time
from dataclasses import asdict, dataclass
from typing import Awaitable, Callable

from app.core.database import save_auto_trade_log, get_recent_auto_trade_logs


@dataclass
class AutoTradeLog:
    symbol: str
    action: str
    reason: str
    mode: str
    ts: float


class AutoTrader:
    """
    Arka planda AI tahminini değerlendirip otomatik emir akışını çalıştıran hafif orchestrator.
    Loglar PostgreSQL'e kalıcı olarak kaydedilir.
    """

    def __init__(self):
        self.enabled: bool = False
        self.config: dict = {}
        self._task: asyncio.Task | None = None

    def start(self, config: dict, runner: Callable[[dict], Awaitable[None]]):
        self.enabled = True
        self.config = config

        if self._task and not self._task.done():
            self._task.cancel()

        async def loop():
            try:
                while self.enabled:
                    await runner(config)
                    await asyncio.sleep(config.get("cycle_seconds", 60))
            except asyncio.CancelledError:
                return

        self._task = asyncio.create_task(loop())

    def stop(self):
        self.enabled = False
        if self._task and not self._task.done():
            self._task.cancel()

    async def add_log(self, symbol: str, action: str, reason: str, mode: str):
        """Log'u PostgreSQL'e kaydet."""
        try:
            await save_auto_trade_log(symbol=symbol, action=action, reason=reason, mode=mode)
        except Exception:
            pass  # DB hatası auto-trade döngüsünü durdurmamalı

    async def status(self) -> dict:
        """Son logları PostgreSQL'den getir."""
        try:
            logs = await get_recent_auto_trade_logs(limit=50)
        except Exception:
            logs = []
        return {
            "enabled": self.enabled,
            "config": self.config,
            "recent_logs": logs,
        }
