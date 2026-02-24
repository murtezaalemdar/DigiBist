"""
Fırsat Tarayıcı (Opportunity Scanner) v1.0
──────────────────────────────────────────
Tüm BIST100 hisselerini periyodik olarak tarar ve
fırsat oluştuğunda bildirim üretir.

Fırsat Türleri:
  • STRONG_BUY / STRONG_SELL — Yüksek güvenli AI sinyali
  • RSI_OVERSOLD / RSI_OVERBOUGHT — RSI aşırı bölgeleri
  • MACD_CROSS — MACD sinyal çaprazlaması
  • BIG_MOVE — Günlük %3+ fiyat hareketi
  • VOLUME_SPIKE — Hacim patlaması (ortalamadan 2x+)
  • SUPPORT_BOUNCE / RESISTANCE_REJECT — Bollinger bandı sinyalleri
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ─── Bildirim Önceliği ───
PRIORITY_CRITICAL = "critical"   # Hemen bildir (Telegram + Browser + Ses)
PRIORITY_HIGH = "high"           # Önemli (Browser + Panel)
PRIORITY_MEDIUM = "medium"       # Normal (Panel)
PRIORITY_LOW = "low"             # Düşük (Sadece log)

# ─── Fırsat Tipleri ve Konfigürasyonu ───
OPPORTUNITY_CONFIG = {
    "STRONG_BUY": {
        "emoji": "🟢🔥",
        "label": "Güçlü AL Sinyali",
        "priority": PRIORITY_CRITICAL,
        "min_confidence": 0.75,
    },
    "STRONG_SELL": {
        "emoji": "🔴🔥",
        "label": "Güçlü SAT Sinyali",
        "priority": PRIORITY_CRITICAL,
        "min_confidence": 0.75,
    },
    "RSI_OVERSOLD": {
        "emoji": "📉💰",
        "label": "RSI Aşırı Satım (Alım Fırsatı)",
        "priority": PRIORITY_HIGH,
        "rsi_threshold": 30,
    },
    "RSI_OVERBOUGHT": {
        "emoji": "📈⚠️",
        "label": "RSI Aşırı Alım (Satım Zamanı)",
        "priority": PRIORITY_HIGH,
        "rsi_threshold": 70,
    },
    "MACD_BULLISH_CROSS": {
        "emoji": "📊🟢",
        "label": "MACD Boğa Çaprazlaması",
        "priority": PRIORITY_HIGH,
    },
    "MACD_BEARISH_CROSS": {
        "emoji": "📊🔴",
        "label": "MACD Ayı Çaprazlaması",
        "priority": PRIORITY_HIGH,
    },
    "BIG_MOVE_UP": {
        "emoji": "🚀",
        "label": "Büyük Yükseliş",
        "priority": PRIORITY_HIGH,
        "threshold_pct": 3.0,
    },
    "BIG_MOVE_DOWN": {
        "emoji": "💥",
        "label": "Büyük Düşüş",
        "priority": PRIORITY_HIGH,
        "threshold_pct": -3.0,
    },
    "VOLUME_SPIKE": {
        "emoji": "📢",
        "label": "Hacim Patlaması",
        "priority": PRIORITY_MEDIUM,
        "multiplier": 2.0,
    },
    "BOLLINGER_OVERSOLD": {
        "emoji": "🔽💎",
        "label": "Bollinger Alt Bant (Destek)",
        "priority": PRIORITY_MEDIUM,
        "threshold": 0.05,
    },
    "BOLLINGER_OVERBOUGHT": {
        "emoji": "🔼⛔",
        "label": "Bollinger Üst Bant (Direnç)",
        "priority": PRIORITY_MEDIUM,
        "threshold": 0.95,
    },
}


class OpportunityAlert:
    """Tek bir fırsat bildirimi."""

    def __init__(
        self,
        symbol: str,
        alert_type: str,
        priority: str,
        title: str,
        message: str,
        data: dict = None,
    ):
        self.id = str(uuid.uuid4())
        self.symbol = symbol
        self.alert_type = alert_type
        self.priority = priority
        self.title = title
        self.message = message
        self.data = data or {}
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.read = False

    def to_dict(self) -> dict:
        cfg = OPPORTUNITY_CONFIG.get(self.alert_type, {})
        return {
            "id": self.id,
            "symbol": self.symbol,
            "type": self.alert_type,
            "priority": self.priority,
            "emoji": cfg.get("emoji", "📌"),
            "title": self.title,
            "message": self.message,
            "data": self.data,
            "created_at": self.created_at,
            "read": self.read,
        }


class OpportunityScanner:
    """
    BIST100 fırsat tarayıcısı.
    Periyodik olarak çalışır, tüm hisseleri tarar ve fırsat bulur.
    """

    def __init__(self):
        self._alerts: list[dict] = []
        self._max_alerts = 200  # Bellekte maks. bildirim sayısı
        self._last_scan_time: float = 0
        self._scan_count: int = 0
        self._running: bool = False
        self._task: Optional[asyncio.Task] = None
        # Aynı fırsat tekrar bildirmemek için cooldown (symbol+type → timestamp)
        self._cooldown: dict[str, float] = {}
        self._cooldown_seconds = 1800  # 30 dakika aynı fırsat tekrar bildirilmez

    @property
    def alerts(self) -> list[dict]:
        return list(reversed(self._alerts))  # En yeni başta

    @property
    def unread_count(self) -> int:
        return sum(1 for a in self._alerts if not a.get("read", False))

    def mark_read(self, alert_id: str) -> bool:
        for a in self._alerts:
            if a["id"] == alert_id:
                a["read"] = True
                return True
        return False

    def mark_all_read(self) -> int:
        count = 0
        for a in self._alerts:
            if not a.get("read", False):
                a["read"] = True
                count += 1
        return count

    def clear_alerts(self):
        self._alerts.clear()

    def _is_in_cooldown(self, symbol: str, alert_type: str) -> bool:
        key = f"{symbol}:{alert_type}"
        last = self._cooldown.get(key, 0)
        return (time.time() - last) < self._cooldown_seconds

    def _set_cooldown(self, symbol: str, alert_type: str):
        self._cooldown[key := f"{symbol}:{alert_type}"] = time.time()

    def _add_alert(self, alert: OpportunityAlert) -> dict:
        """Alert'i listeye ekle, eski olanları sil."""
        if self._is_in_cooldown(alert.symbol, alert.alert_type):
            return None
        self._set_cooldown(alert.symbol, alert.alert_type)

        alert_dict = alert.to_dict()
        self._alerts.append(alert_dict)

        # Maks. aşınca en eskileri sil
        while len(self._alerts) > self._max_alerts:
            self._alerts.pop(0)

        logger.info(
            f"🔔 Fırsat: [{alert.priority.upper()}] {alert.symbol} — {alert.title}"
        )
        return alert_dict

    async def scan_stock(self, symbol: str, forecast_data: dict) -> list[dict]:
        """
        Tek bir hissenin forecast verisini analiz edip fırsatları tespit eder.
        forecast_data: get_forecast() sonucu.
        """
        if not forecast_data or forecast_data.get("error"):
            return []

        new_alerts = []
        price = float(forecast_data.get("current_price", 0) or 0)
        predicted = float(forecast_data.get("predicted_price", 0) or 0)
        confidence = float(forecast_data.get("confidence", 0) or 0)
        signal = forecast_data.get("risk_signal") or forecast_data.get("signal", "HOLD")
        rsi = float(forecast_data.get("rsi", 50) or 50)
        macd_hist = float(forecast_data.get("macd_histogram", 0) or 0)
        bollinger_pctb = float(forecast_data.get("bollinger_pctb", 0.5) or 0.5)
        change_pct = float(forecast_data.get("change_percent", 0) or 0)
        volume_ratio = float(forecast_data.get("volume_ratio", 1.0) or 1.0)
        stochastic_k = float(forecast_data.get("stochastic_k", 50) or 50)

        # ── 1) Güçlü AI Sinyali ──
        if signal == "BUY" and confidence >= 0.75:
            diff_pct = ((predicted - price) / price * 100) if price > 0 else 0
            alert = self._add_alert(OpportunityAlert(
                symbol=symbol,
                alert_type="STRONG_BUY",
                priority=PRIORITY_CRITICAL,
                title=f"{symbol} Güçlü AL Sinyali",
                message=(
                    f"AI %{confidence*100:.0f} güvenle AL sinyali verdi.\n"
                    f"Fiyat: ₺{price:.2f} → Hedef: ₺{predicted:.2f} ({diff_pct:+.1f}%)"
                ),
                data={"price": price, "predicted": predicted, "confidence": confidence,
                      "rsi": rsi, "signal": signal},
            ))
            if alert:
                new_alerts.append(alert)

        elif signal == "SELL" and confidence >= 0.75:
            diff_pct = ((predicted - price) / price * 100) if price > 0 else 0
            alert = self._add_alert(OpportunityAlert(
                symbol=symbol,
                alert_type="STRONG_SELL",
                priority=PRIORITY_CRITICAL,
                title=f"{symbol} Güçlü SAT Sinyali",
                message=(
                    f"AI %{confidence*100:.0f} güvenle SAT sinyali verdi.\n"
                    f"Fiyat: ₺{price:.2f} → Hedef: ₺{predicted:.2f} ({diff_pct:+.1f}%)"
                ),
                data={"price": price, "predicted": predicted, "confidence": confidence,
                      "rsi": rsi, "signal": signal},
            ))
            if alert:
                new_alerts.append(alert)

        # ── 2) RSI Aşırı Bölgeler ──
        if rsi <= 30:
            alert = self._add_alert(OpportunityAlert(
                symbol=symbol,
                alert_type="RSI_OVERSOLD",
                priority=PRIORITY_HIGH,
                title=f"{symbol} RSI Aşırı Satım",
                message=f"RSI {rsi:.1f} — Aşırı satım bölgesinde. Potansiyel dip fırsatı.",
                data={"price": price, "rsi": rsi},
            ))
            if alert:
                new_alerts.append(alert)
        elif rsi >= 70:
            alert = self._add_alert(OpportunityAlert(
                symbol=symbol,
                alert_type="RSI_OVERBOUGHT",
                priority=PRIORITY_HIGH,
                title=f"{symbol} RSI Aşırı Alım",
                message=f"RSI {rsi:.1f} — Aşırı alım bölgesinde. Kâr realizasyonu zamanı.",
                data={"price": price, "rsi": rsi},
            ))
            if alert:
                new_alerts.append(alert)

        # ── 3) MACD Çaprazlamaları ──
        # macd_histogram pozitife geçiyorsa boğa, negatife geçiyorsa ayı
        if macd_hist > 0 and macd_hist < 0.3 and signal in ("BUY", "HOLD"):
            alert = self._add_alert(OpportunityAlert(
                symbol=symbol,
                alert_type="MACD_BULLISH_CROSS",
                priority=PRIORITY_HIGH,
                title=f"{symbol} MACD Boğa Çaprazı",
                message=f"MACD histogram pozitife geçti ({macd_hist:+.3f}). Yükseliş trendi başlıyor olabilir.",
                data={"price": price, "macd_histogram": macd_hist},
            ))
            if alert:
                new_alerts.append(alert)
        elif macd_hist < 0 and macd_hist > -0.3 and signal in ("SELL", "HOLD"):
            alert = self._add_alert(OpportunityAlert(
                symbol=symbol,
                alert_type="MACD_BEARISH_CROSS",
                priority=PRIORITY_HIGH,
                title=f"{symbol} MACD Ayı Çaprazı",
                message=f"MACD histogram negatife geçti ({macd_hist:+.3f}). Düşüş trendi başlıyor olabilir.",
                data={"price": price, "macd_histogram": macd_hist},
            ))
            if alert:
                new_alerts.append(alert)

        # ── 4) Büyük Fiyat Hareketi ──
        if change_pct >= 3.0:
            alert = self._add_alert(OpportunityAlert(
                symbol=symbol,
                alert_type="BIG_MOVE_UP",
                priority=PRIORITY_HIGH,
                title=f"{symbol} 🚀 %{change_pct:+.1f} Yükseliş",
                message=f"Fiyat: ₺{price:.2f} — Bugün %{change_pct:.1f} yükseldi.",
                data={"price": price, "change_pct": change_pct},
            ))
            if alert:
                new_alerts.append(alert)
        elif change_pct <= -3.0:
            alert = self._add_alert(OpportunityAlert(
                symbol=symbol,
                alert_type="BIG_MOVE_DOWN",
                priority=PRIORITY_HIGH,
                title=f"{symbol} 💥 %{change_pct:.1f} Düşüş",
                message=f"Fiyat: ₺{price:.2f} — Bugün %{abs(change_pct):.1f} düştü.",
                data={"price": price, "change_pct": change_pct},
            ))
            if alert:
                new_alerts.append(alert)

        # ── 5) Hacim Patlaması ──
        if volume_ratio >= 2.0:
            alert = self._add_alert(OpportunityAlert(
                symbol=symbol,
                alert_type="VOLUME_SPIKE",
                priority=PRIORITY_MEDIUM,
                title=f"{symbol} Hacim Patlaması ({volume_ratio:.1f}x)",
                message=f"İşlem hacmi ortalamanın {volume_ratio:.1f} katına çıktı.",
                data={"price": price, "volume_ratio": volume_ratio},
            ))
            if alert:
                new_alerts.append(alert)

        # ── 6) Bollinger Bandı Sinyalleri ──
        if bollinger_pctb <= 0.05:
            alert = self._add_alert(OpportunityAlert(
                symbol=symbol,
                alert_type="BOLLINGER_OVERSOLD",
                priority=PRIORITY_MEDIUM,
                title=f"{symbol} Bollinger Alt Destek",
                message=f"Fiyat Bollinger alt bandına temas ({bollinger_pctb:.2f}). Potansiyel destek noktası.",
                data={"price": price, "bollinger_pctb": bollinger_pctb},
            ))
            if alert:
                new_alerts.append(alert)
        elif bollinger_pctb >= 0.95:
            alert = self._add_alert(OpportunityAlert(
                symbol=symbol,
                alert_type="BOLLINGER_OVERBOUGHT",
                priority=PRIORITY_MEDIUM,
                title=f"{symbol} Bollinger Üst Direnç",
                message=f"Fiyat Bollinger üst bandına temas ({bollinger_pctb:.2f}). Potansiyel direnç noktası.",
                data={"price": price, "bollinger_pctb": bollinger_pctb},
            ))
            if alert:
                new_alerts.append(alert)

        return new_alerts

    def get_status(self) -> dict:
        return {
            "running": self._running,
            "scan_count": self._scan_count,
            "last_scan_time": self._last_scan_time,
            "total_alerts": len(self._alerts),
            "unread_count": self.unread_count,
            "cooldown_seconds": self._cooldown_seconds,
        }


# Singleton instance
opportunity_scanner = OpportunityScanner()
