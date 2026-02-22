<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration 
{
    public function up(): void
    {
        if (Schema::hasTable('stock_forecasts')) {
            return;
        }

        Schema::create('stock_forecasts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_id')->constrained()->cascadeOnDelete();
            $table->decimal('current_price', 12, 2)->comment('Tahmin anındaki fiyat');
            $table->decimal('predicted_price', 12, 2)->comment('ML tahmini fiyat');
            $table->string('signal', 10)->comment('BUY / SELL');
            $table->decimal('confidence', 5, 2)->comment('Güven skoru (0-1)');
            $table->decimal('change_percent', 8, 2)->default(0)->comment('Tahmin edilen değişim %');
            $table->string('model_used')->default('RandomForestRegressor');
            $table->json('raw_response')->nullable()->comment('Python API ham yanıt');
            $table->timestamp('forecasted_at')->useCurrent();
            $table->timestamps();

            $table->index(['stock_id', 'forecasted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_forecasts');
    }
};
