<?php

namespace App\Services;

use App\Models\Stock;
use App\Models\StockForecast;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class BistAIService
{
    protected string $baseUrl;
    protected int $timeout;

    public function __construct()
    {
        $this->baseUrl = config('services.bist_ai.base_url', 'http://localhost:8000');
        $this->timeout = config('services.bist_ai.timeout', 60);
    }

    /**
     * Python ML backend'den tahmin al
     */
    public function getForecast(string $symbol): ?array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->get("{$this->baseUrl}/api/ai-forecast/{$symbol}");

            if ($response->successful()) {
                return $response->json();
            }

            Log::error("BIST AI API hatası: {$symbol}", [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return null;
        }
        catch (\Exception $e) {
            Log::error("BIST AI bağlantı hatası: {$symbol}", [
                'message' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Hisse için tahmin al ve veritabanına kaydet
     */
    public function fetchAndStoreForecast(Stock $stock): ?StockForecast
    {
        $data = $this->getForecast($stock->symbol);

        if (!$data) {
            return null;
        }

        // Hissenin güncel fiyatını güncelle
        $stock->update([
            'current_price' => $data['current_price'],
            'last_synced_at' => now(),
        ]);

        // Tahmin kaydı oluştur
        $changePercent = (($data['predicted_price'] - $data['current_price']) / $data['current_price']) * 100;

        return $stock->forecasts()->create([
            'current_price' => $data['current_price'],
            'predicted_price' => $data['predicted_price'],
            'signal' => $data['signal'],
            'confidence' => $data['confidence'],
            'change_percent' => round($changePercent, 2),
            'model_used' => 'RandomForestRegressor',
            'raw_response' => $data,
            'forecasted_at' => now(),
        ]);
    }

    /**
     * Tüm aktif hisseler için toplu tahmin al
     */
    public function fetchAllForecasts(): array
    {
        $stocks = Stock::active()->get();
        $results = [];

        foreach ($stocks as $stock) {
            $forecast = $this->fetchAndStoreForecast($stock);
            $results[$stock->symbol] = $forecast ? 'success' : 'failed';
        }

        return $results;
    }

    /**
     * Backend sağlık kontrolü
     */
    public function healthCheck(): bool
    {
        try {
            $response = Http::timeout(5)->get("{$this->baseUrl}/");

            if (!$response->successful()) {
                return false;
            }

            $status = (string) $response->json('status', '');

            return str_contains($status, 'AI Engine') ||
                str_contains($status, 'AI Model Engine');
        }
        catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Cached tahmin (widget'lar için)
     */
    public function getCachedForecast(string $symbol, int $ttl = 300): ?array
    {
        return Cache::remember("bist_forecast_{$symbol}", $ttl, function () use ($symbol) {
            return $this->getForecast($symbol);
        });
    }
}
