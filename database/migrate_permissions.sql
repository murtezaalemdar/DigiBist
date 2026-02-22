-- =====================================================
-- BIST AI Trading — İzin (Permission) Tabloları
-- Kullanıcı bazlı granüler yetkilendirme sistemi
-- =====================================================
SET client_encoding TO 'UTF8';
-- 1) İzinler Tanım Tablosu
CREATE TABLE IF NOT EXISTS permissions (
    id          BIGSERIAL PRIMARY KEY,
    key         VARCHAR(50)  NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    group_name  VARCHAR(50)  NOT NULL DEFAULT 'Genel',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_permissions_key   ON permissions (key);
CREATE INDEX idx_permissions_group ON permissions (group_name);

-- 2) Kullanıcı-İzin İlişki Tablosu
CREATE TABLE IF NOT EXISTS user_permissions (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_key VARCHAR(50) NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
    granted       BOOLEAN NOT NULL DEFAULT TRUE,
    granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, permission_key)
);

CREATE INDEX idx_up_user ON user_permissions (user_id);
CREATE INDEX idx_up_perm ON user_permissions (permission_key);

-- 3) Varsayılan İzinleri Ekle
INSERT INTO permissions (key, name, description, group_name) VALUES
    -- Dashboard
    ('dashboard.view',   'Dashboard Görüntüle',    'Ana dashboard sayfasını görüntüleme',    'Dashboard'),
    -- Portföy
    ('portfolio.view',   'Portföy Görüntüle',      'Portföy sayfasını görüntüleme',          'Portföy'),
    -- ML Modelleri
    ('models.view',      'ML Modelleri Görüntüle',  'ML modelleri sayfasını görüntüleme',     'ML Modelleri'),
    -- AI Tahmin
    ('ai.forecast',      'AI Tahmin Görüntüle',     'AI tahmin sonuçlarını görüntüleme',      'AI Tahmin'),
    ('ai.refresh',       'Tahmin Yenile',           'AI tahminlerini yeniden oluşturma',      'AI Tahmin'),
    -- İşlem (Trade)
    ('trade.view',       'İşlem Sayfası Görüntüle', 'İşlem sayfasını görüntüleme',            'İşlem'),
    ('trade.manual',     'Manuel Emir',             'Manuel alım/satım emri girişi',          'İşlem'),
    ('trade.auto',       'Otomatik Trading',        'Otomatik trading başlatma/durdurma',     'İşlem'),
    ('trade.history',    'İşlem Geçmişi',           'Geçmiş emirleri görüntüleme',            'İşlem'),
    -- Ayarlar
    ('settings.view',    'Ayarlar Görüntüle',       'Ayarlar sayfasını görüntüleme',          'Ayarlar'),
    ('settings.edit',    'Ayarları Düzenle',         'Platform ayarlarını değiştirme',         'Ayarlar'),
    -- Kullanıcı Yönetimi
    ('users.view',       'Kullanıcıları Görüntüle', 'Kullanıcı listesini görüntüleme',        'Kullanıcı Yönetimi'),
    ('users.create',     'Kullanıcı Ekle',          'Yeni kullanıcı oluşturma',               'Kullanıcı Yönetimi'),
    ('users.edit',       'Kullanıcı Düzenle',       'Kullanıcı bilgilerini güncelleme',       'Kullanıcı Yönetimi'),
    ('users.delete',     'Kullanıcı Sil',           'Kullanıcı silme',                        'Kullanıcı Yönetimi'),
    ('users.permissions','İzinleri Yönet',          'Kullanıcı izinlerini atama/kaldırma',    'Kullanıcı Yönetimi')
ON CONFLICT (key) DO NOTHING;

-- 4) Admin kullanıcısına tüm izinleri ver (user_id=1)
INSERT INTO user_permissions (user_id, permission_key, granted)
SELECT 1, key, TRUE FROM permissions
ON CONFLICT (user_id, permission_key) DO NOTHING;
