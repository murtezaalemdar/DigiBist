import logging

logger = logging.getLogger(__name__)


class RiskEngine:
    """
    Gelişmiş Risk Yönetim Motoru v2.0
    ─────────────────────────────────
    • Dinamik güven eşiği (ATR + market rejim bazlı)
    • Drawdown koruması (portföy seviyesi)
    • Arka arkaya kayıp takibi
    • Kelly Criterion pozisyon boyutlandırma
    • Market rejim – sinyal uyumu filtresi
    • Volatilite bazlı panik satış koruması
    """

    # ─── Sabit Parametreler ───
    MAX_POSITION_SIZE = 50000        # Tek pozisyon maks. TL
    MAX_ALLOCATION_PCT = 0.20        # Portföyden tek hisseye maks. %20
    MAX_VOLATILITY_THRESHOLD = 0.05  # %5 volatilite toleransı
    MAX_DRAWDOWN_PCT = 0.10          # Portföy maks. %10 drawdown
    KELLY_FRACTION = 0.5             # Half-Kelly (muhafazakâr)

    # ─── Drawdown Takip (Sınıf Değişkeni — uygulama ömrü boyunca) ───
    _portfolio_high_water_mark: float = 0.0
    _consecutive_losses: int = 0
    _drawdown_active: bool = False

    # ═══════════════════════════════════════════
    #  1) Dinamik Güven Eşiği
    # ═══════════════════════════════════════════
    @staticmethod
    def _dynamic_confidence_threshold(atr_pct: float = 0.0, market_regime: str = "SIDEWAYS") -> float:
        """
        ATR volatilitesi ve market rejimine göre dinamik güven eşiği.
        Yüksek volatilite → daha yüksek eşik.
        Ayı piyasası → daha temkinli.
        """
        # ATR bazlı taban
        if atr_pct > 4.0:
            base = 0.82
        elif atr_pct > 3.0:
            base = 0.78
        elif atr_pct > 2.0:
            base = 0.72
        else:
            base = 0.65

        # Market rejim bazlı ayar
        if market_regime in ("BEAR", "BEAR_WEAK"):
            base += 0.05
        elif market_regime == "BULL":
            base -= 0.03

        return round(min(0.90, max(0.60, base)), 2)

    # ═══════════════════════════════════════════
    #  2) Kelly Criterion Pozisyon Boyutlandırma
    # ═══════════════════════════════════════════
    @staticmethod
    def kelly_position_size(
        win_rate: float,
        avg_win: float,
        avg_loss: float,
        portfolio_value: float = 250000,
        max_position: float = None,
    ) -> dict:
        """
        Kelly Criterion ile optimal pozisyon büyüklüğü.
        Half-Kelly kullanılır (muhafazakâr).

        f* = (p × b − q) / b
        p = kazanma olasılığı, q = kaybetme olas., b = ort. kazanç / ort. kayıp
        """
        if avg_loss <= 0 or win_rate <= 0:
            return {
                "kelly_fraction": 0,
                "position_size": 0,
                "position_pct": 0,
                "kelly_reason": "Yetersiz veri — pozisyon önerilmiyor.",
            }

        b = avg_win / avg_loss
        p = win_rate
        q = 1 - p
        kelly_full = (p * b - q) / b if b > 0 else 0
        kelly_half = kelly_full * RiskEngine.KELLY_FRACTION

        kelly_half = max(0, min(kelly_half, RiskEngine.MAX_ALLOCATION_PCT))
        position_size = portfolio_value * kelly_half

        if max_position:
            position_size = min(position_size, max_position)

        if kelly_full <= 0:
            return {
                "kelly_fraction": 0,
                "position_size": 0,
                "position_pct": 0,
                "kelly_reason": "Kelly negatif — strateji kârlı değil, işlem önerilmiyor.",
            }

        return {
            "kelly_fraction": round(kelly_half, 4),
            "position_size": round(position_size, 2),
            "position_pct": round(kelly_half * 100, 2),
            "kelly_reason": f"Half-Kelly: Portföyün %{kelly_half*100:.1f}'i ({position_size:,.0f}₺) öneriliyor.",
        }

    # ═══════════════════════════════════════════
    #  3) Drawdown Koruması
    # ═══════════════════════════════════════════
    @classmethod
    def update_drawdown(cls, current_portfolio_value: float) -> dict:
        """Portföy drawdown takibi. %10'u aşarsa tüm sinyaller kilitleme."""
        if current_portfolio_value > cls._portfolio_high_water_mark:
            cls._portfolio_high_water_mark = current_portfolio_value
            cls._drawdown_active = False

        if cls._portfolio_high_water_mark <= 0:
            cls._portfolio_high_water_mark = current_portfolio_value
            return {"drawdown_pct": 0, "drawdown_active": False, "reason": "İlk ölçüm."}

        drawdown = (cls._portfolio_high_water_mark - current_portfolio_value) / cls._portfolio_high_water_mark
        drawdown_pct = round(drawdown * 100, 2)

        if drawdown >= cls.MAX_DRAWDOWN_PCT:
            cls._drawdown_active = True
            return {
                "drawdown_pct": drawdown_pct,
                "drawdown_active": True,
                "reason": f"⚠ Portföy %{drawdown_pct} drawdown — tüm sinyaller HOLD'a çevrildi.",
            }

        return {
            "drawdown_pct": drawdown_pct,
            "drawdown_active": False,
            "reason": f"Drawdown %{drawdown_pct} — limit (%{cls.MAX_DRAWDOWN_PCT*100:.0f}) içinde.",
        }

    @classmethod
    def record_trade_result(cls, is_win: bool):
        """Arka arkaya kayıp takibi."""
        if is_win:
            cls._consecutive_losses = 0
        else:
            cls._consecutive_losses += 1

    # ═══════════════════════════════════════════
    #  4) Pozisyon Risk Kontrolü
    # ═══════════════════════════════════════════
    @staticmethod
    def check_position(position_size: float, portfolio_value: float = 250000) -> dict:
        """Pozisyon büyüklüğünü risk kurallarına göre kontrol et."""
        allocation_pct = position_size / portfolio_value if portfolio_value > 0 else 1.0

        if position_size > RiskEngine.MAX_POSITION_SIZE:
            return {
                "approved": False,
                "reason": f"Pozisyon büyüklüğü {position_size:,.0f}₺ maksimum limiti ({RiskEngine.MAX_POSITION_SIZE:,.0f}₺) aşıyor.",
                "risk_level": "HIGH",
            }

        if allocation_pct > RiskEngine.MAX_ALLOCATION_PCT:
            return {
                "approved": False,
                "reason": f"Portföy tahsisi %{allocation_pct*100:.1f} maksimum sınırı (%{RiskEngine.MAX_ALLOCATION_PCT*100:.0f}) aşıyor.",
                "risk_level": "HIGH",
            }

        risk_level = "LOW" if allocation_pct < 0.05 else ("MEDIUM" if allocation_pct < 0.10 else "HIGH")
        return {
            "approved": True,
            "reason": "Pozisyon risk parametreleri içinde.",
            "risk_level": risk_level,
            "allocation_pct": round(allocation_pct * 100, 2),
        }

    # ═══════════════════════════════════════════
    #  5) Ana Sinyal Değerlendirme (Tüm Filtreler)
    # ═══════════════════════════════════════════
    @classmethod
    def evaluate_signal(
        cls,
        signal: str,
        confidence: float,
        current_price: float,
        predicted_price: float,
        # Yeni parametreler (opsiyonel — geriye uyumlu)
        atr_pct: float = 0.0,
        market_regime: str = "SIDEWAYS",
        win_rate: float = 0.5,
        avg_win: float = 0.01,
        avg_loss: float = 0.01,
    ) -> dict:
        """
        AI sinyalini çoklu risk filtresinden geçir:
        ① Drawdown koruması
        ② Arka arkaya kayıp kontrolü
        ③ Dinamik güven eşiği (ATR + rejim)
        ④ Volatilite filtresi
        ⑤ Market rejim – sinyal uyumu
        """
        price_diff_pct = abs(predicted_price - current_price) / current_price if current_price > 0 else 0
        dynamic_threshold = cls._dynamic_confidence_threshold(atr_pct, market_regime)
        warnings = []

        # ─── Filtre 1: Drawdown Koruması ───
        if cls._drawdown_active:
            return {
                "final_signal": "HOLD",
                "original_signal": signal,
                "reason": "⚠ Portföy drawdown limiti aşıldı — tüm işlemler durduruldu.",
                "risk_adjusted": True,
                "confidence_threshold": 1.0,
                "filters_applied": ["DRAWDOWN"],
            }

        # ─── Filtre 2: Arka Arkaya Kayıp ───
        if cls._consecutive_losses >= 3:
            boosted = 0.85
            if confidence < boosted:
                return {
                    "final_signal": "HOLD",
                    "original_signal": signal,
                    "reason": f"Arka arkaya {cls._consecutive_losses} kayıp — güven eşiği geçici %85'e yükseltildi.",
                    "risk_adjusted": True,
                    "confidence_threshold": boosted,
                    "filters_applied": ["CONSECUTIVE_LOSS"],
                }

        # ─── Filtre 3: Dinamik Güven Eşiği ───
        if confidence < dynamic_threshold:
            return {
                "final_signal": "HOLD",
                "original_signal": signal,
                "reason": (
                    f"Güven skoru (%{confidence*100:.0f}) dinamik eşiğin (%{dynamic_threshold*100:.0f}) altında. "
                    f"ATR: %{atr_pct:.1f}, Rejim: {market_regime}."
                ),
                "risk_adjusted": True,
                "confidence_threshold": dynamic_threshold,
                "filters_applied": ["DYNAMIC_THRESHOLD"],
            }

        # ─── Filtre 4: Aşırı Volatilite ───
        if price_diff_pct > cls.MAX_VOLATILITY_THRESHOLD and signal == "SELL":
            return {
                "final_signal": "HOLD",
                "original_signal": signal,
                "reason": f"Aşırı volatilite (%{price_diff_pct*100:.1f}) — panik satışından kaçın.",
                "risk_adjusted": True,
                "confidence_threshold": dynamic_threshold,
                "filters_applied": ["VOLATILITY"],
            }

        # ─── Filtre 5: Market Rejim – Sinyal Uyumu ───
        if market_regime == "BEAR" and signal == "BUY" and confidence < 0.80:
            warnings.append("Ayı piyasasında AL sinyali — ekstra dikkatli olun.")
        elif market_regime == "BULL" and signal == "SELL" and confidence < 0.80:
            warnings.append("Boğa piyasasında SAT sinyali — erken satış riski.")

        # ─── Tüm filtrelerden geçti ───
        base_reason = "✅ Sinyal tüm risk filtrelerinden geçti."
        if warnings:
            base_reason += " ⚠ " + " ".join(warnings)

        return {
            "final_signal": signal,
            "original_signal": signal,
            "reason": base_reason,
            "risk_adjusted": False,
            "confidence_threshold": dynamic_threshold,
            "filters_applied": [],
        }
