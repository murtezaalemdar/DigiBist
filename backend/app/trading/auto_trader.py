"""
BIST AI Trading — Auto Trade Orchestrator (v8.09)
═════════════════════════════════════════════════

Arka planda çalışan hafif otomatik ticaret döngüsü.
AI tahminlerini değerlendirip, belirtilen yapılandırmaya göre
periyodik olarak emir akışını çalıştırır.

Mimari
──────
  main.py start_auto_trade() → AutoTrader.start(config, runner)
      └─ asyncio.create_task(loop)
          └─ her cycle_seconds saniyede runner(config) çağırılır
          └─ runner: AI forecast → strateji → risk → emir yönlendirme

Bileşenler
──────────
- AutoTradeLog (dataclass) — symbol, action, reason, mode, ts alanları
- AutoTrader (class):
  - start(config, runner) — asyncio Task oluşturur, eskiyi iptal eder
  - stop()               — döngüyü durdurur, Task'ı iptal eder
  - add_log(...)         — trade kaydını PostgreSQL'e yazar (save_auto_trade_log)
  - status()             — enabled, config, son 50 log'u döner

PostgreSQL Entegrasyonu
───────────────────────
- save_auto_trade_log()         — yeni log INSERT
- get_recent_auto_trade_logs()  — limit bazlı son logları SELECT
- DB hatası auto-trade döngüsünü durdurmaz (try/except pass)

Yapılandırma (config dict)
──────────────────────────
- cycle_seconds: tarama aralığı (varsayılan 60s)
- Ek alanlar runner fonksiyonunda tanımlanır

Changelog
─────────
- v8.09.01: Detaylı module docstring eklendi (Sprint 3)
- v8.05.00: İlk Auto Trader implementasyonu
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
