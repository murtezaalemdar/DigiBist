"""
DigiBist — Otomatik Analiz Zamanlayıcı (v8.10)
═══════════════════════════════════════════════════════════

Arka planda periyodik olarak teknik analiz çalıştırır.
AutoTrader pattern'ini takip eder: asyncio.create_task(loop).

Özellikler:
  - Yapılandırılabilir aralık (dakika bazlı)
  - Hisse seçim modu: tümü / favoriler / özel liste
  - Borsa İstanbul saat kontrolü (09:30 - 18:00)
  - Eşzamanlılık limiti (max_concurrent)
  - Telegram & Browser bildirim desteği
  - Otomatik yeniden başlatma (config değişikliğinde)

Mimari:
  main.py startup → AnalysisScheduler.start(config)
      └─ asyncio.create_task(loop)
          └─ her interval_minutes dakikada:
              1. Borsa saati kontrolü
              2. Hisse listesi oluştur (mode'a göre)
              3. Semaphore ile eşzamanlı analiz
              4. Sonuçları logla + DB güncelle
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone, time as dt_time
from typing import Awaitable, Callable, Optional

from app.core.database import (
    get_analysis_schedule,
    update_schedule_run_info,
    get_active_symbols,
)

logger = logging.getLogger(__name__)

# Borsa İstanbul çalışma saatleri (Türkiye saati UTC+3)
MARKET_OPEN = dt_time(9, 30)
MARKET_CLOSE = dt_time(18, 0)
TZ_ISTANBUL = timezone(timedelta(hours=3))


def _is_market_hours() -> bool:
    """Borsa İstanbul işlem saatleri içinde mi?"""
    now = datetime.now(TZ_ISTANBUL)
    # Hafta sonu kontrolü (5=Cumartesi, 6=Pazar)
    if now.weekday() >= 5:
        return False
    current_time = now.time()
    return MARKET_OPEN <= current_time <= MARKET_CLOSE


class AnalysisScheduler:
    """
    Periyodik teknik analiz çalıştıran zamanlayıcı.
    AutoTrader benzeri asyncio pattern kullanır.
    """

    def __init__(self):
        self.enabled: bool = False
        self.config: dict = {}
        self._task: Optional[asyncio.Task] = None
        self._running: bool = False
        self._last_run_at: Optional[datetime] = None
        self._next_run_at: Optional[datetime] = None
        self._analyzed_count: int = 0
        self._current_cycle_count: int = 0
        self._logs: list[dict] = []

    def start(self, config: dict, forecast_runner: Callable):
        """
        Zamanlayıcıyı başlat.
        
        Args:
            config: Zamanlama ayarları (get_analysis_schedule() sonucu)
            forecast_runner: get_forecast fonksiyonu referansı
        """
        self.enabled = True
        self.config = config
        self._forecast_runner = forecast_runner

        if self._task and not self._task.done():
            self._task.cancel()

        interval = max(config.get("interval_minutes", 60), 1)
        logger.info(f"Analiz Zamanlayıcı başlatıldı: her {interval} dakikada, mod={config.get('stock_mode', 'all')}")

        async def loop():
            try:
                while self.enabled:
                    await self._run_cycle()
                    interval_sec = max(self.config.get("interval_minutes", 60), 1) * 60
                    self._next_run_at = datetime.now(TZ_ISTANBUL) + timedelta(seconds=interval_sec)
                    await asyncio.sleep(interval_sec)
            except asyncio.CancelledError:
                logger.info("Analiz Zamanlayıcı durduruldu.")
                return
            except Exception as e:
                logger.error(f"Analiz Zamanlayıcı hatası: {e}")

        self._task = asyncio.create_task(loop())

    def stop(self):
        """Zamanlayıcıyı durdur."""
        self.enabled = False
        if self._task and not self._task.done():
            self._task.cancel()
        self._next_run_at = None
        logger.info("Analiz Zamanlayıcı durduruldu.")

    async def _run_cycle(self):
        """Tek bir analiz döngüsü çalıştır."""
        # Borsa saati kontrolü
        if self.config.get("market_hours_only", True) and not _is_market_hours():
            logger.info("Analiz atlandı: Borsa kapalı (market_hours_only=true)")
            self._add_log("SYSTEM", "SKIP", "Borsa saatleri dışında")
            return

        self._running = True
        self._current_cycle_count = 0
        start_time = datetime.now(TZ_ISTANBUL)
        self._last_run_at = start_time

        try:
            # Analiz edilecek hisseleri belirle
            symbols = await self._get_symbols()
            if not symbols:
                self._add_log("SYSTEM", "SKIP", "Analiz edilecek hisse yok")
                return

            logger.info(f"Analiz döngüsü başladı: {len(symbols)} hisse")

            # Eşzamanlılık limiti
            max_concurrent = max(self.config.get("max_concurrent", 3), 1)
            semaphore = asyncio.Semaphore(max_concurrent)

            async def analyze_one(symbol: str):
                async with semaphore:
                    try:
                        result = await self._forecast_runner(
                            symbol=symbol, notify=self.config.get("notify_telegram", False), force=True
                        )
                        self._current_cycle_count += 1
                        self._analyzed_count += 1
                        signal = "N/A"
                        if result and not result.get("error"):
                            signal = result.get("risk_signal") or result.get("signal", "N/A")
                            confidence = result.get("confidence", 0)
                            self._add_log(symbol, signal, f"Güven: {confidence:.2%}")
                        else:
                            err = result.get("error", "Bilinmeyen hata") if result else "Sonuç yok"
                            self._add_log(symbol, "ERROR", str(err)[:100])
                    except Exception as e:
                        self._add_log(symbol, "ERROR", str(e)[:100])

            # Tüm hisseleri eşzamanlı analiz et
            tasks = [analyze_one(s) for s in symbols]
            await asyncio.gather(*tasks, return_exceptions=True)

            elapsed = (datetime.now(TZ_ISTANBUL) - start_time).total_seconds()
            logger.info(f"Analiz döngüsü tamamlandı: {self._current_cycle_count}/{len(symbols)} hisse, {elapsed:.1f}s")
            self._add_log("SYSTEM", "DONE", f"{self._current_cycle_count} hisse analiz edildi ({elapsed:.1f}s)")

            # ── Otomatik tahmin doğrulama ─────────────────────
            # Her analiz döngüsünden sonra bekleyen tahminleri doğrula
            try:
                from app.core.database import verify_predictions
                verify_result = await verify_predictions(lookback_hours=0)
                v_count = verify_result.get("verified", 0)
                if v_count > 0:
                    logger.info(f"✅ Otomatik doğrulama: {v_count} tahmin doğrulandı")
                    self._add_log("SYSTEM", "VERIFY", f"{v_count} tahmin otomatik doğrulandı")
            except Exception as e:
                logger.warning(f"Otomatik doğrulama hatası: {e}")

            # DB'ye çalışma bilgisi yaz
            interval_sec = max(self.config.get("interval_minutes", 60), 1) * 60
            next_run = datetime.now(TZ_ISTANBUL) + timedelta(seconds=interval_sec)
            try:
                await update_schedule_run_info(start_time, next_run)
            except Exception as e:
                logger.warning(f"Schedule run info güncellenemedi: {e}")

        except Exception as e:
            logger.error(f"Analiz döngüsü hatası: {e}")
            self._add_log("SYSTEM", "ERROR", str(e)[:100])
        finally:
            self._running = False

    async def _get_symbols(self) -> list[str]:
        """Yapılandırmaya göre analiz edilecek sembol listesini döndür."""
        mode = self.config.get("stock_mode", "all")

        if mode == "custom":
            custom = self.config.get("custom_symbols", "")
            if custom:
                return [s.strip().upper().replace(".IS", "") for s in custom.split(",") if s.strip()]
            return []

        # 'all' ve 'favorites' modları — DB'den aktif semboller
        try:
            symbols = await get_active_symbols()
            return symbols or []
        except Exception as e:
            logger.error(f"Sembol listesi alınamadı: {e}")
            return []

    def _add_log(self, symbol: str, action: str, detail: str):
        """Bellek içi log kaydı ekle (son 100)."""
        self._logs.append({
            "symbol": symbol,
            "action": action,
            "detail": detail,
            "ts": datetime.now(TZ_ISTANBUL).isoformat(),
        })
        # Son 100 log'u tut
        if len(self._logs) > 100:
            self._logs = self._logs[-100:]

    def status(self) -> dict:
        """Zamanlayıcı durumunu döndür."""
        return {
            "enabled": self.enabled,
            "running": self._running,
            "config": self.config,
            "last_run_at": self._last_run_at.isoformat() if self._last_run_at else None,
            "next_run_at": self._next_run_at.isoformat() if self._next_run_at else None,
            "analyzed_count": self._analyzed_count,
            "current_cycle_count": self._current_cycle_count,
            "recent_logs": self._logs[-30:],
        }
