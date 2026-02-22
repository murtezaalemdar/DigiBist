<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockForecast extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_id',
        'current_price',
        'predicted_price',
        'signal',
        'confidence',
        'change_percent',
        'model_used',
        'raw_response',
        'forecasted_at',
    ];

    protected $casts = [
        'current_price' => 'decimal:2',
        'predicted_price' => 'decimal:2',
        'confidence' => 'decimal:2',
        'change_percent' => 'decimal:2',
        'raw_response' => 'array',
        'forecasted_at' => 'datetime',
    ];

    // İlişkiler
    public function stock(): BelongsTo
    {
        return $this->belongsTo(Stock::class);
    }

    // Helpers
    public function getFormattedCurrentPriceAttribute(): string
    {
        return '₺' . number_format($this->current_price, 2, ',', '.');
    }

    public function getFormattedPredictedPriceAttribute(): string
    {
        return '₺' . number_format($this->predicted_price, 2, ',', '.');
    }

    public function getConfidencePercentAttribute(): string
    {
        return '%' . number_format($this->confidence * 100, 0);
    }

    public function getIsBuyAttribute(): bool
    {
        return $this->signal === 'BUY';
    }

    public function getChangeDirectionAttribute(): string
    {
        return $this->predicted_price > $this->current_price ? 'up' : 'down';
    }

    public function getFormattedChangePercentAttribute(): string
    {
        $percent = (($this->predicted_price - $this->current_price) / $this->current_price) * 100;
        $prefix = $percent >= 0 ? '+' : '';
        return $prefix . number_format($percent, 2) . '%';
    }
}
