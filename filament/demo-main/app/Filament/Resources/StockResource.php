<?php

namespace App\Filament\Resources;

use App\Filament\Resources\StockResource\Pages\CreateStock;
use App\Filament\Resources\StockResource\Pages\EditStock;
use App\Filament\Resources\StockResource\Pages\ListStocks;
use App\Filament\Resources\StockResource\Pages\ViewStock;
use App\Models\Stock;
use BackedEnum;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use UnitEnum;

class StockResource extends Resource
{
	protected static ?string $model = Stock::class;

	protected static ?string $slug = 'stocks';

	protected static ?string $recordTitleAttribute = 'symbol';

	protected static string | UnitEnum | null $navigationGroup = 'BIST AI';

	protected static string | BackedEnum | null $navigationIcon = 'heroicon-o-chart-bar';

	protected static ?int $navigationSort = 1;

	public static function form(Schema $schema): Schema
	{
		return $schema
			->components([
				TextInput::make('symbol')
					->required()
					->maxLength(10)
					->unique(ignoreRecord: true),

				TextInput::make('name')
					->required()
					->maxLength(255),

				TextInput::make('sector')
					->maxLength(100),

				Toggle::make('is_active')
					->default(true),

				Toggle::make('is_favorite')
					->default(false),
			]);
	}

	public static function table(Table $table): Table
	{
		return $table
			->columns([
				TextColumn::make('symbol')
					->searchable()
					->sortable()
					->weight('bold'),

				TextColumn::make('name')
					->searchable()
					->sortable(),

				TextColumn::make('sector')
					->searchable()
					->sortable(),

				TextColumn::make('current_price')
					->label('Fiyat')
					->money('TRY')
					->sortable(),

				IconColumn::make('is_active')
					->boolean()
					->label('Aktif'),

				IconColumn::make('is_favorite')
					->boolean()
					->label('Favori'),

				TextColumn::make('last_synced_at')
					->dateTime('d.m.Y H:i')
					->sortable(),
			]);
	}

	public static function getRelations(): array
	{
		return [];
	}

	public static function getPages(): array
	{
		return [
			'index' => ListStocks::route('/'),
			'create' => CreateStock::route('/create'),
			'view' => ViewStock::route('/{record}'),
			'edit' => EditStock::route('/{record}/edit'),
		];
	}
}
