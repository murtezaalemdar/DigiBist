# -*- coding: utf-8 -*-
"""Fix Turkish characters in permissions table"""
import psycopg2

conn = psycopg2.connect(
    host="postgres", port=5432,
    user="bist_admin", password="bist_secure_2026",
    dbname="bist_trading"
)
cur = conn.cursor()

# Delete old corrupted data
cur.execute("DELETE FROM user_permissions")
cur.execute("DELETE FROM permissions")

permissions = [
    ('dashboard.view',   'Dashboard Görüntüle',      'Ana dashboard sayfasını görüntüleme',      'Dashboard'),
    ('portfolio.view',   'Portföy Görüntüle',        'Portföy sayfasını görüntüleme',            'Portföy'),
    ('models.view',      'ML Modelleri Görüntüle',   'ML modelleri sayfasını görüntüleme',       'ML Modelleri'),
    ('ai.forecast',      'AI Tahmin Görüntüle',      'AI tahmin sonuçlarını görüntüleme',        'AI Tahmin'),
    ('ai.refresh',       'Tahmin Yenile',            'AI tahminlerini yeniden oluşturma',        'AI Tahmin'),
    ('trade.view',       'İşlem Sayfası Görüntüle',  'İşlem sayfasını görüntüleme',              'İşlem'),
    ('trade.manual',     'Manuel Emir',              'Manuel alım/satım emri girişi',            'İşlem'),
    ('trade.auto',       'Otomatik Trading',         'Otomatik trading başlatma/durdurma',       'İşlem'),
    ('trade.history',    'İşlem Geçmişi',            'Geçmiş emirleri görüntüleme',              'İşlem'),
    ('settings.view',    'Ayarlar Görüntüle',        'Ayarlar sayfasını görüntüleme',            'Ayarlar'),
    ('settings.edit',    'Ayarları Düzenle',          'Platform ayarlarını değiştirme',           'Ayarlar'),
    ('users.view',       'Kullanıcıları Görüntüle',  'Kullanıcı listesini görüntüleme',          'Kullanıcı Yönetimi'),
    ('users.create',     'Kullanıcı Ekle',           'Yeni kullanıcı oluşturma',                 'Kullanıcı Yönetimi'),
    ('users.edit',       'Kullanıcı Düzenle',        'Kullanıcı bilgilerini güncelleme',         'Kullanıcı Yönetimi'),
    ('users.delete',     'Kullanıcı Sil',            'Kullanıcı silme',                          'Kullanıcı Yönetimi'),
    ('users.permissions','İzinleri Yönet',           'Kullanıcı izinlerini atama/kaldırma',      'Kullanıcı Yönetimi'),
]

for key, name, desc, group in permissions:
    cur.execute(
        "INSERT INTO permissions (key, name, description, group_name) VALUES (%s, %s, %s, %s) ON CONFLICT (key) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, group_name=EXCLUDED.group_name",
        (key, name, desc, group)
    )

# Grant admin all permissions
cur.execute("INSERT INTO user_permissions (user_id, permission_key, granted) SELECT 1, key, TRUE FROM permissions ON CONFLICT (user_id, permission_key) DO NOTHING")

conn.commit()
cur.close()
conn.close()
print("OK - Permissions fixed with Turkish characters")
