<?php

namespace Database\Seeders;

use App\Models\Stock;
use Illuminate\Database\Seeder;

class StockSeeder extends Seeder
{
    public function run(): void
    {
        $stocks = [
            // ── Bankacılık ──
            ['symbol' => 'AKBNK', 'name' => 'Akbank', 'sector' => 'Bankacılık'],
            ['symbol' => 'GARAN', 'name' => 'Garanti BBVA Bankası', 'sector' => 'Bankacılık', 'is_favorite' => true],
            ['symbol' => 'ISCTR', 'name' => 'İş Bankası C', 'sector' => 'Bankacılık'],
            ['symbol' => 'YKBNK', 'name' => 'Yapı Kredi Bankası', 'sector' => 'Bankacılık'],
            ['symbol' => 'HALKB', 'name' => 'Halkbank', 'sector' => 'Bankacılık'],
            ['symbol' => 'VAKBN', 'name' => 'Vakıfbank', 'sector' => 'Bankacılık'],
            ['symbol' => 'SKBNK', 'name' => 'Şekerbank', 'sector' => 'Bankacılık'],
            ['symbol' => 'ALBRK', 'name' => 'Albaraka Türk', 'sector' => 'Bankacılık'],
            ['symbol' => 'TSKB',  'name' => 'TSKB', 'sector' => 'Bankacılık'],
            // ── Holding ──
            ['symbol' => 'SAHOL', 'name' => 'Sabancı Holding', 'sector' => 'Holding'],
            ['symbol' => 'KCHOL', 'name' => 'Koç Holding', 'sector' => 'Holding'],
            ['symbol' => 'DOHOL', 'name' => 'Doğan Holding', 'sector' => 'Holding'],
            ['symbol' => 'SOHOL', 'name' => 'Sönmez Holding', 'sector' => 'Holding', 'is_active' => false],
            ['symbol' => 'TAVHL', 'name' => 'TAV Havalimanları', 'sector' => 'Holding'],
            ['symbol' => 'BERA',  'name' => 'Bera Holding', 'sector' => 'Holding'],
            // ── Havacılık ──
            ['symbol' => 'THYAO', 'name' => 'Türk Hava Yolları', 'sector' => 'Havacılık', 'is_favorite' => true],
            ['symbol' => 'PGSUS', 'name' => 'Pegasus Hava Yolları', 'sector' => 'Havacılık', 'is_favorite' => true],
            ['symbol' => 'CLEBI', 'name' => 'Çelebi Havacılık', 'sector' => 'Havacılık'],
            // ── Demir Çelik ──
            ['symbol' => 'EREGL', 'name' => 'Ereğli Demir Çelik', 'sector' => 'Demir Çelik'],
            ['symbol' => 'KRDMD', 'name' => 'Kardemir D', 'sector' => 'Demir Çelik'],
            ['symbol' => 'ISDMR', 'name' => 'İskenderun Demir', 'sector' => 'Demir Çelik'],
            ['symbol' => 'IZMDC', 'name' => 'İzmir Demir Çelik', 'sector' => 'Demir Çelik'],
            // ── Savunma ──
            ['symbol' => 'ASELS', 'name' => 'ASELSAN', 'sector' => 'Savunma', 'is_favorite' => true],
            ['symbol' => 'HAVELSAN', 'name' => 'HAVELSAN', 'sector' => 'Savunma', 'is_active' => false],
            // ── Otomotiv ──
            ['symbol' => 'TOASO', 'name' => 'Tofaş Otomobil', 'sector' => 'Otomotiv'],
            ['symbol' => 'FROTO', 'name' => 'Ford Otosan', 'sector' => 'Otomotiv', 'is_favorite' => true],
            ['symbol' => 'DOAS',  'name' => 'Doğuş Otomotiv', 'sector' => 'Otomotiv'],
            ['symbol' => 'OTKAR', 'name' => 'Otokar', 'sector' => 'Otomotiv'],
            ['symbol' => 'KARSN', 'name' => 'Karsan Otomotiv', 'sector' => 'Otomotiv'],
            // ── Enerji ──
            ['symbol' => 'TUPRS', 'name' => 'Tüpraş', 'sector' => 'Enerji'],
            ['symbol' => 'AYGAZ', 'name' => 'Aygaz', 'sector' => 'Enerji'],
            ['symbol' => 'AKSEN', 'name' => 'Aksa Enerji', 'sector' => 'Enerji'],
            ['symbol' => 'ODAS',  'name' => 'Odaş Elektrik', 'sector' => 'Enerji'],
            ['symbol' => 'ENKAI', 'name' => 'Enka İnşaat', 'sector' => 'Enerji'],
            ['symbol' => 'ENJSA', 'name' => 'Enerjisa Enerji', 'sector' => 'Enerji'],
            ['symbol' => 'EUPWR', 'name' => 'Europower', 'sector' => 'Enerji'],
            // ── Perakende ──
            ['symbol' => 'BIMAS', 'name' => 'BİM Mağazalar', 'sector' => 'Perakende'],
            ['symbol' => 'MGROS', 'name' => 'Migros', 'sector' => 'Perakende'],
            ['symbol' => 'SOKM',  'name' => 'Şok Marketler', 'sector' => 'Perakende'],
            // ── Gıda / İçecek ──
            ['symbol' => 'ULKER', 'name' => 'Ülker Bisküvi', 'sector' => 'Gıda'],
            ['symbol' => 'BANVT', 'name' => 'Banvit', 'sector' => 'Gıda'],
            ['symbol' => 'TATGD', 'name' => 'Tat Gıda', 'sector' => 'Gıda'],
            ['symbol' => 'OBAMS', 'name' => 'Oba Makarna', 'sector' => 'Gıda'],
            ['symbol' => 'AEFES', 'name' => 'Anadolu Efes', 'sector' => 'İçecek'],
            ['symbol' => 'CCOLA', 'name' => 'Coca-Cola İçecek', 'sector' => 'İçecek'],
            // ── Telekomünikasyon ──
            ['symbol' => 'TCELL', 'name' => 'Turkcell', 'sector' => 'Telekomünikasyon'],
            ['symbol' => 'TTKOM', 'name' => 'Türk Telekom', 'sector' => 'Telekomünikasyon'],
            // ── Cam / Seramik ──
            ['symbol' => 'SISE',  'name' => 'Şişecam', 'sector' => 'Cam'],
            ['symbol' => 'TRKCM', 'name' => 'Trakya Cam', 'sector' => 'Cam', 'is_active' => false],
            ['symbol' => 'KUTPO', 'name' => 'Kütahya Porselen', 'sector' => 'Seramik'],
            ['symbol' => 'KLSER', 'name' => 'Kaleseramik', 'sector' => 'Seramik'],
            // ── Kimya / Petrokimya ──
            ['symbol' => 'PETKM', 'name' => 'Petkim', 'sector' => 'Petrokimya'],
            ['symbol' => 'HEKTS', 'name' => 'Hektaş', 'sector' => 'Kimya'],
            ['symbol' => 'GUBRF', 'name' => 'Gübre Fabrikaları', 'sector' => 'Kimya'],
            ['symbol' => 'BAGFS', 'name' => 'Bandırma Gübre', 'sector' => 'Kimya'],
            ['symbol' => 'SASA',  'name' => 'SASA Polyester', 'sector' => 'Kimya'],
            ['symbol' => 'POLHO', 'name' => 'Polisan Holding', 'sector' => 'Kimya'],
            // ── GYO / İnşaat ──
            ['symbol' => 'EKGYO', 'name' => 'Emlak Konut GYO', 'sector' => 'GYO'],
            ['symbol' => 'ISGYO', 'name' => 'İş GYO', 'sector' => 'GYO'],
            ['symbol' => 'KLGYO', 'name' => 'Kiler GYO', 'sector' => 'GYO'],
            ['symbol' => 'IHLGM', 'name' => 'İhlas Gayrimenkul', 'sector' => 'GYO'],
            ['symbol' => 'BIENY', 'name' => 'Bien Yapı', 'sector' => 'İnşaat'],
            // ── Beyaz Eşya / Elektronik ──
            ['symbol' => 'ARCLK', 'name' => 'Arçelik', 'sector' => 'Beyaz Eşya'],
            ['symbol' => 'VESBE', 'name' => 'Vestel Beyaz Eşya', 'sector' => 'Beyaz Eşya'],
            ['symbol' => 'VESTL', 'name' => 'Vestel Elektronik', 'sector' => 'Elektronik'],
            // ── Madencilik ──
            ['symbol' => 'KOZAL', 'name' => 'Koza Altın', 'sector' => 'Madencilik', 'is_active' => false],
            ['symbol' => 'KOZAA', 'name' => 'Koza Anadolu Metal', 'sector' => 'Madencilik', 'is_active' => false],
            ['symbol' => 'IPEKE', 'name' => 'İpek Doğal Enerji', 'sector' => 'Madencilik', 'is_active' => false],
            // ── Sigorta ──
            ['symbol' => 'ANHYT', 'name' => 'Anadolu Hayat', 'sector' => 'Sigorta'],
            ['symbol' => 'AKGRT', 'name' => 'Aksigorta', 'sector' => 'Sigorta'],
            ['symbol' => 'TURSG', 'name' => 'Türkiye Sigorta', 'sector' => 'Sigorta'],
            // ── Tekstil / Lastik ──
            ['symbol' => 'MAVI',  'name' => 'Mavi Giyim', 'sector' => 'Tekstil'],
            ['symbol' => 'BRISA', 'name' => 'Brisa', 'sector' => 'Lastik'],
            ['symbol' => 'SUNTK', 'name' => 'Sunteks', 'sector' => 'Tekstil'],
            // ── Çimento ──
            ['symbol' => 'CIMSA', 'name' => 'Çimsa', 'sector' => 'Çimento'],
            ['symbol' => 'BOLUC', 'name' => 'Bolu Çimento', 'sector' => 'Çimento', 'is_active' => false],
            ['symbol' => 'ADANA', 'name' => 'Adana Çimento', 'sector' => 'Çimento', 'is_active' => false],
            ['symbol' => 'OYAKC', 'name' => 'Oyak Çimento', 'sector' => 'Çimento'],
            ['symbol' => 'BTCIM', 'name' => 'Batıçim', 'sector' => 'Çimento'],
            ['symbol' => 'BUCIM', 'name' => 'Bursa Çimento', 'sector' => 'Çimento'],
            // ── Sağlık ──
            ['symbol' => 'SELEC', 'name' => 'Selçuk Ecza Deposu', 'sector' => 'Sağlık'],
            ['symbol' => 'MPARK', 'name' => 'MLP Sağlık', 'sector' => 'Sağlık'],
            // ── Sanayi / Makine ──
            ['symbol' => 'KORDS', 'name' => 'Kordsa', 'sector' => 'Sanayi'],
            ['symbol' => 'TTRAK', 'name' => 'Türk Traktör', 'sector' => 'Tarım Makineleri'],
            ['symbol' => 'TMSN',  'name' => 'Tümosan', 'sector' => 'Tarım Makineleri'],
            ['symbol' => 'EGEEN', 'name' => 'Ege Endüstri', 'sector' => 'Sanayi'],
            ['symbol' => 'GESAN', 'name' => 'GE Sanayi', 'sector' => 'Sanayi'],
            // ── Teknoloji ──
            ['symbol' => 'LOGO',  'name' => 'Logo Yazılım', 'sector' => 'Teknoloji'],
            ['symbol' => 'NETAS', 'name' => 'Netaş', 'sector' => 'Teknoloji'],
            ['symbol' => 'KAREL', 'name' => 'Karel Elektronik', 'sector' => 'Teknoloji'],
            ['symbol' => 'KONTR', 'name' => 'Kontrolmatik', 'sector' => 'Teknoloji'],
            // ── Finans ──
            ['symbol' => 'ISMEN', 'name' => 'İş Yatırım', 'sector' => 'Finans'],
            ['symbol' => 'GLYHO', 'name' => 'Global Yatırım Holding', 'sector' => 'Finans'],
            // ── Diğer ──
            ['symbol' => 'PRKAB', 'name' => 'Türk Prysmian Kablo', 'sector' => 'Elektrik'],
            ['symbol' => 'SARKY', 'name' => 'Sarkuysan', 'sector' => 'Metal'],
            ['symbol' => 'YATAS', 'name' => 'Yataş', 'sector' => 'Mobilya'],
            ['symbol' => 'BRLSM', 'name' => 'Birleşim Mühendislik', 'sector' => 'Mühendislik'],
        ];

        foreach ($stocks as $stock) {
            Stock::updateOrCreate(
                ['symbol' => $stock['symbol']],
                array_merge($stock, [
                    'is_active' => true,
                    'is_favorite' => $stock['is_favorite'] ?? false,
                ])
            );
        }
    }
}
