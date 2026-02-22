-- Fix Turkish characters in permissions table
-- Run with: docker exec -i bist-postgres psql -U bist_admin -d bist_trading < fix_permissions_utf8.sql

DELETE FROM user_permissions;
DELETE FROM permissions;

INSERT INTO permissions (key, name, description, group_name) VALUES
    ('dashboard.view',   'Dashboard Goruntule',      'Ana dashboard sayfasini goruntuleme',      'Dashboard'),
    ('portfolio.view',   'Portfolyo Goruntule',      'Portfolyo sayfasini goruntuleme',           'Portfolyo'),
    ('models.view',      'ML Modelleri Goruntule',   'ML modelleri sayfasini goruntuleme',        'ML Modelleri'),
    ('ai.forecast',      'AI Tahmin Goruntule',      'AI tahmin sonuclarini goruntuleme',         'AI Tahmin'),
    ('ai.refresh',       'Tahmin Yenile',            'AI tahminlerini yeniden olusturma',         'AI Tahmin'),
    ('trade.view',       'Islem Sayfasi Goruntule',  'Islem sayfasini goruntuleme',               'Islem'),
    ('trade.manual',     'Manuel Emir',              'Manuel alim/satim emri girisi',             'Islem'),
    ('trade.auto',       'Otomatik Trading',         'Otomatik trading baslatma/durdurma',        'Islem'),
    ('trade.history',    'Islem Gecmisi',            'Gecmis emirleri goruntuleme',               'Islem'),
    ('settings.view',    'Ayarlar Goruntule',        'Ayarlar sayfasini goruntuleme',             'Ayarlar'),
    ('settings.edit',    'Ayarlari Duzenle',         'Platform ayarlarini degistirme',            'Ayarlar'),
    ('users.view',       'Kullanicilari Goruntule',  'Kullanici listesini goruntuleme',           'Kullanici Yonetimi'),
    ('users.create',     'Kullanici Ekle',           'Yeni kullanici olusturma',                  'Kullanici Yonetimi'),
    ('users.edit',       'Kullanici Duzenle',        'Kullanici bilgilerini guncelleme',          'Kullanici Yonetimi'),
    ('users.delete',     'Kullanici Sil',            'Kullanici silme',                           'Kullanici Yonetimi'),
    ('users.permissions','Izinleri Yonet',           'Kullanici izinlerini atama/kaldirma',       'Kullanici Yonetimi')
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    group_name = EXCLUDED.group_name;

-- Re-grant admin all permissions
INSERT INTO user_permissions (user_id, permission_key, granted)
SELECT 1, key, TRUE FROM permissions
ON CONFLICT (user_id, permission_key) DO NOTHING;
