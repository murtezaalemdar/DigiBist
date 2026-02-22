<?php

namespace App\Filament\Resources\StockResource\Pages;

use App\Filament\Resources\StockResource;
use App\Services\BistAIService;
use Filament\Actions;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ViewRecord;

class ViewStock extends ViewRecord
{
    protected static string $resource = StockResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\EditAction::make(),

            Actions\Action::make('runForecast')
            ->label('AI Tahmin Çalıştır')
            ->icon('heroicon-o-cpu-chip')
            ->color('info')
            ->requiresConfirmation()
            ->action(function () {
            $service = app(BistAIService::class);
            $forecast = $service->fetchAndStoreForecast($this->record);

            if ($forecast) {
                Notification::make()
                    ->title('Tahmin Başarılı')
                    ->body("Sinyal: {$forecast->signal} | Tahmin: ₺{$forecast->predicted_price}")
                    ->success()
                    ->send();
            }
            else {
                Notification::make()
                    ->title('Tahmin Başarısız')
                    ->danger()
                    ->send();
            }
        }),

            Actions\DeleteAction::make(),
        ];
    }
}
