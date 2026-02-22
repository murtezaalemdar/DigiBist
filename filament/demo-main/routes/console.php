<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

/* |-------------------------------------------------------------------------- | Console Routes |-------------------------------------------------------------------------- | | This file is where you may define all of your Closure based console | commands. Each Closure is bound to a command instance allowing a | simple approach to interacting with each command's IO methods. | */

Artisan::command('inspire', function (): void {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('bist:sync', function () {
    $this->info('BIST AI Senkronizasyonu başlatılıyor...');
    $service = app(\App\Services\BistAIService::class);
    $results = $service->fetchAllForecasts();
    $this->info('Senkronizasyon tamamlandı.');
})->purpose('Tüm aktif hisseler için ML tahminlerini günceller');
