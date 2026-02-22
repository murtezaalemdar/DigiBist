import os
import httpx
import logging

logger = logging.getLogger(__name__)

TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

SIGNAL_EMOJI = {
    "BUY": "🟢",
    "SELL": "🔴",
    "HOLD": "🟡"
}

class TelegramNotifier:
    """
    Ultra Enterprise projesinden uyarlanan Telegram bildirim servisi.
    AI sinyalleri için Telegram'a otomatik mesaj gönderir.
    """

    @staticmethod
    async def send_message(text: str) -> bool:
        if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
            logger.warning("Telegram token veya chat_id ayarlanmamış. Bildirim atlandı.")
            return False
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json={
                    "chat_id": TELEGRAM_CHAT_ID,
                    "text": text,
                    "parse_mode": "HTML"
                })
            return resp.status_code == 200
        except Exception as e:
            logger.error(f"Telegram bildirimi gönderilemedi: {e}")
            return False

    @staticmethod
    async def notify_signal(symbol: str, signal: str, current_price: float,
                             predicted_price: float, confidence: float) -> bool:
        emoji = SIGNAL_EMOJI.get(signal, "⚪")
        diff = predicted_price - current_price
        diff_pct = (diff / current_price) * 100
        direction = "▲" if diff > 0 else "▼"

        message = (
            f"<b>{emoji} BIST AI SİNYALİ</b>\n\n"
            f"📊 <b>Hisse:</b> {symbol}\n"
            f"💰 <b>Güncel Fiyat:</b> ₺{current_price:.2f}\n"
            f"🎯 <b>AI Tahmini:</b> ₺{predicted_price:.2f} {direction} %{abs(diff_pct):.2f}\n"
            f"📈 <b>Sinyal:</b> {signal}\n"
            f"🧠 <b>Model Güveni:</b> %{confidence*100:.0f}\n\n"
            f"⚠️ <i>Bu mesaj yatırım tavsiyesi değildir.</i>"
        )
        return await TelegramNotifier.send_message(message)
