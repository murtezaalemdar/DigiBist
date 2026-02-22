-- =====================================================
-- BIST AI Trading Platform — PostgreSQL Şeması
-- Tüm veriler burada: emirler, tahminler, loglar, hisseler
-- =====================================================

-- Uzantılar
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1) Hisseler (Filament + Backend ortak)
-- =====================================================
CREATE TABLE IF NOT EXISTS stocks (
    id              BIGSERIAL PRIMARY KEY,
    symbol          VARCHAR(10)  NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL DEFAULT '',
    sector          VARCHAR(100) DEFAULT NULL,
    current_price   NUMERIC(12,2) DEFAULT 0,
    change_percent  NUMERIC(8,2) DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_favorite     BOOLEAN NOT NULL DEFAULT FALSE,
    last_synced_at  TIMESTAMPTZ DEFAULT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stocks_symbol   ON stocks (symbol);
CREATE INDEX idx_stocks_active   ON stocks (is_active);

-- =====================================================
-- 2) Hisse Tahminleri (Forecast)
-- =====================================================
CREATE TABLE IF NOT EXISTS stock_forecasts (
    id               BIGSERIAL PRIMARY KEY,
    stock_id         BIGINT REFERENCES stocks(id) ON DELETE CASCADE,
    symbol           VARCHAR(10) NOT NULL,
    current_price    NUMERIC(12,2) NOT NULL,
    predicted_price  NUMERIC(12,2) NOT NULL,
    signal           VARCHAR(10) NOT NULL DEFAULT 'HOLD',
    confidence       NUMERIC(5,4) NOT NULL DEFAULT 0,
    change_percent   NUMERIC(8,2) DEFAULT 0,
    risk_signal      VARCHAR(10) DEFAULT NULL,
    risk_reason      TEXT DEFAULT NULL,
    risk_adjusted    BOOLEAN DEFAULT FALSE,
    model_used       VARCHAR(100) DEFAULT 'RandomForestRegressor',
    raw_response     JSONB DEFAULT NULL,
    forecasted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forecasts_symbol ON stock_forecasts (symbol);
CREATE INDEX idx_forecasts_stock  ON stock_forecasts (stock_id);
CREATE INDEX idx_forecasts_date   ON stock_forecasts (forecasted_at DESC);

-- =====================================================
-- 3) Emirler (Orders)
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
    id                   BIGSERIAL PRIMARY KEY,
    order_id             VARCHAR(40) NOT NULL UNIQUE DEFAULT ('ord_' || replace(uuid_generate_v4()::text, '-', '')),
    symbol               VARCHAR(10) NOT NULL,
    side                 VARCHAR(4)  NOT NULL CHECK (side IN ('BUY','SELL')),
    quantity             NUMERIC(14,4) NOT NULL,
    mode                 VARCHAR(10) NOT NULL DEFAULT 'paper' CHECK (mode IN ('paper','real')),
    requested_price      NUMERIC(12,2) DEFAULT NULL,
    simulated_fill_price NUMERIC(12,2) NOT NULL,
    status               VARCHAR(20) NOT NULL DEFAULT 'filled',
    reason               TEXT DEFAULT '',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_symbol ON orders (symbol);
CREATE INDEX idx_orders_date   ON orders (created_at DESC);
CREATE INDEX idx_orders_status ON orders (status);

-- =====================================================
-- 4) Otomatik Trade Logları
-- =====================================================
CREATE TABLE IF NOT EXISTS auto_trade_logs (
    id         BIGSERIAL PRIMARY KEY,
    symbol     VARCHAR(10) NOT NULL,
    action     VARCHAR(30) NOT NULL,
    reason     TEXT DEFAULT '',
    mode       VARCHAR(10) NOT NULL DEFAULT 'paper',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_atl_symbol ON auto_trade_logs (symbol);
CREATE INDEX idx_atl_date   ON auto_trade_logs (created_at DESC);

-- =====================================================
-- 5) Forecast Cache (in-memory yerine)
-- =====================================================
CREATE TABLE IF NOT EXISTS forecast_cache (
    symbol       VARCHAR(10) PRIMARY KEY,
    data         JSONB NOT NULL,
    cached_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 6) Kullanıcılar (Auth için hazırlık — Filament + API)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    username        VARCHAR(50) UNIQUE,
    email           VARCHAR(255) NOT NULL DEFAULT '',
    email_verified_at TIMESTAMPTZ DEFAULT NULL,
    password        VARCHAR(255) NOT NULL,
    remember_token  VARCHAR(100) DEFAULT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user','viewer')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 7) Laravel gerekli tablolar (sessions, cache, jobs)
-- =====================================================
CREATE TABLE IF NOT EXISTS sessions (
    id          VARCHAR(255) PRIMARY KEY,
    user_id     BIGINT DEFAULT NULL,
    ip_address  VARCHAR(45) DEFAULT NULL,
    user_agent  TEXT DEFAULT NULL,
    payload     TEXT NOT NULL,
    last_activity INT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_last ON sessions (last_activity);

CREATE TABLE IF NOT EXISTS cache (
    key        VARCHAR(255) PRIMARY KEY,
    value      TEXT NOT NULL,
    expiration INT NOT NULL
);

CREATE TABLE IF NOT EXISTS cache_locks (
    key        VARCHAR(255) PRIMARY KEY,
    owner      VARCHAR(255) NOT NULL,
    expiration INT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
    id          BIGSERIAL PRIMARY KEY,
    queue       VARCHAR(255) NOT NULL,
    payload     TEXT NOT NULL,
    attempts    SMALLINT NOT NULL DEFAULT 0,
    reserved_at INT DEFAULT NULL,
    available_at INT NOT NULL,
    created_at  INT NOT NULL
);
CREATE INDEX idx_jobs_queue ON jobs (queue);

CREATE TABLE IF NOT EXISTS failed_jobs (
    id         BIGSERIAL PRIMARY KEY,
    uuid       VARCHAR(255) NOT NULL UNIQUE,
    connection TEXT NOT NULL,
    queue      TEXT NOT NULL,
    payload    TEXT NOT NULL,
    exception  TEXT NOT NULL,
    failed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 8) Laravel Migrations tablosu
-- =====================================================
CREATE TABLE IF NOT EXISTS migrations (
    id        SERIAL PRIMARY KEY,
    migration VARCHAR(255) NOT NULL,
    batch     INT NOT NULL
);

-- =====================================================
-- 9) Varsayılan hisse verileri (Seeder yerine SQL)
-- =====================================================
INSERT INTO stocks (symbol, name, sector, is_active, is_favorite) VALUES
    -- Bankacılık
    ('AKBNK', 'Akbank',               'Bankacılık',    TRUE, FALSE),
    ('GARAN', 'Garanti BBVA Bankası', 'Bankacılık',    TRUE, TRUE),
    ('ISCTR', 'İş Bankası C',         'Bankacılık',    TRUE, FALSE),
    ('YKBNK', 'Yapı Kredi Bankası',   'Bankacılık',    TRUE, FALSE),
    ('HALKB', 'Halkbank',             'Bankacılık',    TRUE, FALSE),
    ('VAKBN', 'Vakıfbank',            'Bankacılık',    TRUE, FALSE),
    ('SKBNK', 'Şekerbank',            'Bankacılık',    TRUE, FALSE),
    ('ALBRK', 'Albaraka Türk',        'Bankacılık',    TRUE, FALSE),
    ('TSKB',  'TSKB',                 'Bankacılık',    TRUE, FALSE),
    -- Holding
    ('SAHOL', 'Sabancı Holding',      'Holding',       TRUE, FALSE),
    ('KCHOL', 'Koç Holding',          'Holding',       TRUE, FALSE),
    ('DOHOL', 'Doğan Holding',        'Holding',       TRUE, FALSE),
    ('SOHOL', 'Sönmez Holding',       'Holding',       TRUE, FALSE),
    ('TAVHL', 'TAV Havalimanları',    'Holding',       TRUE, FALSE),
    -- Ulaştırma / Havacılık
    ('THYAO', 'Türk Hava Yolları',    'Havacılık',     TRUE, TRUE),
    ('PGSUS', 'Pegasus Hava Yolları', 'Havacılık',     TRUE, TRUE),
    ('CLEBI', 'Çelebi Havacılık',     'Havacılık',     TRUE, FALSE),
    -- Metal / Demir Çelik
    ('EREGL', 'Ereğli Demir Çelik',   'Demir Çelik',   TRUE, FALSE),
    ('KRDMD', 'Kardemir D',           'Demir Çelik',   TRUE, FALSE),
    ('ISDMR', 'İskenderun Demir',     'Demir Çelik',   TRUE, FALSE),
    -- Savunma / Teknoloji
    ('ASELS', 'ASELSAN',              'Savunma',       TRUE, TRUE),
    ('HAVELSAN', 'HAVELSAN',          'Savunma',       TRUE, FALSE),
    -- Otomotiv
    ('TOASO', 'Tofaş Otomobil',       'Otomotiv',      TRUE, FALSE),
    ('FROTO', 'Ford Otosan',           'Otomotiv',      TRUE, TRUE),
    ('DOAS',  'Doğuş Otomotiv',       'Otomotiv',      TRUE, FALSE),
    ('OTKAR', 'Otokar',               'Otomotiv',      TRUE, FALSE),
    -- Enerji
    ('TUPRS', 'Tüpraş',               'Enerji',        TRUE, FALSE),
    ('AYGAZ', 'Aygaz',                'Enerji',        TRUE, FALSE),
    ('AKSEN', 'Aksa Enerji',          'Enerji',        TRUE, FALSE),
    ('ODAS',  'Odaş Elektrik',        'Enerji',        TRUE, FALSE),
    ('ENKAI', 'Enka İnşaat',          'Enerji',        TRUE, FALSE),
    -- Perakende / Gıda
    ('BIMAS', 'BİM Mağazalar',        'Perakende',     TRUE, FALSE),
    ('MGROS', 'Migros',               'Perakende',     TRUE, FALSE),
    ('SOKM',  'Şok Marketler',        'Perakende',     TRUE, FALSE),
    ('ULKER', 'Ülker Bisküvi',        'Gıda',          TRUE, FALSE),
    ('BANVT', 'Banvit',               'Gıda',          TRUE, FALSE),
    ('TATGD', 'Tat Gıda',             'Gıda',          TRUE, FALSE),
    -- Telekomünikasyon
    ('TCELL', 'Turkcell',             'Telekomünikasyon', TRUE, FALSE),
    ('TTKOM', 'Türk Telekom',         'Telekomünikasyon', TRUE, FALSE),
    -- Cam / Seramik
    ('SISE',  'Şişecam',              'Cam',           TRUE, FALSE),
    ('TRKCM', 'Trakya Cam',           'Cam',           TRUE, FALSE),
    ('KUTPO', 'Kütahya Porselen',     'Seramik',       TRUE, FALSE),
    -- Kimya / Petrokimya
    ('PETKM', 'Petkim',               'Petrokimya',    TRUE, FALSE),
    ('HEKTS', 'Hektaş',               'Kimya',         TRUE, FALSE),
    ('GUBRF', 'Gübre Fabrikaları',    'Kimya',         TRUE, FALSE),
    ('BAGFS', 'Bandırma Gübre',       'Kimya',         TRUE, FALSE),
    -- GYO / İnşaat
    ('EKGYO', 'Emlak Konut GYO',      'GYO',           TRUE, FALSE),
    ('ISGYO', 'İş GYO',               'GYO',           TRUE, FALSE),
    ('KLGYO', 'Kiler GYO',            'GYO',           TRUE, FALSE),
    -- Beyaz Eşya / Elektronik
    ('ARCLK', 'Arçelik',              'Beyaz Eşya',    TRUE, FALSE),
    ('VESBE', 'Vestel Beyaz Eşya',    'Beyaz Eşya',    TRUE, FALSE),
    ('VESTL', 'Vestel Elektronik',    'Elektronik',    TRUE, FALSE),
    -- Madencilik
    ('KOZAL', 'Koza Altın',           'Madencilik',    TRUE, FALSE),
    ('KOZAA', 'Koza Anadolu Metal',   'Madencilik',    TRUE, FALSE),
    ('IPEKE', 'İpek Doğal Enerji',   'Madencilik',    TRUE, FALSE),
    -- Sigorta
    ('ANHYT', 'Anadolu Hayat',        'Sigorta',       TRUE, FALSE),
    ('AKGRT', 'Aksigorta',            'Sigorta',       TRUE, FALSE),
    -- Tekstil / Hazır Giyim
    ('MAVI',  'Mavi Giyim',           'Tekstil',       TRUE, FALSE),
    ('BRISA', 'Brisa',                'Lastik',        TRUE, FALSE),
    -- Sanayi / Çimento
    ('CIMSA', 'Çimsa',                'Çimento',       TRUE, FALSE),
    ('BOLUC', 'Bolu Çimento',         'Çimento',       TRUE, FALSE),
    ('ADANA', 'Adana Çimento',        'Çimento',       TRUE, FALSE),
    -- Sağlık / İlaç
    ('SELEC', 'Selçuk Ecza Deposu',  'Sağlık',        TRUE, FALSE),
    -- Kâğıt / Ambalaj
    ('KORDS', 'Kordsa',               'Sanayi',        TRUE, FALSE),
    ('SUNTK', 'Sunteks',              'Tekstil',       TRUE, FALSE),
    -- Diğer Sanayi
    ('TTRAK', 'Türk Traktör',        'Tarım Makineleri', TRUE, FALSE),
    ('IHLGM', 'İhlas Gayrimenkul',   'GYO',           TRUE, FALSE),
    ('EGEEN', 'Ege Endüstri',        'Sanayi',        TRUE, FALSE),
    ('AEFES', 'Anadolu Efes',         'İçecek',        TRUE, FALSE),
    ('CCOLA', 'Coca-Cola İçecek',    'İçecek',        TRUE, FALSE),
    ('LOGO',  'Logo Yazılım',        'Teknoloji',     TRUE, FALSE),
    ('NETAS', 'Netaş',               'Teknoloji',     TRUE, FALSE),
    ('KAREL', 'Karel Elektronik',     'Teknoloji',     TRUE, FALSE),
    ('SASA',  'SASA Polyester',       'Kimya',         TRUE, FALSE),
    ('ENJSA', 'Enerjisa Enerji',     'Enerji',        TRUE, FALSE),
    ('GESAN', 'GE Sanayi',           'Sanayi',        TRUE, FALSE),
    ('KONTR', 'Kontrolmatik',         'Teknoloji',     TRUE, FALSE),
    ('OYAKC', 'Oyak Çimento',        'Çimento',       TRUE, FALSE),
    ('POLHO', 'Polisan Holding',      'Kimya',         TRUE, FALSE),
    ('ISMEN', 'İş Yatırım',          'Finans',        TRUE, FALSE),
    ('GLYHO', 'Global Yatırım Holding', 'Finans',     TRUE, FALSE),
    ('KARSN', 'Karsan Otomotiv',      'Otomotiv',      TRUE, FALSE),
    ('BERA',  'Bera Holding',         'Holding',       TRUE, FALSE),
    ('MPARK', 'MLP Sağlık',          'Sağlık',        TRUE, FALSE),
    ('OBAMS', 'Oba Makarna',          'Gıda',          TRUE, FALSE),
    ('TURSG', 'Türkiye Sigorta',     'Sigorta',       TRUE, FALSE),
    ('EUPWR', 'Europower',            'Enerji',        TRUE, FALSE),
    ('BIENY', 'Bien Yapı',           'İnşaat',        TRUE, FALSE),
    ('BTCIM', 'Batıçim',             'Çimento',       TRUE, FALSE),
    ('YATAS', 'Yataş',               'Mobilya',       TRUE, FALSE),
    ('TMSN',  'Tümosan',              'Tarım Makineleri', TRUE, FALSE),
    ('BRLSM', 'Birleşim Mühendislik', 'Mühendislik', TRUE, FALSE),
    ('BUCIM', 'Bursa Çimento',        'Çimento',       TRUE, FALSE),
    ('IZMDC', 'İzmir Demir Çelik',   'Demir Çelik',   TRUE, FALSE),
    ('KLSER', 'Kaleseramik',          'Seramik',       TRUE, FALSE),
    ('PRKAB', 'Türk Prysmian Kablo', 'Elektrik',      TRUE, FALSE),
    ('SARKY', 'Sarkuysan',            'Metal',         TRUE, FALSE)
ON CONFLICT (symbol) DO NOTHING;

-- =====================================================
-- 10) Varsayılan admin kullanıcı (Filament giriş)
-- =====================================================
-- password = bcrypt('password')  — Python passlib uyumlu $2b$ format
INSERT INTO users (name, username, email, password, role) VALUES
    ('Admin', 'admin', 'admin@filamentphp.com', '$2b$12$rfDeW9cj.ldwZP9izTSnie516ryaiQr2QyYnN7SeAh5PRBs2Y5BSm', 'admin')
ON CONFLICT (username) DO NOTHING;
