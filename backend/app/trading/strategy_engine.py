"""
Strateji Motoru V2 — AI, İndikatör ve Hibrit strateji desteği.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class IndicatorSet:
    rsi: float = 50.0
    ai_prob: float = 0.5
    momentum: float = 0.0
    macd: float = 0.0
    macd_signal: float = 0.0
    macd_hist: float = 0.0
    sma_20: float = 0.0
    sma_50: float = 0.0
    ema_12: float = 0.0
    ema_26: float = 0.0
    bb_upper: float = 0.0
    bb_lower: float = 0.0
    current_price: float = 0.0
    volume_ratio: float = 1.0  # Hacim / Hacim SMA


@dataclass
class StrategyResult:
    signal: str = "HOLD"
    confidence: float = 0.0
    reasons: list = field(default_factory=list)
    strategy_type: str = "manual"
    indicators_snapshot: dict = field(default_factory=dict)


class StrategyEngine:
    """
    V2 Strateji Değerlendirmesi.
    3 mod: ai_only, indicator, hybrid
    """

    @staticmethod
    def evaluate_ai_only(indicators: IndicatorSet, min_confidence: float = 0.75) -> StrategyResult:
        """Sadece AI tahmin olasılığına göre karar."""
        result = StrategyResult(strategy_type="ai_only")
        result.indicators_snapshot = {
            "ai_prob": indicators.ai_prob,
            "rsi": indicators.rsi,
        }

        if indicators.ai_prob >= min_confidence and indicators.momentum > 0:
            result.signal = "BUY"
            result.confidence = indicators.ai_prob
            result.reasons.append(f"AI olasılık: {indicators.ai_prob:.2%} (eşik: {min_confidence:.2%})")
            result.reasons.append(f"Momentum pozitif: {indicators.momentum:.4f}")
        elif indicators.ai_prob >= min_confidence and indicators.momentum < 0:
            result.signal = "SELL"
            result.confidence = indicators.ai_prob
            result.reasons.append(f"AI olasılık: {indicators.ai_prob:.2%} (eşik: {min_confidence:.2%})")
            result.reasons.append(f"Momentum negatif: {indicators.momentum:.4f}")
        else:
            result.signal = "HOLD"
            result.confidence = indicators.ai_prob
            result.reasons.append(f"AI olasılık yetersiz: {indicators.ai_prob:.2%}")

        return result

    @staticmethod
    def evaluate_indicator(
        indicators: IndicatorSet,
        rsi_oversold: float = 30,
        rsi_overbought: float = 70,
        use_macd: bool = True,
        use_bollinger: bool = True,
        use_volume: bool = True,
    ) -> StrategyResult:
        """Teknik indikatörlere göre karar."""
        result = StrategyResult(strategy_type="indicator")
        buy_signals = 0
        sell_signals = 0
        total_checks = 0

        # RSI
        total_checks += 1
        if indicators.rsi < rsi_oversold:
            buy_signals += 1
            result.reasons.append(f"RSI aşırı satım: {indicators.rsi:.1f} < {rsi_oversold}")
        elif indicators.rsi > rsi_overbought:
            sell_signals += 1
            result.reasons.append(f"RSI aşırı alım: {indicators.rsi:.1f} > {rsi_overbought}")
        else:
            result.reasons.append(f"RSI nötr: {indicators.rsi:.1f}")

        # MACD
        if use_macd:
            total_checks += 1
            if indicators.macd_hist > 0 and indicators.macd > indicators.macd_signal:
                buy_signals += 1
                result.reasons.append(f"MACD yukarı kesişim (hist: {indicators.macd_hist:.4f})")
            elif indicators.macd_hist < 0 and indicators.macd < indicators.macd_signal:
                sell_signals += 1
                result.reasons.append(f"MACD aşağı kesişim (hist: {indicators.macd_hist:.4f})")

        # Bollinger Bands
        if use_bollinger and indicators.bb_lower > 0 and indicators.current_price > 0:
            total_checks += 1
            if indicators.current_price <= indicators.bb_lower:
                buy_signals += 1
                result.reasons.append(f"Fiyat alt Bollinger bandında: ₺{indicators.current_price:.2f} ≤ ₺{indicators.bb_lower:.2f}")
            elif indicators.current_price >= indicators.bb_upper:
                sell_signals += 1
                result.reasons.append(f"Fiyat üst Bollinger bandında: ₺{indicators.current_price:.2f} ≥ ₺{indicators.bb_upper:.2f}")

        # Hacim
        if use_volume:
            total_checks += 1
            if indicators.volume_ratio > 1.5:
                if indicators.momentum > 0:
                    buy_signals += 1
                    result.reasons.append(f"Yüksek hacim + yukarı momentum (hacim oranı: {indicators.volume_ratio:.1f}x)")
                elif indicators.momentum < 0:
                    sell_signals += 1
                    result.reasons.append(f"Yüksek hacim + aşağı momentum (hacim oranı: {indicators.volume_ratio:.1f}x)")

        # SMA Cross
        total_checks += 1
        if indicators.sma_20 > indicators.sma_50 and indicators.sma_20 > 0:
            buy_signals += 1
            result.reasons.append("SMA20 > SMA50 (Golden Cross)")
        elif indicators.sma_20 < indicators.sma_50 and indicators.sma_50 > 0:
            sell_signals += 1
            result.reasons.append("SMA20 < SMA50 (Death Cross)")

        # Karar
        if total_checks > 0:
            buy_ratio = buy_signals / total_checks
            sell_ratio = sell_signals / total_checks
            result.confidence = max(buy_ratio, sell_ratio)

            if buy_signals >= 3 or buy_ratio > 0.6:
                result.signal = "BUY"
            elif sell_signals >= 3 or sell_ratio > 0.6:
                result.signal = "SELL"
            else:
                result.signal = "HOLD"

        result.indicators_snapshot = {
            "rsi": indicators.rsi,
            "macd": indicators.macd,
            "macd_signal": indicators.macd_signal,
            "macd_hist": indicators.macd_hist,
            "sma_20": indicators.sma_20,
            "sma_50": indicators.sma_50,
            "bb_upper": indicators.bb_upper,
            "bb_lower": indicators.bb_lower,
            "current_price": indicators.current_price,
            "volume_ratio": indicators.volume_ratio,
            "buy_signals": buy_signals,
            "sell_signals": sell_signals,
            "total_checks": total_checks,
        }

        return result

    @staticmethod
    def evaluate_hybrid(
        indicators: IndicatorSet,
        min_confidence: float = 0.75,
        rsi_oversold: float = 30,
        rsi_overbought: float = 70,
        use_macd: bool = True,
        use_bollinger: bool = True,
        use_volume: bool = True,
    ) -> StrategyResult:
        """AI + İndikatör birleşik strateji."""
        ai_result = StrategyEngine.evaluate_ai_only(indicators, min_confidence)
        ind_result = StrategyEngine.evaluate_indicator(
            indicators, rsi_oversold, rsi_overbought, use_macd, use_bollinger, use_volume
        )

        result = StrategyResult(strategy_type="hybrid")
        result.reasons = [f"[AI] {r}" for r in ai_result.reasons] + [f"[İNDİKATÖR] {r}" for r in ind_result.reasons]

        # Her iki strateji de aynı sinyali veriyorsa güçlü sinyal
        if ai_result.signal == ind_result.signal and ai_result.signal != "HOLD":
            result.signal = ai_result.signal
            result.confidence = (ai_result.confidence + ind_result.confidence) / 2
            result.reasons.append(f"✅ AI ve İndikatör uyumlu: {result.signal}")
        elif ai_result.signal != "HOLD" and ind_result.signal == "HOLD":
            # AI aktif, indikatör nötr → AI'a güven ama düşük güvenle
            result.signal = ai_result.signal
            result.confidence = ai_result.confidence * 0.7
            result.reasons.append(f"⚠️ Sadece AI sinyal veriyor, indikatör nötr")
        elif ind_result.signal != "HOLD" and ai_result.signal == "HOLD":
            # İndikatör aktif, AI nötr
            result.signal = ind_result.signal
            result.confidence = ind_result.confidence * 0.6
            result.reasons.append(f"⚠️ Sadece indikatör sinyal veriyor, AI nötr")
        elif ai_result.signal != ind_result.signal and ai_result.signal != "HOLD" and ind_result.signal != "HOLD":
            # Çelişkili sinyaller → HOLD
            result.signal = "HOLD"
            result.confidence = 0.3
            result.reasons.append(f"❌ AI ({ai_result.signal}) vs İndikatör ({ind_result.signal}) çelişkili — HOLD")
        else:
            result.signal = "HOLD"
            result.confidence = 0.3

        result.indicators_snapshot = {
            **ind_result.indicators_snapshot,
            "ai_prob": indicators.ai_prob,
            "ai_signal": ai_result.signal,
            "indicator_signal": ind_result.signal,
        }

        return result

    @staticmethod
    def evaluate(indicators: IndicatorSet) -> str:
        """Geriye uyumluluk: basit strateji."""
        if indicators.rsi < 30 and indicators.ai_prob >= 0.75 and indicators.momentum > 0:
            return "BUY"
        if indicators.rsi > 70 and indicators.ai_prob >= 0.75 and indicators.momentum < 0:
            return "SELL"
        return "HOLD"
