<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use App\Models\StockForecast;

class Stock extends Model
{
    use HasFactory;

    protected $fillable = [
        'symbol',
        'name',
        'sector',
        'current_price',
        'change_percent',
        'is_active',
        'is_favorite',
        'last_synced_at',
    ];

    protected $casts = [
        'current_price' => 'decimal:2',
        'change_percent' => 'decimal:2',
        'is_active' => 'boolean',
        'is_favorite' => 'boolean',
        'last_synced_at' => 'datetime',
    ];

    // İlişkiler
    public function forecasts(): HasMany
    {
        return $this->hasMany(StockForecast::class)->orderByDesc('forecasted_at');
    }

    public function latestForecast(): HasOne
    {
        return $this->hasOne(StockForecast::class)->latestOfMany('forecasted_at');
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeFavorite($query)
    {
        return $query->where('is_favorite', true);
    }

    // Helpers
    public function getFormattedPriceAttribute(): string
    {
        return '₺' . number_format($this->current_price, 2, ',', '.');
    }

    public function getSignalBadgeAttribute(): ?string
    {
        return $this->latestForecast?->signal;
    }

    public function getYahooSymbolAttribute(): string
    {
        return $this->symbol . '.IS';
    }
}
