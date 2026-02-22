-- =====================================================
-- BIST AI Trading — İşlem Merkezi V2 Migration
-- Gelişmiş emir türleri, koşullu emirler, spread/slippage,
-- strateji seçimi, detaylı P&L takibi
-- =====================================================

-- 1) orders tablosuna yeni kolonlar ekle
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS order_type VARCHAR(20) NOT NULL DEFAULT 'market'
        CHECK (order_type IN ('market', 'limit', 'stop_loss', 'take_profit', 'trailing_stop')),
    ADD COLUMN IF NOT EXISTS trigger_price NUMERIC(12,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS stop_price NUMERIC(12,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS take_profit_price NUMERIC(12,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS trailing_stop_pct NUMERIC(5,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS spread NUMERIC(12,4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS slippage NUMERIC(12,4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS slippage_pct NUMERIC(8,4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS strategy_type VARCHAR(20) DEFAULT 'manual'
        CHECK (strategy_type IN ('manual', 'ai_only', 'indicator', 'hybrid')),
    ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(5,4) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ai_signal VARCHAR(10) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS indicators_snapshot JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pnl NUMERIC(14,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS pnl_pct NUMERIC(8,4) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS user_id BIGINT DEFAULT NULL;

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders (order_type);
CREATE INDEX IF NOT EXISTS idx_orders_strategy ON orders (strategy_type);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id);

-- 2) Koşullu Emirler tablosu (bekleyen emirler)
CREATE TABLE IF NOT EXISTS conditional_orders (
    id              BIGSERIAL PRIMARY KEY,
    order_ref       VARCHAR(40) NOT NULL UNIQUE DEFAULT ('cond_' || replace(uuid_generate_v4()::text, '-', '')),
    user_id         BIGINT DEFAULT NULL,
    symbol          VARCHAR(10) NOT NULL,
    side            VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    quantity        NUMERIC(14,4) NOT NULL,
    mode            VARCHAR(10) NOT NULL DEFAULT 'paper' CHECK (mode IN ('paper', 'real')),
    order_type      VARCHAR(20) NOT NULL CHECK (order_type IN ('limit', 'stop_loss', 'take_profit', 'trailing_stop')),
    trigger_price   NUMERIC(12,2) DEFAULT NULL,
    limit_price     NUMERIC(12,2) DEFAULT NULL,
    stop_price      NUMERIC(12,2) DEFAULT NULL,
    take_profit_price NUMERIC(12,2) DEFAULT NULL,
    trailing_stop_pct NUMERIC(5,2) DEFAULT NULL,
    current_high    NUMERIC(12,2) DEFAULT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'triggered', 'filled', 'cancelled', 'expired')),
    strategy_type   VARCHAR(20) DEFAULT 'manual',
    notes           TEXT DEFAULT '',
    expires_at      TIMESTAMPTZ DEFAULT NULL,
    triggered_at    TIMESTAMPTZ DEFAULT NULL,
    filled_order_id VARCHAR(40) DEFAULT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cond_orders_symbol ON conditional_orders (symbol);
CREATE INDEX IF NOT EXISTS idx_cond_orders_status ON conditional_orders (status);
CREATE INDEX IF NOT EXISTS idx_cond_orders_user ON conditional_orders (user_id);
CREATE INDEX IF NOT EXISTS idx_cond_orders_date ON conditional_orders (created_at DESC);

-- 3) Trade Pozisyonları (P&L takibi)
CREATE TABLE IF NOT EXISTS trade_positions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT DEFAULT NULL,
    symbol          VARCHAR(10) NOT NULL,
    side            VARCHAR(4) NOT NULL CHECK (side IN ('LONG', 'SHORT')),
    entry_price     NUMERIC(12,2) NOT NULL,
    exit_price      NUMERIC(12,2) DEFAULT NULL,
    quantity        NUMERIC(14,4) NOT NULL,
    mode            VARCHAR(10) NOT NULL DEFAULT 'paper',
    strategy_type   VARCHAR(20) DEFAULT 'manual',
    status          VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'closed', 'partially_closed')),
    pnl             NUMERIC(14,2) DEFAULT NULL,
    pnl_pct         NUMERIC(8,4) DEFAULT NULL,
    entry_order_id  VARCHAR(40) DEFAULT NULL,
    exit_order_id   VARCHAR(40) DEFAULT NULL,
    stop_loss       NUMERIC(12,2) DEFAULT NULL,
    take_profit     NUMERIC(12,2) DEFAULT NULL,
    notes           TEXT DEFAULT '',
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ DEFAULT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_positions_symbol ON trade_positions (symbol);
CREATE INDEX IF NOT EXISTS idx_positions_status ON trade_positions (status);
CREATE INDEX IF NOT EXISTS idx_positions_user ON trade_positions (user_id);

-- 4) Trade İstatistikleri (günlük özet)
CREATE TABLE IF NOT EXISTS trade_stats_daily (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT DEFAULT NULL,
    stat_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    total_trades    INT DEFAULT 0,
    winning_trades  INT DEFAULT 0,
    losing_trades   INT DEFAULT 0,
    total_pnl       NUMERIC(14,2) DEFAULT 0,
    total_volume    NUMERIC(16,2) DEFAULT 0,
    best_trade_pnl  NUMERIC(14,2) DEFAULT 0,
    worst_trade_pnl NUMERIC(14,2) DEFAULT 0,
    avg_slippage    NUMERIC(8,4) DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, stat_date)
);

-- 5) auto_trade_logs tablosuna strategy_type ekle
ALTER TABLE auto_trade_logs
    ADD COLUMN IF NOT EXISTS strategy_type VARCHAR(20) DEFAULT 'ai_only',
    ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(5,4) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS indicators JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS user_id BIGINT DEFAULT NULL;

RAISE NOTICE 'Trading V2 migration tamamlandı.';
