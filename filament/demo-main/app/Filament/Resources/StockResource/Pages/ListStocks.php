<?php

namespace App\Filament\Resources\StockResource\Pages;

use App\Filament\Resources\StockResource;
use App\Services\BistAIService;
use Filament\Actions;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;

class ListStocks extends ListRecords
{
    protected static string $resource = StockResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make()
            ->label('Yeni Hisse Ekle')
            ->icon('heroicon-o-plus'),

            Actions\Action::make('syncAll')
            ->label('Tümünü Güncelle')
            ->icon('heroicon-o-arrow-path')
            ->color('info')
            ->requiresConfirmation()
            ->modalHeading('Tüm Hisseleri Güncelle')
            ->modalDescription('Aktif tüm hisseler için ML tahmin çalıştırılacak. Bu işlem birkaç dakika sürebilir.')
            ->action(function () {
            $service = app(BistAIService::class);

            if (!$service->healthCheck()) {
                Notification::make()
                    ->title('Backend Bağlantı Hatası')
                    ->body('Python ML backend\'e bağlanılamıyor.')
                    ->danger()
                    ->send();
                return;
            }

            $results = $service->fetchAllForecasts();
            $success = count(array_filter($results, fn($r) => $r === 'success'));
            $failed = count($results) - $success;

            Notification::make()
                ->title('Toplu Güncelleme Tamamlandı')
                ->body("Başarılı: {$success} | Başarısız: {$failed}")
                ->success()
                ->send();
        }),

            Actions\Action::make('healthCheck')
            ->label('Backend Durumu')
            ->icon('heroicon-o-signal')
            ->color('gray')
            ->action(function () {
            $service = app(BistAIService::class);
            $isOnline = $service->healthCheck();

            Notification::make()
                ->title($isOnline ? 'Backend Aktif ✅' : 'Backend Kapalı ❌')
                ->body($isOnline
                ? 'Python ML backend çalışıyor ve bağlantı başarılı.'
                : 'Python ML backend\'e bağlanılamıyor. Lütfen backend\'i başlatın.')
                ->color($isOnline ? 'success' : 'danger')
                ->send();
        }),
        ];
    }
}
