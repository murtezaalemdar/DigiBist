#!/bin/bash
set -e

echo "🚀 BIST AI Filament Admin Panel başlatılıyor..."

# .env yoksa oluştur
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ .env dosyası oluşturuldu"
fi

# APP_KEY yoksa üret
php artisan key:generate --no-interaction --force 2>/dev/null || true

# BIST_AI_URL ortam değişkenini .env'ye yaz (docker ağı için)
if ! grep -q "BIST_AI_URL" .env; then
    echo "" >> .env
    echo "BIST_AI_URL=http://backend:8000" >> .env
fi
# Varsa güncelle
sed -i "s|BIST_AI_URL=.*|BIST_AI_URL=http://backend:8000|g" .env

# PostgreSQL bağlantısını .env'ye yaz (sed ile satır varsa değiştir, yoksa ekle)
set_env_var() {
    local KEY="$1"
    local VALUE="$2"
    if grep -q "^${KEY}=" .env; then
        sed -i "s|^${KEY}=.*|${KEY}=${VALUE}|g" .env
    else
        echo "${KEY}=${VALUE}" >> .env
    fi
}

set_env_var "DB_CONNECTION" "pgsql"
set_env_var "DB_HOST"       "${DB_HOST:-postgres}"
set_env_var "DB_PORT"       "${DB_PORT:-5432}"
set_env_var "DB_DATABASE"   "${DB_DATABASE:-bist_trading}"
set_env_var "DB_USERNAME"   "${DB_USERNAME:-bist_admin}"
set_env_var "DB_PASSWORD"   "${DB_PASSWORD:-bist_secure_2026}"

echo "✅ .env PostgreSQL ayarları:"
grep "^DB_" .env

# PostgreSQL hazır olana kadar bekle
echo "⏳ PostgreSQL bağlantısı bekleniyor..."
MAX_RETRIES=30
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    if php -r "
        try {
            new PDO(
                'pgsql:host=${DB_HOST:-postgres};port=${DB_PORT:-5432};dbname=${DB_DATABASE:-bist_trading}',
                '${DB_USERNAME:-bist_admin}',
                '${DB_PASSWORD:-bist_secure_2026}'
            );
            echo 'OK';
            exit(0);
        } catch (Exception \$e) {
            exit(1);
        }
    " 2>/dev/null; then
        echo "✅ PostgreSQL bağlantısı başarılı!"
        break
    fi
    RETRY=$((RETRY + 1))
    echo "   Deneme $RETRY/$MAX_RETRIES..."
    sleep 2
done

if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "⚠️  PostgreSQL'e bağlanılamadı, devam ediliyor..."
fi

# Storage link
php artisan storage:link --force 2>/dev/null || true

# init.sql'den zaten oluşan tablolar için migration kayıtlarını ekle
# (Laravel migrate, kayıt yoksa tabloyu tekrar oluşturmaya çalışır ve hata verir)
echo "📋 Migration kayıtları senkronize ediliyor..."
php -r "
    try {
        \$pdo = new PDO(
            'pgsql:host=${DB_HOST:-postgres};port=${DB_PORT:-5432};dbname=${DB_DATABASE:-bist_trading}',
            '${DB_USERNAME:-bist_admin}',
            '${DB_PASSWORD:-bist_secure_2026}'
        );
        \$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // init.sql'den gelen tablo ↔ migration eşleştirmesi
        \$mappings = [
            'users'            => '2014_10_12_000000_create_users_table',
            'password_resets'   => '2014_10_12_100000_create_password_resets_table',
            'failed_jobs'      => '2019_08_19_000000_create_failed_jobs_table',
            'personal_access_tokens' => '2019_12_14_000001_create_personal_access_tokens_table',
            'sessions'         => '0001_01_01_000000_create_users_table',
            'cache'            => '0001_01_01_000001_create_cache_table',
            'jobs'             => '0001_01_01_000002_create_jobs_table',
            'stocks'           => '2026_02_22_000001_create_stocks_table',
            'stock_forecasts'  => '2026_02_22_000002_create_stock_forecasts_table',
        ];

        \$batch = 1;
        foreach (\$mappings as \$table => \$migration) {
            // Tablo var mı kontrol et
            \$check = \$pdo->query(\"SELECT to_regclass('public.\" . \$table . \"')\");
            \$exists = \$check->fetchColumn();
            if (\$exists) {
                // Migration kaydı var mı?
                \$stmt = \$pdo->prepare('SELECT COUNT(*) FROM migrations WHERE migration = ?');
                \$stmt->execute([\$migration]);
                if ((int)\$stmt->fetchColumn() === 0) {
                    \$ins = \$pdo->prepare('INSERT INTO migrations (migration, batch) VALUES (?, ?)');
                    \$ins->execute([\$migration, \$batch]);
                    echo \"  ✓ \$migration kaydedildi\n\";
                }
            }
        }
        echo \"OK\n\";
    } catch (Exception \$e) {
        echo 'Migration sync hatası: ' . \$e->getMessage() . \"\n\";
    }
" 2>/dev/null || true

# Migration (PostgreSQL'e)
echo "📦 Veritabanı migrasyonu yapılıyor (PostgreSQL)..."
php artisan migrate --force --no-interaction 2>/dev/null || true

# Hisse seed
echo "🌱 Hisse verileri yükleniyor..."
php artisan db:seed --class=Database\\Seeders\\StockSeeder --force --no-interaction 2>/dev/null || true

# Demo verileri (kullanıcı vb.)
php artisan db:seed --force --no-interaction 2>/dev/null || true

# Cache temizle
php artisan config:clear 2>/dev/null || true
php artisan cache:clear 2>/dev/null || true
php artisan view:clear 2>/dev/null || true

echo "✅ Filament Admin Panel hazır! (PostgreSQL)"
echo "📊 http://localhost:8001/admin"
echo "👤 Login: admin@filamentphp.com / password"

# Laravel sunucusunu başlat
exec php artisan serve --host=0.0.0.0 --port=8001
