-- =====================================================
-- BIST 100 Hisseleri — Eksik olanları ekle
-- Mevcut DB'ye çalıştır: docker compose exec -T postgres psql -U bist_admin -d bist_trading -f /docker-entrypoint-initdb.d/migrate_bist100.sql
-- VEYA: docker compose exec -T postgres psql -U bist_admin -d bist_trading < database/migrate_bist100.sql
-- =====================================================

INSERT INTO stocks (symbol, name, sector, is_active, is_favorite) VALUES
    -- Bankacılık
    ('AKBNK', 'Akbank',               'Bankacılık',    TRUE, FALSE),
    ('GARAN', 'Garanti BBVA Bankası', 'Bankacılık',    TRUE, TRUE),
    ('ISCTR', 'İş Bankası C',         'Bankacılık',    TRUE, FALSE),
    ('YKBNK', 'Yapı Kredi Bankası',   'Bankacılık',    TRUE, FALSE),
    ('HALKB', 'Halkbank',             'Bankacılık',    TRUE, FALSE),
    ('VAKBN', 'Vakıfbank',            'Bankacılık',    TRUE, FALSE),
    ('SKBNK', 'Şekerbank',            'Bankacılık',    TRUE, FALSE),
    ('ALBRK', 'Albaraka Türk',        'Bankacılık',    TRUE, FALSE),
    ('TSKB',  'TSKB',                 'Bankacılık',    TRUE, FALSE),
    -- Holding
    ('SAHOL', 'Sabancı Holding',      'Holding',       TRUE, FALSE),
    ('KCHOL', 'Koç Holding',          'Holding',       TRUE, FALSE),
    ('DOHOL', 'Doğan Holding',        'Holding',       TRUE, FALSE),
    ('SOHOL', 'Sönmez Holding',       'Holding',       TRUE, FALSE),
    ('TAVHL', 'TAV Havalimanları',    'Holding',       TRUE, FALSE),
    -- Havacılık
    ('THYAO', 'Türk Hava Yolları',    'Havacılık',     TRUE, TRUE),
    ('PGSUS', 'Pegasus Hava Yolları', 'Havacılık',     TRUE, TRUE),
    ('CLEBI', 'Çelebi Havacılık',     'Havacılık',     TRUE, FALSE),
    -- Demir Çelik
    ('EREGL', 'Ereğli Demir Çelik',   'Demir Çelik',   TRUE, FALSE),
    ('KRDMD', 'Kardemir D',           'Demir Çelik',   TRUE, FALSE),
    ('ISDMR', 'İskenderun Demir',     'Demir Çelik',   TRUE, FALSE),
    -- Savunma
    ('ASELS', 'ASELSAN',              'Savunma',       TRUE, TRUE),
    ('HAVELSAN', 'HAVELSAN',          'Savunma',       TRUE, FALSE),
    -- Otomotiv
    ('TOASO', 'Tofaş Otomobil',       'Otomotiv',      TRUE, FALSE),
    ('FROTO', 'Ford Otosan',           'Otomotiv',      TRUE, TRUE),
    ('DOAS',  'Doğuş Otomotiv',       'Otomotiv',      TRUE, FALSE),
    ('OTKAR', 'Otokar',               'Otomotiv',      TRUE, FALSE),
    -- Enerji
    ('TUPRS', 'Tüpraş',               'Enerji',        TRUE, FALSE),
    ('AYGAZ', 'Aygaz',                'Enerji',        TRUE, FALSE),
    ('AKSEN', 'Aksa Enerji',          'Enerji',        TRUE, FALSE),
    ('ODAS',  'Odaş Elektrik',        'Enerji',        TRUE, FALSE),
    ('ENKAI', 'Enka İnşaat',          'Enerji',        TRUE, FALSE),
    -- Perakende / Gıda
    ('BIMAS', 'BİM Mağazalar',        'Perakende',     TRUE, FALSE),
    ('MGROS', 'Migros',               'Perakende',     TRUE, FALSE),
    ('SOKM',  'Şok Marketler',        'Perakende',     TRUE, FALSE),
    ('ULKER', 'Ülker Bisküvi',        'Gıda',          TRUE, FALSE),
    ('BANVT', 'Banvit',               'Gıda',          TRUE, FALSE),
    ('TATGD', 'Tat Gıda',             'Gıda',          TRUE, FALSE),
    -- Telekomünikasyon
    ('TCELL', 'Turkcell',             'Telekomünikasyon', TRUE, FALSE),
    ('TTKOM', 'Türk Telekom',         'Telekomünikasyon', TRUE, FALSE),
    -- Cam / Seramik
    ('SISE',  'Şişecam',              'Cam',           TRUE, FALSE),
    ('TRKCM', 'Trakya Cam',           'Cam',           TRUE, FALSE),
    ('KUTPO', 'Kütahya Porselen',     'Seramik',       TRUE, FALSE),
    -- Kimya / Petrokimya
    ('PETKM', 'Petkim',               'Petrokimya',    TRUE, FALSE),
    ('HEKTS', 'Hektaş',               'Kimya',         TRUE, FALSE),
    ('GUBRF', 'Gübre Fabrikaları',    'Kimya',         TRUE, FALSE),
    ('BAGFS', 'Bandırma Gübre',       'Kimya',         TRUE, FALSE),
    -- GYO / İnşaat
    ('EKGYO', 'Emlak Konut GYO',      'GYO',           TRUE, FALSE),
    ('ISGYO', 'İş GYO',               'GYO',           TRUE, FALSE),
    ('KLGYO', 'Kiler GYO',            'GYO',           TRUE, FALSE),
    -- Beyaz Eşya / Elektronik
    ('ARCLK', 'Arçelik',              'Beyaz Eşya',    TRUE, FALSE),
    ('VESBE', 'Vestel Beyaz Eşya',    'Beyaz Eşya',    TRUE, FALSE),
    ('VESTL', 'Vestel Elektronik',    'Elektronik',    TRUE, FALSE),
    -- Madencilik
    ('KOZAL', 'Koza Altın',           'Madencilik',    TRUE, FALSE),
    ('KOZAA', 'Koza Anadolu Metal',   'Madencilik',    TRUE, FALSE),
    ('IPEKE', 'İpek Doğal Enerji',   'Madencilik',    TRUE, FALSE),
    -- Sigorta
    ('ANHYT', 'Anadolu Hayat',        'Sigorta',       TRUE, FALSE),
    ('AKGRT', 'Aksigorta',            'Sigorta',       TRUE, FALSE),
    -- Tekstil / Lastik
    ('MAVI',  'Mavi Giyim',           'Tekstil',       TRUE, FALSE),
    ('BRISA', 'Brisa',                'Lastik',        TRUE, FALSE),
    -- Çimento
    ('CIMSA', 'Çimsa',                'Çimento',       TRUE, FALSE),
    ('BOLUC', 'Bolu Çimento',         'Çimento',       TRUE, FALSE),
    ('ADANA', 'Adana Çimento',        'Çimento',       TRUE, FALSE),
    -- Sağlık
    ('SELEC', 'Selçuk Ecza Deposu',  'Sağlık',        TRUE, FALSE),
    -- Sanayi
    ('KORDS', 'Kordsa',               'Sanayi',        TRUE, FALSE),
    ('SUNTK', 'Sunteks',              'Tekstil',       TRUE, FALSE),
    ('TTRAK', 'Türk Traktör',        'Tarım Makineleri', TRUE, FALSE),
    ('IHLGM', 'İhlas Gayrimenkul',   'GYO',           TRUE, FALSE),
    ('EGEEN', 'Ege Endüstri',        'Sanayi',        TRUE, FALSE),
    -- İçecek
    ('AEFES', 'Anadolu Efes',         'İçecek',        TRUE, FALSE),
    ('CCOLA', 'Coca-Cola İçecek',    'İçecek',        TRUE, FALSE),
    -- Teknoloji
    ('LOGO',  'Logo Yazılım',        'Teknoloji',     TRUE, FALSE),
    ('NETAS', 'Netaş',               'Teknoloji',     TRUE, FALSE),
    ('KAREL', 'Karel Elektronik',     'Teknoloji',     TRUE, FALSE),
    -- Diğer
    ('SASA',  'SASA Polyester',       'Kimya',         TRUE, FALSE),
    ('ENJSA', 'Enerjisa Enerji',     'Enerji',        TRUE, FALSE),
    ('GESAN', 'GE Sanayi',           'Sanayi',        TRUE, FALSE),
    ('KONTR', 'Kontrolmatik',         'Teknoloji',     TRUE, FALSE),
    ('OYAKC', 'Oyak Çimento',        'Çimento',       TRUE, FALSE),
    ('POLHO', 'Polisan Holding',      'Kimya',         TRUE, FALSE),
    ('ISMEN', 'İş Yatırım',          'Finans',        TRUE, FALSE),
    ('GLYHO', 'Global Yatırım Holding', 'Finans',     TRUE, FALSE),
    ('KARSN', 'Karsan Otomotiv',      'Otomotiv',      TRUE, FALSE),
    ('BERA',  'Bera Holding',         'Holding',       TRUE, FALSE),
    ('MPARK', 'MLP Sağlık',          'Sağlık',        TRUE, FALSE),
    ('OBAMS', 'Oba Makarna',          'Gıda',          TRUE, FALSE),
    ('TURSG', 'Türkiye Sigorta',     'Sigorta',       TRUE, FALSE),
    ('EUPWR', 'Europower',            'Enerji',        TRUE, FALSE),
    ('BIENY', 'Bien Yapı',           'İnşaat',        TRUE, FALSE),
    ('BTCIM', 'Batıçim',             'Çimento',       TRUE, FALSE),
    ('YATAS', 'Yataş',               'Mobilya',       TRUE, FALSE),
    ('TMSN',  'Tümosan',              'Tarım Makineleri', TRUE, FALSE),
    ('BRLSM', 'Birleşim Mühendislik', 'Mühendislik', TRUE, FALSE),
    ('BUCIM', 'Bursa Çimento',        'Çimento',       TRUE, FALSE),
    ('IZMDC', 'İzmir Demir Çelik',   'Demir Çelik',   TRUE, FALSE),
    ('KLSER', 'Kaleseramik',          'Seramik',       TRUE, FALSE),
    ('PRKAB', 'Türk Prysmian Kablo', 'Elektrik',      TRUE, FALSE),
    ('SARKY', 'Sarkuysan',            'Metal',         TRUE, FALSE)
ON CONFLICT (symbol) DO NOTHING;
