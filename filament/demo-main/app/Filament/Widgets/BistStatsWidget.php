<?php

namespace App\Filament\Widgets;

use App\Models\Stock;
use App\Models\StockForecast;
use App\Services\BistAIService;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class BistStatsWidget extends BaseWidget
{
    protected static ?int $sort = -3;

    protected ?string $pollingInterval = '60s';
    protected function getStats(): array
    {
        $totalStocks = Stock::active()->count();
        $buySignals = StockForecast::where('signal', 'BUY')
            ->whereIn('id', function ($query) {
            $query->selectRaw('MAX(id)')
                ->from('stock_forecasts')
                ->groupBy('stock_id');
        })
            ->count();

        $sellSignals = StockForecast::where('signal', 'SELL')
            ->whereIn('id', function ($query) {
            $query->selectRaw('MAX(id)')
                ->from('stock_forecasts')
                ->groupBy('stock_id');
        })
            ->count();

        $avgConfidence = StockForecast::whereIn('id', function ($query) {
            $query->selectRaw('MAX(id)')
                ->from('stock_forecasts')
                ->groupBy('stock_id');
        })
            ->avg('confidence');

        // Backend durumu
        $service = app(BistAIService::class);
        $isOnline = $service->healthCheck();

        return [
            Stat::make('Takip Edilen Hisse', $totalStocks)
            ->description('Aktif hisse sayısı')
            ->descriptionIcon('heroicon-m-chart-bar')
            ->chart([7, 3, 4, 5, 6, 3, 5])
            ->color('primary'),

            Stat::make('AL Sinyalleri', $buySignals)
            ->description('Yükseliş beklenen')
            ->descriptionIcon('heroicon-m-arrow-trending-up')
            ->chart([3, 5, 7, 6, 8, 7, 9])
            ->color('success'),

            Stat::make('SAT Sinyalleri', $sellSignals)
            ->description('Düşüş beklenen')
            ->descriptionIcon('heroicon-m-arrow-trending-down')
            ->chart([8, 6, 5, 7, 4, 6, 3])
            ->color('danger'),

            Stat::make('ML Backend', $isOnline ? 'Aktif ✅' : 'Kapalı ❌')
            ->description($isOnline ? 'Bağlantı başarılı' : 'Bağlantı yok')
            ->descriptionIcon($isOnline ? 'heroicon-m-signal' : 'heroicon-m-signal-slash')
            ->color($isOnline ? 'success' : 'danger'),
        ];
    }
}
