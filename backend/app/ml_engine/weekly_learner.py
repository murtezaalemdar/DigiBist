"""
DigiBist — Haftalık Öz-Öğrenme Sistemi (weekly_learner.py)
═══════════════════════════════════════════════════════════════════════════════

🧠 AMAÇ:
  Her Cuma 18:00'den sonra (borsa kapanışı) otomatik çalışarak:
  1. Geçmiş tahminlerin gerçek sonuçlarını analiz eder
  2. Hangi indikatörlerin/parametrelerin en iyi performansı verdiğini hesaplar
  3. Model konfigürasyonunu veriye dayalı olarak günceller
  4. Performans geçmişini veritabanına kaydeder
  5. Trend takibi yapar (hafta hafta iyileşme/kötüleşme)

📋 TASARIM PRENSİPLERİ:
  - "Kendini ispatlamış ve stabil olanlar" — her değişiklik veriye dayanmalı
  - Sürekli yukarı ivmeli doğru tahmin süreci hedeflenir
  - Yeni sistemlere/indikatörlere açık mimari (pluggable analyzers)
  - Muhafazakâr: Ani büyük değişiklikler yapmaz, kademeli iyileştirme
  - Her öğrenme döngüsü loglanır ve geri alınabilir

📊 PERFORMANS METRİKLERİ:
  - Yönsel doğruluk (is_direction_correct) — ana KPI
  - İndikatör bazlı doğruluk (RSI zone, MACD, Stoch, BB, vs.)
  - Confidence-accuracy korelasyonu
  - Model bazlı karşılaştırma (RF vs XGB)
  - Zaman trendi (haftalık gelişme eğrisi)

🔧 KONFİGÜRASYON PARAMETRELERİ (self-tuning):
  - confidence_threshold: Model sinyal eşiği
  - risk_engine_base: Risk engine dinamik eşik tabanı
  - min_confirmations: Çoklu teyit minimum sayısı
  - feature_weights: İndikatör ağırlıkları (gelecek v3 için)

📅 ZAMANLAMA:
  - Cron: Her Cuma 18:05 (Türkiye saati, borsa kapanışından 5dk sonra)
  - Manuel: /api/ml/weekly-learn endpoint'i ile tetiklenebilir
  - Startup: Uygulama başlangıcında son öğrenme raporu yüklenir

🗄️ VERİTABANI:
  - ml_learning_history tablosu: Her döngünün sonuçları
  - ml_model_config tablosu: Aktif model konfigürasyonu (tunable parametreler)

DEĞİŞİKLİK GEÇMİŞİ:
  - v1.0 (2026-02-27): İlk sürüm — temel analiz + self-tuning
"""

import asyncio
import logging
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Türkiye saati
TZ_TR = timezone(timedelta(hours=3))


# ═══════════════════════════════════════════════════════
#  1) Veritabanı Migration & CRUD
# ═══════════════════════════════════════════════════════

MIGRATION_SQL = """
-- Haftalık öğrenme geçmişi
CREATE TABLE IF NOT EXISTS ml_learning_history (
    id              BIGSERIAL PRIMARY KEY,
    run_date        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    week_start      DATE NOT NULL,
    week_end        DATE NOT NULL,
    
    -- Genel metrikler
    total_predictions       INT DEFAULT 0,
    verified_predictions    INT DEFAULT 0,
    direction_correct       INT DEFAULT 0,
    direction_accuracy_pct  NUMERIC(5,2) DEFAULT 0,
    avg_confidence          NUMERIC(5,4) DEFAULT 0,
    avg_price_error_pct     NUMERIC(8,2) DEFAULT 0,
    
    -- Model bazlı
    model_scores            JSONB DEFAULT '{}',
    
    -- İndikatör bazlı doğruluk
    indicator_analysis      JSONB DEFAULT '{}',
    
    -- Confidence bölge analizi
    confidence_zones        JSONB DEFAULT '{}',
    
    -- Sinyal bazlı
    signal_analysis         JSONB DEFAULT '{}',
    
    -- Önerilen ayar değişiklikleri
    recommendations         JSONB DEFAULT '{}',
    
    -- Uygulanan değişiklikler
    applied_changes         JSONB DEFAULT '{}',
    
    -- Genel trend (önceki haftalara kıyasla)
    trend_direction         VARCHAR(10) DEFAULT 'STABLE',
    trend_details           JSONB DEFAULT '{}',
    
    -- Tam analiz raporu
    full_report             JSONB DEFAULT '{}',
    
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Model konfigürasyonu (tunable parametreler)  
CREATE TABLE IF NOT EXISTS ml_model_config (
    id                  BIGSERIAL PRIMARY KEY,
    config_version      INT NOT NULL DEFAULT 1,
    is_active           BOOLEAN DEFAULT TRUE,
    
    -- Güven eşikleri
    confidence_threshold    NUMERIC(5,4) DEFAULT 0.45,
    
    -- Risk engine
    risk_base_normal        NUMERIC(5,4) DEFAULT 0.40,
    risk_base_mid           NUMERIC(5,4) DEFAULT 0.45,
    risk_base_high          NUMERIC(5,4) DEFAULT 0.50,
    risk_base_extreme       NUMERIC(5,4) DEFAULT 0.55,
    
    -- Sinyal mantığı
    min_confirmations       INT DEFAULT 2,
    adx_min_threshold       NUMERIC(5,2) DEFAULT 15.0,
    
    -- Güven formülü ağırlıkları
    confidence_r2_weight    NUMERIC(5,4) DEFAULT 0.15,
    confidence_dir_weight   NUMERIC(5,4) DEFAULT 0.85,
    
    -- Model hiperparametreleri (JSON)
    rf_params               JSONB DEFAULT '{}',
    xgb_params              JSONB DEFAULT '{}',
    
    -- Feature listesi (aktif features)
    active_features         JSONB DEFAULT '[]',
    
    -- Metadata
    reason                  TEXT DEFAULT '',
    applied_by              VARCHAR(50) DEFAULT 'weekly_learner',
    applied_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_ml_learning_week ON ml_learning_history(week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_ml_config_active ON ml_model_config(is_active, config_version);
"""


async def migrate_ml_learning():
    """
    ML öğrenme tablolarını oluştur (idempotent).
    Uygulama startup'ında çağrılır.
    asyncpg: tek seferde birden fazla statement desteklemez → ayrı transaction.
    Concurrent worker'lar: her statement ayrı conn.begin() ile çalışır.
    """
    from app.core.database import async_engine
    from sqlalchemy import text
    
    statements = [
        # 1) ml_learning_history tablosu
        """CREATE TABLE IF NOT EXISTS ml_learning_history (
            id              BIGSERIAL PRIMARY KEY,
            run_date        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            week_start      DATE NOT NULL,
            week_end        DATE NOT NULL,
            total_predictions       INT DEFAULT 0,
            verified_predictions    INT DEFAULT 0,
            direction_correct       INT DEFAULT 0,
            direction_accuracy_pct  NUMERIC(5,2) DEFAULT 0,
            avg_confidence          NUMERIC(5,4) DEFAULT 0,
            avg_price_error_pct     NUMERIC(8,2) DEFAULT 0,
            model_scores            JSONB DEFAULT '{}',
            indicator_analysis      JSONB DEFAULT '{}',
            confidence_zones        JSONB DEFAULT '{}',
            signal_analysis         JSONB DEFAULT '{}',
            recommendations         JSONB DEFAULT '{}',
            applied_changes         JSONB DEFAULT '{}',
            trend_direction         VARCHAR(10) DEFAULT 'STABLE',
            trend_details           JSONB DEFAULT '{}',
            full_report             JSONB DEFAULT '{}',
            created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )""",
        # 2) ml_model_config tablosu
        """CREATE TABLE IF NOT EXISTS ml_model_config (
            id                  BIGSERIAL PRIMARY KEY,
            config_version      INT NOT NULL DEFAULT 1,
            is_active           BOOLEAN DEFAULT TRUE,
            confidence_threshold    NUMERIC(5,4) DEFAULT 0.45,
            risk_base_normal        NUMERIC(5,4) DEFAULT 0.40,
            risk_base_mid           NUMERIC(5,4) DEFAULT 0.45,
            risk_base_high          NUMERIC(5,4) DEFAULT 0.50,
            risk_base_extreme       NUMERIC(5,4) DEFAULT 0.55,
            min_confirmations       INT DEFAULT 2,
            adx_min_threshold       NUMERIC(5,2) DEFAULT 15.0,
            confidence_r2_weight    NUMERIC(5,4) DEFAULT 0.15,
            confidence_dir_weight   NUMERIC(5,4) DEFAULT 0.85,
            rf_params               JSONB DEFAULT '{}',
            xgb_params              JSONB DEFAULT '{}',
            active_features         JSONB DEFAULT '[]',
            reason                  TEXT DEFAULT '',
            applied_by              VARCHAR(50) DEFAULT 'weekly_learner',
            applied_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )""",
        # 3) İndeksler
        "CREATE INDEX IF NOT EXISTS idx_ml_learning_week ON ml_learning_history(week_start, week_end)",
        "CREATE INDEX IF NOT EXISTS idx_ml_config_active ON ml_model_config(is_active, config_version)",
    ]
    
    try:
        for stmt in statements:
            try:
                async with async_engine.begin() as conn:
                    await conn.execute(text(stmt))
            except Exception as e:
                if "already exists" in str(e).lower():
                    pass
                else:
                    logger.debug(f"ML Learning migration statement (muhtemelen concurrent): {e}")
        logger.info("✅ ML Learning tabloları hazır")
    except Exception as e:
        logger.warning(f"ML Learning migration hatası: {e}")


async def save_learning_result(result: dict):
    """Haftalık öğrenme sonucunu veritabanına kaydet."""
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import text
    from datetime import date as dtdate
    # asyncpg date objesi bekler
    ws = result["week_start"]
    we = result["week_end"]
    if isinstance(ws, str):
        ws = dtdate.fromisoformat(ws)
    if isinstance(we, str):
        we = dtdate.fromisoformat(we)
    async with AsyncSessionLocal() as session:
        await session.execute(text("""
            INSERT INTO ml_learning_history (
                run_date, week_start, week_end,
                total_predictions, verified_predictions, direction_correct,
                direction_accuracy_pct, avg_confidence, avg_price_error_pct,
                model_scores, indicator_analysis, confidence_zones,
                signal_analysis, recommendations, applied_changes,
                trend_direction, trend_details, full_report
            ) VALUES (
                NOW(), :week_start, :week_end,
                :total_preds, :verified_preds, :dir_correct,
                :dir_acc_pct, :avg_conf, :avg_price_err,
                :model_scores, :indicator_analysis, :confidence_zones,
                :signal_analysis, :recommendations, :applied_changes,
                :trend_dir, :trend_details, :full_report
            )
        """), {
            "week_start": ws,
            "week_end": we,
            "total_preds": result.get("total_predictions", 0),
            "verified_preds": result.get("verified_predictions", 0),
            "dir_correct": result.get("direction_correct", 0),
            "dir_acc_pct": result.get("direction_accuracy_pct", 0),
            "avg_conf": result.get("avg_confidence", 0),
            "avg_price_err": result.get("avg_price_error_pct", 0),
            "model_scores": json.dumps(result.get("model_scores", {})),
            "indicator_analysis": json.dumps(result.get("indicator_analysis", {})),
            "confidence_zones": json.dumps(result.get("confidence_zones", {})),
            "signal_analysis": json.dumps(result.get("signal_analysis", {})),
            "recommendations": json.dumps(result.get("recommendations", {})),
            "applied_changes": json.dumps(result.get("applied_changes", {})),
            "trend_dir": result.get("trend_direction", "STABLE"),
            "trend_details": json.dumps(result.get("trend_details", {})),
            "full_report": json.dumps(result.get("full_report", {})),
        })
        await session.commit()
    logger.info(f"✅ Haftalık öğrenme sonucu kaydedildi: {result['week_start']} → {result['week_end']}")


async def save_model_config(config: dict, reason: str = ""):
    """Yeni model konfigürasyonunu kaydet (eski aktif olanı deaktif et)."""
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import text
    async with AsyncSessionLocal() as session:
        # Önceki aktif config'i deaktif et
        await session.execute(text(
            "UPDATE ml_model_config SET is_active = FALSE WHERE is_active = TRUE"
        ))
        # Yeni versiyon numarasını al
        result = await session.execute(text(
            "SELECT COALESCE(MAX(config_version), 0) + 1 FROM ml_model_config"
        ))
        new_version = result.scalar()
        
        await session.execute(text("""
            INSERT INTO ml_model_config (
                config_version, is_active,
                confidence_threshold,
                risk_base_normal, risk_base_mid, risk_base_high, risk_base_extreme,
                min_confirmations, adx_min_threshold,
                confidence_r2_weight, confidence_dir_weight,
                rf_params, xgb_params, active_features,
                reason, applied_by
            ) VALUES (
                :version, TRUE,
                :conf_threshold,
                :risk_normal, :risk_mid, :risk_high, :risk_extreme,
                :min_conf, :adx_min,
                :r2_weight, :dir_weight,
                :rf_params, :xgb_params, :features,
                :reason, 'weekly_learner'
            )
        """), {
            "version": new_version,
            "conf_threshold": config.get("confidence_threshold", 0.45),
            "risk_normal": config.get("risk_base_normal", 0.40),
            "risk_mid": config.get("risk_base_mid", 0.45),
            "risk_high": config.get("risk_base_high", 0.50),
            "risk_extreme": config.get("risk_base_extreme", 0.55),
            "min_conf": config.get("min_confirmations", 2),
            "adx_min": config.get("adx_min_threshold", 15.0),
            "r2_weight": config.get("confidence_r2_weight", 0.15),
            "dir_weight": config.get("confidence_dir_weight", 0.85),
            "rf_params": json.dumps(config.get("rf_params", {})),
            "xgb_params": json.dumps(config.get("xgb_params", {})),
            "features": json.dumps(config.get("active_features", [])),
            "reason": reason,
        })
        await session.commit()
    logger.info(f"✅ Model config v{new_version} kaydedildi: {reason}")
    return new_version


async def get_active_model_config() -> Optional[dict]:
    """Aktif model konfigürasyonunu getir."""
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import text
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("""
            SELECT config_version, confidence_threshold,
                   risk_base_normal, risk_base_mid, risk_base_high, risk_base_extreme,
                   min_confirmations, adx_min_threshold,
                   confidence_r2_weight, confidence_dir_weight,
                   rf_params, xgb_params, active_features,
                   reason, applied_at
            FROM ml_model_config
            WHERE is_active = TRUE
            ORDER BY config_version DESC LIMIT 1
        """))
        row = result.fetchone()
        if not row:
            return None
        return {
            "config_version": row[0],
            "confidence_threshold": float(row[1]),
            "risk_base_normal": float(row[2]),
            "risk_base_mid": float(row[3]),
            "risk_base_high": float(row[4]),
            "risk_base_extreme": float(row[5]),
            "min_confirmations": row[6],
            "adx_min_threshold": float(row[7]),
            "confidence_r2_weight": float(row[8]),
            "confidence_dir_weight": float(row[9]),
            "rf_params": row[10] if isinstance(row[10], dict) else json.loads(row[10] or "{}"),
            "xgb_params": row[11] if isinstance(row[11], dict) else json.loads(row[11] or "{}"),
            "active_features": row[12] if isinstance(row[12], list) else json.loads(row[12] or "[]"),
            "reason": row[13],
            "applied_at": row[14].isoformat() if row[14] else None,
        }


async def get_learning_history(limit: int = 12) -> list[dict]:
    """Son N haftalık öğrenme geçmişini getir."""
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import text
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("""
            SELECT id, run_date, week_start, week_end,
                   total_predictions, verified_predictions, direction_correct,
                   direction_accuracy_pct, avg_confidence,
                   recommendations, applied_changes,
                   trend_direction, trend_details
            FROM ml_learning_history
            ORDER BY run_date DESC
            LIMIT :limit
        """), {"limit": limit})
        rows = result.fetchall()
        return [{
            "id": r[0],
            "run_date": r[1].isoformat() if r[1] else None,
            "week_start": str(r[2]),
            "week_end": str(r[3]),
            "total_predictions": r[4],
            "verified_predictions": r[5],
            "direction_correct": r[6],
            "direction_accuracy_pct": float(r[7]) if r[7] else 0,
            "avg_confidence": float(r[8]) if r[8] else 0,
            "recommendations": r[9] if isinstance(r[9], dict) else json.loads(r[9] or "{}"),
            "applied_changes": r[10] if isinstance(r[10], dict) else json.loads(r[10] or "{}"),
            "trend_direction": r[11],
            "trend_details": r[12] if isinstance(r[12], dict) else json.loads(r[12] or "{}"),
        } for r in rows]


# ═══════════════════════════════════════════════════════
#  2) Ana Analiz Motoru
# ═══════════════════════════════════════════════════════

class WeeklyLearner:
    """
    Haftalık öz-öğrenme motoru.
    
    Her Cuma 18:00'den sonra çalışır:
      1. Doğrulanmış tahminleri analiz et
      2. İndikatör performansını hesapla  
      3. Confidence-accuracy ilişkisini ölç
      4. Model parametrelerini optimize et
      5. Sonuçları kaydet ve trendi takip et
    
    PRENSİP: Muhafazakâr değişiklik — veriye dayalı, kademeli iyileştirme.
    Her değişiklik en az 20 veri noktası ile desteklenmeli.
    Tek seferde max %10 parametre değişikliği (aşırı salınım önleme).
    """
    
    # Minimum veri noktası — bunun altında değişiklik yapılmaz
    MIN_SAMPLES_FOR_CHANGE = 20
    
    # Max parametre değişiklik oranı (tek seferde)
    MAX_CHANGE_RATE = 0.10  # %10
    
    # Confidence zone sınırları
    CONFIDENCE_ZONES = [
        (0.0, 0.40, "çok_düşük"),
        (0.40, 0.45, "düşük"),
        (0.45, 0.50, "orta"),
        (0.50, 0.55, "iyi"),
        (0.55, 0.60, "yüksek"),
        (0.60, 1.0, "çok_yüksek"),
    ]
    
    # RSI zone sınırları (analiz sonuçlarına göre)
    RSI_ZONES = [
        (0, 25, "aşırı_satım"),
        (25, 40, "düşük"),
        (40, 60, "optimal"),
        (60, 75, "yüksek"),
        (75, 100, "aşırı_alım"),
    ]
    
    def __init__(self):
        self._last_result: Optional[dict] = None
        self._is_running: bool = False
    
    async def run_weekly_analysis(self, week_start: str = None, week_end: str = None) -> dict:
        """
        Ana haftalık analiz döngüsü.
        
        Args:
            week_start: Analiz başlangıç tarihi (YYYY-MM-DD). None → son 7 gün.
            week_end: Analiz bitiş tarihi (YYYY-MM-DD). None → bugün.
        
        Returns:
            Analiz sonucu dict (DB'ye de kaydedilir)
        """
        if self._is_running:
            return {"error": "Haftalık analiz zaten çalışıyor"}
        
        self._is_running = True
        try:
            now = datetime.now(TZ_TR)
            
            # Tarih aralığı
            if week_end:
                end_date = datetime.strptime(week_end, "%Y-%m-%d").date()
            else:
                end_date = now.date()
            
            if week_start:
                start_date = datetime.strptime(week_start, "%Y-%m-%d").date()
            else:
                start_date = end_date - timedelta(days=7)
            
            logger.info(f"🧠 Haftalık öğrenme başlıyor: {start_date} → {end_date}")
            
            # 1. Doğrulanmış tahminleri çek
            predictions = await self._fetch_verified_predictions(start_date, end_date)
            
            if not predictions:
                logger.warning("Bu hafta doğrulanmış tahmin bulunamadı — tüm geçmiş kullanılacak")
                predictions = await self._fetch_all_verified_predictions()
            
            if not predictions:
                result = {
                    "week_start": str(start_date),
                    "week_end": str(end_date),
                    "total_predictions": 0,
                    "verified_predictions": 0,
                    "error": "Analiz için yeterli doğrulanmış tahmin yok",
                    "trend_direction": "STABLE",
                }
                await save_learning_result(result)
                return result
            
            logger.info(f"📊 {len(predictions)} doğrulanmış tahmin bulundu")
            
            # 2. Genel istatistikler
            general_stats = self._compute_general_stats(predictions)
            
            # 3. İndikatör bazlı analiz
            indicator_analysis = self._analyze_indicators(predictions)
            
            # 4. Confidence zone analizi
            confidence_zones = self._analyze_confidence_zones(predictions)
            
            # 5. Sinyal performans analizi
            signal_analysis = self._analyze_signals(predictions)
            
            # 6. Model bazlı analiz
            model_scores = self._analyze_models(predictions)
            
            # 7. Önceki haftalarla trend karşılaştırması
            trend = await self._compute_trend(general_stats)
            
            # 8. Öneriler oluştur
            recommendations = self._generate_recommendations(
                general_stats, indicator_analysis, confidence_zones, signal_analysis, model_scores
            )
            
            # 9. Otomatik ayar değişiklikleri (muhafazakâr)
            applied_changes = await self._apply_safe_changes(recommendations, general_stats)
            
            # 10. Sonucu derle
            result = {
                "week_start": str(start_date),
                "week_end": str(end_date),
                "total_predictions": general_stats["total"],
                "verified_predictions": general_stats["verified"],
                "direction_correct": general_stats["direction_correct"],
                "direction_accuracy_pct": general_stats["direction_accuracy_pct"],
                "avg_confidence": general_stats["avg_confidence"],
                "avg_price_error_pct": general_stats.get("avg_price_error_pct", 0),
                "model_scores": model_scores,
                "indicator_analysis": indicator_analysis,
                "confidence_zones": confidence_zones,
                "signal_analysis": signal_analysis,
                "recommendations": recommendations,
                "applied_changes": applied_changes,
                "trend_direction": trend["direction"],
                "trend_details": trend,
                "full_report": {
                    "general": general_stats,
                    "indicators": indicator_analysis,
                    "confidence": confidence_zones,
                    "signals": signal_analysis,
                    "models": model_scores,
                    "trend": trend,
                },
            }
            
            # 11. Veritabanına kaydet
            await save_learning_result(result)
            
            self._last_result = result
            logger.info(
                f"🧠 Haftalık öğrenme tamamlandı: "
                f"{general_stats['verified']} tahmin, "
                f"%{general_stats['direction_accuracy_pct']:.1f} doğruluk, "
                f"trend: {trend['direction']}"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Haftalık öğrenme hatası: {e}", exc_info=True)
            return {"error": str(e)}
        finally:
            self._is_running = False
    
    # ─────────────────────────────────────────────
    # Veri Çekme
    # ─────────────────────────────────────────────
    
    async def _fetch_verified_predictions(self, start_date, end_date) -> list[dict]:
        """Belirli tarih aralığındaki doğrulanmış tahminleri çek."""
        from app.core.database import AsyncSessionLocal
        from sqlalchemy import text
        from datetime import date as dtdate
        # asyncpg parametreleri Python date objesi olarak bekler
        if isinstance(start_date, str):
            start_date = dtdate.fromisoformat(start_date)
        if isinstance(end_date, str):
            end_date = dtdate.fromisoformat(end_date)
        # end_date + 1 gün → Python tarafında hesapla
        end_date_plus1 = end_date + timedelta(days=1)
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("""
                SELECT symbol, current_price, predicted_price, signal, confidence,
                       actual_price, is_direction_correct, price_error_pct,
                       raw_response, forecasted_at, risk_signal
                FROM stock_forecasts
                WHERE verified = TRUE
                  AND forecasted_at >= :start_date
                  AND forecasted_at < :end_date_plus1
                ORDER BY forecasted_at DESC
            """), {"start_date": start_date, "end_date_plus1": end_date_plus1})
            rows = result.fetchall()
            return [self._row_to_dict(r) for r in rows]
    
    async def _fetch_all_verified_predictions(self) -> list[dict]:
        """Tüm doğrulanmış tahminleri çek (tarih filtresi olmadan)."""
        from app.core.database import AsyncSessionLocal
        from sqlalchemy import text
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("""
                SELECT symbol, current_price, predicted_price, signal, confidence,
                       actual_price, is_direction_correct, price_error_pct,
                       raw_response, forecasted_at, risk_signal
                FROM stock_forecasts
                WHERE verified = TRUE
                ORDER BY forecasted_at DESC
            """))
            rows = result.fetchall()
            return [self._row_to_dict(r) for r in rows]
    
    @staticmethod
    def _row_to_dict(row) -> dict:
        """DB satırını dict'e çevir."""
        raw = row[8] if row[8] else {}
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except:
                raw = {}
        return {
            "symbol": row[0],
            "current_price": float(row[1]) if row[1] else 0,
            "predicted_price": float(row[2]) if row[2] else 0,
            "signal": row[3],
            "confidence": float(row[4]) if row[4] else 0,
            "actual_price": float(row[5]) if row[5] else None,
            "is_direction_correct": row[6],
            "price_error_pct": float(row[7]) if row[7] else None,
            "raw_response": raw,
            "forecasted_at": row[9].isoformat() if row[9] else None,
            "risk_signal": row[10],
        }
    
    # ─────────────────────────────────────────────
    # Analiz Fonksiyonları
    # ─────────────────────────────────────────────
    
    def _compute_general_stats(self, predictions: list[dict]) -> dict:
        """Genel doğruluk istatistikleri."""
        total = len(predictions)
        verified = sum(1 for p in predictions if p["is_direction_correct"] is not None)
        correct = sum(1 for p in predictions if p["is_direction_correct"] is True)
        
        confidences = [p["confidence"] for p in predictions if p["confidence"]]
        price_errors = [abs(p["price_error_pct"]) for p in predictions if p["price_error_pct"] is not None]
        
        return {
            "total": total,
            "verified": verified,
            "direction_correct": correct,
            "direction_accuracy_pct": round(correct / verified * 100, 2) if verified > 0 else 0,
            "avg_confidence": round(sum(confidences) / len(confidences), 4) if confidences else 0,
            "avg_price_error_pct": round(sum(price_errors) / len(price_errors), 2) if price_errors else 0,
            "min_confidence": round(min(confidences), 4) if confidences else 0,
            "max_confidence": round(max(confidences), 4) if confidences else 0,
        }
    
    def _analyze_indicators(self, predictions: list[dict]) -> dict:
        """İndikatör bazlı doğruluk analizi — raw_response'daki feature değerlerini kullanır."""
        analysis = {}
        
        # RSI zone analizi
        rsi_results = {}
        for zone_min, zone_max, zone_name in self.RSI_ZONES:
            zone_preds = [
                p for p in predictions
                if p["raw_response"].get("rsi") is not None
                and zone_min <= p["raw_response"]["rsi"] < zone_max
            ]
            if zone_preds:
                correct = sum(1 for p in zone_preds if p["is_direction_correct"])
                rsi_results[zone_name] = {
                    "count": len(zone_preds),
                    "correct": correct,
                    "accuracy_pct": round(correct / len(zone_preds) * 100, 2),
                }
        analysis["rsi_zones"] = rsi_results
        
        # MACD yön analizi
        macd_pos = [p for p in predictions if (p["raw_response"].get("macd_histogram") or 0) > 0]
        macd_neg = [p for p in predictions if (p["raw_response"].get("macd_histogram") or 0) <= 0]
        analysis["macd"] = {
            "positive": {
                "count": len(macd_pos),
                "correct": sum(1 for p in macd_pos if p["is_direction_correct"]),
                "accuracy_pct": round(
                    sum(1 for p in macd_pos if p["is_direction_correct"]) / len(macd_pos) * 100, 2
                ) if macd_pos else 0,
            },
            "negative": {
                "count": len(macd_neg),
                "correct": sum(1 for p in macd_neg if p["is_direction_correct"]),
                "accuracy_pct": round(
                    sum(1 for p in macd_neg if p["is_direction_correct"]) / len(macd_neg) * 100, 2
                ) if macd_neg else 0,
            },
        }
        
        # Stochastic zone
        stoch_zones = [(0, 20, "oversold"), (20, 40, "low"), (40, 60, "mid"), (60, 80, "high"), (80, 100, "overbought")]
        stoch_results = {}
        for smin, smax, sname in stoch_zones:
            zone_preds = [
                p for p in predictions
                if p["raw_response"].get("stochastic_k") is not None
                and smin <= p["raw_response"]["stochastic_k"] < smax
            ]
            if zone_preds:
                correct = sum(1 for p in zone_preds if p["is_direction_correct"])
                stoch_results[sname] = {
                    "count": len(zone_preds),
                    "correct": correct,
                    "accuracy_pct": round(correct / len(zone_preds) * 100, 2),
                }
        analysis["stochastic_zones"] = stoch_results
        
        # Bollinger %B zone
        bb_zones = [(0, 0.2, "alt"), (0.2, 0.5, "orta_alt"), (0.5, 0.8, "orta_üst"), (0.8, 1.5, "üst")]
        bb_results = {}
        for bmin, bmax, bname in bb_zones:
            zone_preds = [
                p for p in predictions
                if p["raw_response"].get("bollinger_pctb") is not None
                and bmin <= p["raw_response"]["bollinger_pctb"] < bmax
            ]
            if zone_preds:
                correct = sum(1 for p in zone_preds if p["is_direction_correct"])
                bb_results[bname] = {
                    "count": len(zone_preds),
                    "correct": correct,
                    "accuracy_pct": round(correct / len(zone_preds) * 100, 2),
                }
        analysis["bollinger_zones"] = bb_results
        
        # ADX zone
        adx_zones = [(0, 15, "trend_yok"), (15, 25, "zayıf"), (25, 40, "orta"), (40, 100, "güçlü")]
        adx_results = {}
        for amin, amax, aname in adx_zones:
            zone_preds = [
                p for p in predictions
                if p["raw_response"].get("adx") is not None
                and amin <= p["raw_response"]["adx"] < amax
            ]
            if zone_preds:
                correct = sum(1 for p in zone_preds if p["is_direction_correct"])
                adx_results[aname] = {
                    "count": len(zone_preds),
                    "correct": correct,
                    "accuracy_pct": round(correct / len(zone_preds) * 100, 2),
                }
        analysis["adx_zones"] = adx_results
        
        # Market rejim analizi
        regime_results = {}
        for regime in ["BULL", "SIDEWAYS", "BEAR"]:
            regime_preds = [p for p in predictions if p["raw_response"].get("market_regime") == regime]
            if regime_preds:
                correct = sum(1 for p in regime_preds if p["is_direction_correct"])
                regime_results[regime] = {
                    "count": len(regime_preds),
                    "correct": correct,
                    "accuracy_pct": round(correct / len(regime_preds) * 100, 2),
                }
        analysis["market_regime"] = regime_results
        
        return analysis
    
    def _analyze_confidence_zones(self, predictions: list[dict]) -> dict:
        """Güven skoru bölgelerine göre doğruluk analizi."""
        results = {}
        for zone_min, zone_max, zone_name in self.CONFIDENCE_ZONES:
            zone_preds = [
                p for p in predictions
                if zone_min <= p["confidence"] < zone_max
            ]
            if zone_preds:
                correct = sum(1 for p in zone_preds if p["is_direction_correct"])
                results[zone_name] = {
                    "range": f"{zone_min:.2f}-{zone_max:.2f}",
                    "count": len(zone_preds),
                    "correct": correct,
                    "accuracy_pct": round(correct / len(zone_preds) * 100, 2),
                }
        return results
    
    def _analyze_signals(self, predictions: list[dict]) -> dict:
        """Sinyal bazlı doğruluk analizi (BUY/SELL/HOLD, risk filtresi etkisi)."""
        results = {}
        
        for signal_type in ["BUY", "SELL", "HOLD"]:
            signal_preds = [p for p in predictions if p["signal"] == signal_type]
            if signal_preds:
                correct = sum(1 for p in signal_preds if p["is_direction_correct"])
                results[signal_type] = {
                    "count": len(signal_preds),
                    "correct": correct,
                    "accuracy_pct": round(correct / len(signal_preds) * 100, 2),
                    "avg_confidence": round(
                        sum(p["confidence"] for p in signal_preds) / len(signal_preds), 4
                    ),
                }
        
        # Risk filtresi analizi
        risk_overridden = [
            p for p in predictions
            if p["signal"] != p.get("risk_signal") and p.get("risk_signal")
        ]
        risk_kept = [
            p for p in predictions
            if p["signal"] == p.get("risk_signal") and p.get("risk_signal")
        ]
        
        results["risk_filter_stats"] = {
            "overridden_count": len(risk_overridden),
            "kept_count": len(risk_kept),
            "overridden_would_have_been_correct": sum(
                1 for p in risk_overridden if p["is_direction_correct"]
            ),
            "kept_correct": sum(1 for p in risk_kept if p["is_direction_correct"]),
        }
        
        return results
    
    def _analyze_models(self, predictions: list[dict]) -> dict:
        """Model bazlı doğruluk karşılaştırması."""
        model_stats = {}
        for p in predictions:
            model_name = p["raw_response"].get("model_name", "Unknown")
            if model_name not in model_stats:
                model_stats[model_name] = {"total": 0, "correct": 0}
            model_stats[model_name]["total"] += 1
            if p["is_direction_correct"]:
                model_stats[model_name]["correct"] += 1
        
        for model, stats in model_stats.items():
            stats["accuracy_pct"] = round(
                stats["correct"] / stats["total"] * 100, 2
            ) if stats["total"] > 0 else 0
        
        return model_stats
    
    # ─────────────────────────────────────────────
    # Trend Analizi
    # ─────────────────────────────────────────────
    
    async def _compute_trend(self, current_stats: dict) -> dict:
        """Önceki haftalara kıyasla trend hesapla."""
        history = await get_learning_history(limit=8)
        
        if not history:
            return {
                "direction": "NEW",
                "message": "İlk haftalık analiz — karşılaştırma verisi yok",
                "history_weeks": 0,
                "accuracy_trend": [],
            }
        
        # Doğruluk trendi
        accuracy_series = [
            {"week": h["week_start"], "accuracy": h["direction_accuracy_pct"]}
            for h in reversed(history)
            if h["direction_accuracy_pct"] > 0
        ]
        accuracy_series.append({
            "week": "current",
            "accuracy": current_stats["direction_accuracy_pct"],
        })
        
        # Son 4 haftayı değerlendir
        recent_accuracies = [a["accuracy"] for a in accuracy_series[-4:]]
        
        if len(recent_accuracies) < 2:
            direction = "NEW"
            message = "Yeterli geçmiş verisi yok"
        else:
            # Basit lineer trend
            avg_first_half = sum(recent_accuracies[:len(recent_accuracies)//2]) / (len(recent_accuracies)//2)
            avg_second_half = sum(recent_accuracies[len(recent_accuracies)//2:]) / (len(recent_accuracies) - len(recent_accuracies)//2)
            
            diff = avg_second_half - avg_first_half
            
            if diff > 2.0:
                direction = "UP"
                message = f"Doğruluk yükseliyor (+{diff:.1f}pp) — sistem iyileşiyor ✅"
            elif diff < -2.0:
                direction = "DOWN"
                message = f"Doğruluk düşüyor ({diff:.1f}pp) — dikkat gerekli ⚠️"
            else:
                direction = "STABLE"
                message = f"Doğruluk stabil ({diff:+.1f}pp)"
        
        return {
            "direction": direction,
            "message": message,
            "history_weeks": len(history),
            "accuracy_trend": accuracy_series,
            "current_accuracy": current_stats["direction_accuracy_pct"],
            "previous_accuracy": history[0]["direction_accuracy_pct"] if history else None,
        }
    
    # ─────────────────────────────────────────────
    # Öneriler & Otomatik Ayarlama
    # ─────────────────────────────────────────────
    
    def _generate_recommendations(
        self, general: dict, indicators: dict, confidence: dict,
        signals: dict, models: dict,
    ) -> dict:
        """
        Veriye dayalı öneri üret.
        
        Prensip:
          - En az MIN_SAMPLES_FOR_CHANGE veri noktası ile desteklenmeli
          - Tek seferde max MAX_CHANGE_RATE oranında değişiklik
          - "Kendini ispatlamış ve stabil" olanlar öncelikli
        """
        recs = {
            "confidence_threshold": None,
            "risk_thresholds": None,
            "indicator_notes": [],
            "model_notes": [],
            "general_notes": [],
        }
        
        # ── Confidence eşiği önerisi ──
        # En yüksek doğruluğu veren confidence bölgesini bul
        best_conf_zone = None
        best_conf_acc = 0
        for zone_name, zone_data in confidence.items():
            if zone_data["count"] >= self.MIN_SAMPLES_FOR_CHANGE and zone_data["accuracy_pct"] > best_conf_acc:
                best_conf_acc = zone_data["accuracy_pct"]
                best_conf_zone = zone_name
        
        if best_conf_zone:
            # Eşiği en iyi bölgenin alt sınırına ayarla önerisi
            zone_info = confidence[best_conf_zone]
            recs["confidence_threshold"] = {
                "current_best_zone": best_conf_zone,
                "best_accuracy": best_conf_acc,
                "sample_count": zone_info["count"],
                "range": zone_info["range"],
                "suggestion": f"{best_conf_zone} bölgesi en iyi (%{best_conf_acc:.1f}), eşik bu aralığa ayarlanabilir",
            }
        
        # ── İndikatör önerileri ──
        # RSI — en iyi bölge
        rsi_zones = indicators.get("rsi_zones", {})
        best_rsi = max(rsi_zones.items(), key=lambda x: x[1]["accuracy_pct"]) if rsi_zones else None
        if best_rsi and best_rsi[1]["count"] >= 10:
            recs["indicator_notes"].append({
                "indicator": "RSI",
                "finding": f"En iyi bölge: {best_rsi[0]} (%{best_rsi[1]['accuracy_pct']:.1f}, n={best_rsi[1]['count']})",
                "action": "RSI zone filter güncelle" if best_rsi[0] != "optimal" else "Mevcut RSI filtresi doğru ✅",
            })
        
        # ADX — trend gücü
        adx_zones = indicators.get("adx_zones", {})
        if adx_zones:
            no_trend = adx_zones.get("trend_yok", {})
            with_trend = {k: v for k, v in adx_zones.items() if k != "trend_yok"}
            if no_trend and with_trend:
                no_trend_acc = no_trend.get("accuracy_pct", 0)
                with_trend_acc = sum(v["accuracy_pct"] * v["count"] for v in with_trend.values()) / sum(v["count"] for v in with_trend.values())
                recs["indicator_notes"].append({
                    "indicator": "ADX",
                    "finding": f"Trend var: %{with_trend_acc:.1f} vs Trend yok: %{no_trend_acc:.1f}",
                    "action": "ADX filtresi doğru ✅" if with_trend_acc > no_trend_acc else "ADX filtresi gözden geçirilmeli",
                })
        
        # ── Model önerileri ──
        for model_name, stats in models.items():
            if stats["total"] >= 10:
                recs["model_notes"].append({
                    "model": model_name,
                    "accuracy": stats["accuracy_pct"],
                    "count": stats["total"],
                    "note": "İyi performans ✅" if stats["accuracy_pct"] > general["direction_accuracy_pct"] else "Ortalamanın altında ⚠️",
                })
        
        # ── Genel notlar ──
        if general["direction_accuracy_pct"] < 15:
            recs["general_notes"].append("⚠️ Genel doğruluk çok düşük — model parametreleri gözden geçirilmeli")
        elif general["direction_accuracy_pct"] > 50:
            recs["general_notes"].append("✅ İyi doğruluk — mevcut parametreler korunmalı")
        
        # Risk filtresi analizi
        risk_stats = signals.get("risk_filter_stats", {})
        if risk_stats.get("overridden_count", 0) > 0:
            override_would_correct = risk_stats.get("overridden_would_have_been_correct", 0)
            override_total = risk_stats["overridden_count"]
            override_acc = round(override_would_correct / override_total * 100, 1) if override_total > 0 else 0
            if override_acc > general["direction_accuracy_pct"] + 5:
                recs["general_notes"].append(
                    f"⚠️ Risk filtresi {override_total} sinyali engelledi ama bunların %{override_acc}'i doğruydu — "
                    f"risk eşiği düşürülebilir"
                )
            else:
                recs["general_notes"].append(
                    f"✅ Risk filtresi {override_total} sinyali engelledi — engellenenler zaten düşük doğrulukta (%{override_acc})"
                )
        
        return recs
    
    async def _apply_safe_changes(self, recommendations: dict, general_stats: dict) -> dict:
        """
        Muhafazakâr otomatik ayar değişiklikleri uygula.
        
        KURALLAR:
          1. En az MIN_SAMPLES_FOR_CHANGE doğrulanmış tahmin gerekli
          2. Tek seferde max MAX_CHANGE_RATE oranında değişiklik
          3. Sadece güçlü kanıtla değişiklik (doğruluk farkı > 5pp)
          4. Her değişiklik loglanır ve geri alınabilir
        """
        changes = {}
        
        if general_stats["verified"] < self.MIN_SAMPLES_FOR_CHANGE:
            changes["skipped"] = True
            changes["reason"] = (
                f"Yetersiz veri: {general_stats['verified']} doğrulanmış tahmin "
                f"(min: {self.MIN_SAMPLES_FOR_CHANGE})"
            )
            return changes
        
        # Mevcut model config'i yükle
        current_config = await get_active_model_config()
        if not current_config:
            # Varsayılan config'i kaydet
            current_config = {
                "confidence_threshold": 0.45,
                "risk_base_normal": 0.40,
                "risk_base_mid": 0.45,
                "risk_base_high": 0.50,
                "risk_base_extreme": 0.55,
                "min_confirmations": 2,
                "adx_min_threshold": 15.0,
                "confidence_r2_weight": 0.15,
                "confidence_dir_weight": 0.85,
                "rf_params": {},
                "xgb_params": {},
                "active_features": [],
            }
            await save_model_config(current_config, "Başlangıç konfigürasyonu")
        
        new_config = dict(current_config)
        change_reasons = []
        
        # ── Confidence eşiği ayarlama ──
        conf_rec = recommendations.get("confidence_threshold")
        if conf_rec and conf_rec.get("sample_count", 0) >= self.MIN_SAMPLES_FOR_CHANGE:
            best_range = conf_rec["range"]
            try:
                lower_bound = float(best_range.split("-")[0])
                # Mevcut eşikten max %10 sapmaya izin ver
                current_threshold = current_config.get("confidence_threshold", 0.45)
                target = lower_bound
                max_delta = current_threshold * self.MAX_CHANGE_RATE
                
                if abs(target - current_threshold) <= max_delta:
                    new_config["confidence_threshold"] = round(target, 4)
                else:
                    # Kademeli yaklaş
                    direction = 1 if target > current_threshold else -1
                    new_config["confidence_threshold"] = round(current_threshold + direction * max_delta, 4)
                
                if new_config["confidence_threshold"] != current_threshold:
                    change_reasons.append(
                        f"Confidence eşiği: {current_threshold} → {new_config['confidence_threshold']} "
                        f"(en iyi bölge: {conf_rec['current_best_zone']} %{conf_rec['best_accuracy']:.1f})"
                    )
            except:
                pass
        
        # ── Değişiklik varsa yeni config kaydet ──
        if change_reasons:
            reason = " | ".join(change_reasons)
            version = await save_model_config(new_config, reason)
            changes["applied"] = True
            changes["new_version"] = version
            changes["changes"] = change_reasons
            changes["old_config_version"] = current_config.get("config_version", 0)
            logger.info(f"🔧 Model config güncellendi v{version}: {reason}")
        else:
            changes["applied"] = False
            changes["reason"] = "Değişiklik gerekmiyor — mevcut config optimal veya yetersiz kanıt"
        
        return changes
    
    def status(self) -> dict:
        """Mevcut öğrenme durumu."""
        return {
            "is_running": self._is_running,
            "last_result": self._last_result,
        }


# ═══════════════════════════════════════════════════════
#  3) Zamanlayıcı — Cuma 18:05 Otomatik Çalıştırma 
# ═══════════════════════════════════════════════════════

class WeeklyLearnerScheduler:
    """
    Haftalık öğrenme zamanlayıcısı.
    
    Her Cuma 18:05 (Türkiye saati) otomatik çalışır.
    main.py startup'ında başlatılır.
    
    ZAMANLAMA:
      - Cuma 18:05: Borsa 18:00'de kapanır → 5 dk bekle → analiz başla
      - Eğer uygulama Cuma 18:05'ten sonra başlatılırsa, hemen çalışır
      - Manuel tetikleme: /api/ml/weekly-learn endpoint'i
    
    GELİŞTİRMEYE AÇIK ALANLAR:
      ┌─────────────────────────────────────────────────────────────────┐
      │ 🔮 GELECEK PLANLAR (v3+):                                     │
      │                                                                │
      │ 1. Feature Discovery: Yeni indikatör adaylarını otomatik test │
      │    - CCI, Williams %R, Ichimoku gibi henüz kullanılmayan      │
      │    - Backtest ile performans ölçümü                            │
      │                                                                │
      │ 2. Hyperparameter Optimization: Bayesian/Grid search           │
      │    - RF/XGB hiperparametrelerini otomatik tune                 │
      │    - Walk-forward validation ile overfit kontrolü              │
      │                                                                │
      │ 3. Ensemble Weight Tuning: Model ağırlıklarını dinamik ayarlama│
      │    - Hangi model hangi piyasa koşulunda iyi → ağırlık artır   │
      │                                                                │
      │ 4. Sentiment Integration: Haber/sosyal medya verisi           │
      │    - KAP bildirimleri, Twitter sentiment                       │
      │    - Yeni feature olarak modele ekleme                         │
      │                                                                │
      │ 5. Adaptive Feature Selection: Haftalık feature importance     │
      │    - Düşen featureları otomatik çıkar, yükselen ekle          │
      │    - SHAP value analizi ile karar                              │
      │                                                                │
      │ 6. Regime-Specific Models: Piyasa rejimine özel model seçimi  │
      │    - BULL/BEAR/SIDEWAYS için ayrı model parametre setleri     │
      │                                                                │
      │ 7. Risk Engine Self-Tuning: Risk parametreleri otomatik ayar  │
      │    - Hangi risk filtreleri doğru engellemiş → ağırlık artır   │
      │    - Yanlış engellemeleri tespit et → eşik düşür              │
      │                                                                │
      │ AMAÇ: Sürekli yukarı ivmeli doğru tahmin oranı sağlamak.     │
      │ Her hafta bir önceki haftadan daha iyi olmak.                 │
      └─────────────────────────────────────────────────────────────────┘
    """
    
    def __init__(self):
        self.learner = WeeklyLearner()
        self._task: Optional[asyncio.Task] = None
        self._enabled: bool = True
        self._last_run_at: Optional[datetime] = None
        self._next_run_at: Optional[datetime] = None
    
    def start(self):
        """Zamanlayıcıyı başlat (main.py startup'ında çağrılır)."""
        if self._task and not self._task.done():
            self._task.cancel()
        
        async def scheduler_loop():
            try:
                while self._enabled:
                    now = datetime.now(TZ_TR)
                    
                    # Sonraki Cuma 18:05'i hesapla
                    next_friday = self._next_friday_1805(now)
                    self._next_run_at = next_friday
                    
                    wait_seconds = (next_friday - now).total_seconds()
                    
                    if wait_seconds <= 0:
                        # Zaten geçmiş — hemen çalıştır
                        logger.info("🧠 Haftalık öğrenme zamanı geldi — başlatılıyor")
                        await self._run()
                        # Sonraki haftayı hesapla
                        await asyncio.sleep(60)  # 1dk bekle döngü koruma
                        continue
                    
                    logger.info(
                        f"🧠 Haftalık öğrenme zamanlayıcısı aktif — "
                        f"Sonraki çalışma: {next_friday.strftime('%Y-%m-%d %H:%M')} "
                        f"({wait_seconds/3600:.1f} saat sonra)"
                    )
                    
                    await asyncio.sleep(wait_seconds)
                    await self._run()
                    
            except asyncio.CancelledError:
                logger.info("Haftalık öğrenme zamanlayıcısı durduruldu")
                return
            except Exception as e:
                logger.error(f"Haftalık öğrenme zamanlayıcısı hatası: {e}", exc_info=True)
        
        self._task = asyncio.create_task(scheduler_loop())
        logger.info("🧠 Haftalık Öz-Öğrenme Zamanlayıcısı başlatıldı (Cuma 18:05 TR)")
    
    def stop(self):
        """Zamanlayıcıyı durdur."""
        self._enabled = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("Haftalık öğrenme zamanlayıcısı durduruldu")
    
    async def _run(self):
        """Öğrenme döngüsünü çalıştır."""
        self._last_run_at = datetime.now(TZ_TR)
        try:
            result = await self.learner.run_weekly_analysis()
            if result.get("error"):
                logger.warning(f"Haftalık öğrenme uyarı: {result['error']}")
            else:
                logger.info(
                    f"🧠 Haftalık öğrenme tamamlandı: "
                    f"%{result.get('direction_accuracy_pct', 0):.1f} doğruluk, "
                    f"trend: {result.get('trend_direction', 'N/A')}"
                )
        except Exception as e:
            logger.error(f"Haftalık öğrenme çalıştırma hatası: {e}", exc_info=True)
    
    async def run_now(self, week_start: str = None, week_end: str = None) -> dict:
        """Manuel tetikleme — API endpoint'inden çağrılır."""
        return await self.learner.run_weekly_analysis(week_start, week_end)
    
    @staticmethod
    def _next_friday_1805(now: datetime) -> datetime:
        """Sonraki Cuma 18:05'i hesapla."""
        # Bugün Cuma mı ve saat 18:05'ten önce mi?
        days_until_friday = (4 - now.weekday()) % 7
        
        if days_until_friday == 0:
            # Bugün Cuma
            target = now.replace(hour=18, minute=5, second=0, microsecond=0)
            if now >= target:
                # Bugünkü zaman geçmiş — gelecek Cuma
                days_until_friday = 7
            else:
                return target
        
        next_fri = now + timedelta(days=days_until_friday)
        return next_fri.replace(hour=18, minute=5, second=0, microsecond=0)
    
    def status(self) -> dict:
        """Zamanlayıcı durumu."""
        return {
            "enabled": self._enabled,
            "last_run_at": self._last_run_at.isoformat() if self._last_run_at else None,
            "next_run_at": self._next_run_at.isoformat() if self._next_run_at else None,
            "learner_status": self.learner.status(),
        }


# Singleton instance
weekly_learner_scheduler = WeeklyLearnerScheduler()
