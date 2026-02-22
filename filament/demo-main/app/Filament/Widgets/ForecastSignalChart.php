<?php

namespace App\Filament\Widgets;

use App\Models\StockForecast;
use Filament\Widgets\ChartWidget;

class ForecastSignalChart extends ChartWidget
{
    protected ?string $heading = 'Sinyal Dağılımı (Son Tahminler)';

    protected static ?int $sort = -2;

    protected ?string $maxHeight = '300px';

    protected function getType(): string
    {
        return 'doughnut';
    }

    protected function getData(): array
    {
        // Her hissenin en son tahminini al
        $latestForecasts = StockForecast::whereIn('id', function ($query) {
            $query->selectRaw('MAX(id)')
                ->from('stock_forecasts')
                ->groupBy('stock_id');
        })->get();

        $buyCount = $latestForecasts->where('signal', 'BUY')->count();
        $sellCount = $latestForecasts->where('signal', 'SELL')->count();

        return [
            'datasets' => [
                [
                    'label' => 'Sinyaller',
                    'data' => [$buyCount, $sellCount],
                    'backgroundColor' => [
                        'rgba(34, 197, 94, 0.8)', // green - BUY
                        'rgba(239, 68, 68, 0.8)', // red - SELL
                    ],
                    'borderColor' => [
                        'rgba(34, 197, 94, 1)',
                        'rgba(239, 68, 68, 1)',
                    ],
                    'borderWidth' => 2,
                ],
            ],
            'labels' => ['AL (BUY)', 'SAT (SELL)'],
        ];
    }

    protected function getOptions(): array
    {
        return [
            'plugins' => [
                'legend' => [
                    'display' => true,
                    'position' => 'bottom',
                ],
            ],
        ];
    }
}
