<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // init.sql'den zaten varsa atla
        if (Schema::hasTable('stocks')) {
            return;
        }

        Schema::create('stocks', function (Blueprint $table) {
            $table->id();
            $table->string('symbol')->unique()->comment('BIST sembolü (ör: THYAO)');
            $table->string('name')->comment('Şirket adı');
            $table->string('sector')->nullable()->comment('Sektör');
            $table->decimal('current_price', 12, 2)->default(0)->comment('Güncel fiyat');
            $table->decimal('change_percent', 8, 2)->default(0)->comment('Günlük değişim %');
            $table->boolean('is_active')->default(true)->comment('Aktif takip');
            $table->boolean('is_favorite')->default(false)->comment('Favori');
            $table->timestamp('last_synced_at')->nullable()->comment('Son senkronizasyon');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stocks');
    }
};
