<x-filament-panels::page>
    {{-- Son Analiz Sonucu --}}
    @if($forecastResult)
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="fi-section rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10 p-6">
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">Hisse</div>
            <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
                {{ $forecastResult['symbol'] }}
            </div>
            <div class="text-sm text-gray-500">{{ $forecastResult['name'] }}</div>
        </div>

        <div class="fi-section rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10 p-6">
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">Güncel Fiyat</div>
            <div class="text-2xl font-bold font-mono">
                ₺{{ number_format($forecastResult['current_price'], 2, ',', '.') }}
            </div>
        </div>

        <div class="fi-section rounded-xl shadow-sm p-6
            {{ $forecastResult['signal'] === 'BUY'
                ? 'bg-green-50 ring-1 ring-green-200 dark:bg-green-950/30 dark:ring-green-800'
                : 'bg-red-50 ring-1 ring-red-200 dark:bg-red-950/30 dark:ring-red-800' }}">
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">AI Tahmini</div>
            <div class="text-2xl font-bold font-mono {{ $forecastResult['signal'] === 'BUY' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' }}">
                ₺{{ number_format($forecastResult['predicted_price'], 2, ',', '.') }}
            </div>
            <div class="text-sm mt-1 {{ $forecastResult['signal'] === 'BUY' ? 'text-green-600' : 'text-red-600' }}">
                {{ $forecastResult['change_percent'] }}
            </div>
        </div>

        <div class="fi-section rounded-xl shadow-sm p-6
            {{ $forecastResult['signal'] === 'BUY'
                ? 'bg-green-50 ring-1 ring-green-200 dark:bg-green-950/30 dark:ring-green-800'
                : 'bg-red-50 ring-1 ring-red-200 dark:bg-red-950/30 dark:ring-red-800' }}">
            <div class="text-sm text-gray-500 dark:text-gray-400 mb-1">Sinyal</div>
            <div class="flex items-center gap-2">
                <span class="text-3xl font-black {{ $forecastResult['signal'] === 'BUY' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' }}">
                    {{ $forecastResult['signal'] === 'BUY' ? '📈 AL' : '📉 SAT' }}
                </span>
            </div>
            <div class="text-sm text-gray-500 mt-1">
                Güven: %{{ number_format($forecastResult['confidence'] * 100, 0) }}
            </div>
        </div>
    </div>
    @endif

    {{-- Hisse Kartları --}}
    <div class="fi-section rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10 p-6 mb-6">
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
            <x-heroicon-o-chart-bar class="w-5 h-5 text-primary-500" />
            Aktif Hisseler & AI Sinyalleri
        </h3>

        @if($stocks->count() > 0)
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            @foreach($stocks as $stock)
            <div class="rounded-xl border p-4 transition-all hover:shadow-md
                {{ $stock['signal'] === 'BUY'
                    ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20'
                    : ($stock['signal'] === 'SELL'
                        ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20'
                        : 'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50') }}">

                <div class="flex justify-between items-start mb-3">
                    <div>
                        <span class="text-lg font-bold text-primary-600 dark:text-primary-400">{{ $stock['symbol'] }}</span>
                        <p class="text-xs text-gray-500">{{ $stock['name'] }}</p>
                    </div>
                    @if($stock['signal'])
                    <span class="px-2 py-1 rounded-full text-xs font-bold
                        {{ $stock['signal'] === 'BUY'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' }}">
                        {{ $stock['signal'] === 'BUY' ? '📈 AL' : '📉 SAT' }}
                    </span>
                    @else
                    <span class="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                        Bekliyor
                    </span>
                    @endif
                </div>

                <div class="space-y-2">
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Fiyat:</span>
                        <span class="font-mono font-semibold">₺{{ number_format($stock['current_price'], 2, ',', '.') }}</span>
                    </div>

                    @if($stock['predicted_price'])
                    <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Tahmin:</span>
                        <span class="font-mono font-semibold {{ $stock['signal'] === 'BUY' ? 'text-green-600' : 'text-red-600' }}">
                            ₺{{ number_format($stock['predicted_price'], 2, ',', '.') }}
                        </span>
                    </div>

                    <div class="flex justify-between text-sm">
                        <span class="text-gray-500">Güven:</span>
                        <span class="font-semibold">%{{ number_format($stock['confidence'] * 100, 0) }}</span>
                    </div>
                    @endif

                    @if($stock['last_updated'])
                    <div class="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        {{ $stock['last_updated'] }}
                    </div>
                    @endif
                </div>
            </div>
            @endforeach
        </div>
        @else
        <div class="text-center py-8 text-gray-500">
            <x-heroicon-o-chart-bar class="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Henüz hisse eklenmemiş.</p>
            <p class="text-sm">Hisseler sayfasından yeni hisse ekleyebilirsiniz.</p>
        </div>
        @endif
    </div>

    {{-- Son Tahmin Geçmişi --}}
    <div class="fi-section rounded-xl bg-white shadow-sm ring-1 ring-gray-950/5 dark:bg-gray-900 dark:ring-white/10 p-6">
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
            <x-heroicon-o-clock class="w-5 h-5 text-primary-500" />
            Son Tahmin Geçmişi
        </h3>

        @if($recentForecasts->count() > 0)
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                    <tr class="border-b border-gray-200 dark:border-gray-700">
                        <th class="text-left py-2 px-3 text-gray-500 font-medium">Tarih</th>
                        <th class="text-left py-2 px-3 text-gray-500 font-medium">Hisse</th>
                        <th class="text-right py-2 px-3 text-gray-500 font-medium">Güncel Fiyat</th>
                        <th class="text-right py-2 px-3 text-gray-500 font-medium">Tahmin</th>
                        <th class="text-center py-2 px-3 text-gray-500 font-medium">Sinyal</th>
                        <th class="text-center py-2 px-3 text-gray-500 font-medium">Güven</th>
                        <th class="text-center py-2 px-3 text-gray-500 font-medium">Model</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($recentForecasts as $forecast)
                    <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td class="py-2 px-3 text-gray-500">{{ $forecast->forecasted_at->format('d.m.Y H:i') }}</td>
                        <td class="py-2 px-3 font-semibold text-primary-600 dark:text-primary-400">{{ $forecast->stock->symbol }}</td>
                        <td class="py-2 px-3 text-right font-mono">₺{{ number_format($forecast->current_price, 2, ',', '.') }}</td>
                        <td class="py-2 px-3 text-right font-mono {{ $forecast->signal === 'BUY' ? 'text-green-600' : 'text-red-600' }}">
                            ₺{{ number_format($forecast->predicted_price, 2, ',', '.') }}
                        </td>
                        <td class="py-2 px-3 text-center">
                            <span class="px-2 py-0.5 rounded-full text-xs font-bold
                                {{ $forecast->signal === 'BUY'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                    : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' }}">
                                {{ $forecast->signal }}
                            </span>
                        </td>
                        <td class="py-2 px-3 text-center">%{{ number_format($forecast->confidence * 100, 0) }}</td>
                        <td class="py-2 px-3 text-center">
                            <span class="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                {{ $forecast->model_used }}
                            </span>
                        </td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
        @else
        <div class="text-center py-8 text-gray-500">
            <x-heroicon-o-clock class="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>Henüz tahmin yapılmamış.</p>
        </div>
        @endif
    </div>

    {{-- Uyarı --}}
    <div class="mt-6 rounded-xl bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800 p-4 flex gap-3 items-start">
        <x-heroicon-o-exclamation-triangle class="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div class="text-sm text-yellow-700 dark:text-yellow-300">
            <strong>Uyarı:</strong> Bu tahminler bir yatırım tavsiyesi değildir. RandomForestRegressor modeli kullanılarak
            geçmiş veriler (RSI, Hareketli Ortalama, Açılış/Kapanış/Yüksek/Düşük) üzerinden hesaplanmıştır.
            Tüm yatırım kararları kendi sorumluluğunuzdadır.
        </div>
    </div>
</x-filament-panels::page>
