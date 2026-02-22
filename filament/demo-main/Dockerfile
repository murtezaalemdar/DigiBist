FROM php:8.3-cli

# Sistem bağımlılıkları (PostgreSQL desteği dahil)
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    libsqlite3-dev \
    libicu-dev \
    libpq-dev \
    zip \
    unzip \
    nodejs \
    npm \
    && docker-php-ext-configure intl \
    && docker-php-ext-configure pgsql -with-pgsql=/usr/local/pgsql \
    && docker-php-ext-install pdo pdo_sqlite pdo_pgsql pgsql mbstring exif pcntl bcmath gd zip intl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Composer yükle
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Composer bağımlılıkları (cache optimizasyonu)
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

# Proje dosyaları
COPY . .

# Autoloader & scripts
RUN composer dump-autoload --optimize

# Storage ve cache izinleri
RUN mkdir -p storage/framework/{cache,sessions,testing,views} \
    storage/logs \
    bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

# NPM bağımlılıkları & Vite build
RUN npm install && npm run build || true

# Veritabanı dizini (migration logları için)
RUN mkdir -p database

# Ortam dosyası
RUN cp .env.example .env || true

EXPOSE 8001

# Başlatma script'i
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
