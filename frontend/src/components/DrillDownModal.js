import React from 'react';
import { X, TrendingUp, BarChart3, Activity, Settings, Database, Target, ExternalLink } from 'lucide-react';

const DrillDownModal = ({ isOpen, onClose, type, data }) => {
  if (!isOpen || !data) return null;

  const drill = data.drill_down || {};

  const renderContent = () => {
    switch (type) {
      case 'directional':
        return <DirectionalDetail data={data} drill={drill} />;
      case 'cv_r2':
        return <CVDetail data={data} drill={drill} />;
      case 'rsi':
        return <RSIDetail data={data} drill={drill} />;
      case 'features':
        return <FeaturesDetail data={data} drill={drill} />;
      case 'training':
        return <TrainingDetail data={data} drill={drill} />;
      case 'kelly':
        return <KellyDetail data={data} />;
      default:
        return null;
    }
  };

  const titles = {
    directional: { icon: <TrendingUp size={18} />, title: 'Yönsel Doğruluk Detayı' },
    cv_r2: { icon: <BarChart3 size={18} />, title: 'CV R² Skoru Detayı' },
    rsi: { icon: <Activity size={18} />, title: 'RSI (14) Detayı' },
    features: { icon: <Settings size={18} />, title: 'Kullanılan Göstergeler' },
    training: { icon: <Database size={18} />, title: 'Eğitim Verisi Detayı' },
    kelly: { icon: <Target size={18} />, title: 'Kelly Criterion Pozisyon Raporu' },
  };

  const { icon, title } = titles[type] || { icon: null, title: '' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-[#0f1729] border border-white/10 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3 text-blue-400">
            {icon}
            <h3 className="text-lg font-bold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>
        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[calc(80vh-70px)] custom-scrollbar">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

/* ─── Yönsel Doğruluk ─── */
const DirectionalDetail = ({ data, drill }) => {
  const folds = drill.directional_folds || [];
  const totalCorrect = folds.reduce((s, f) => s + f.correct, 0);
  const totalAll = folds.reduce((s, f) => s + f.total, 0);

  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-xl p-4">
        <p className="text-sm text-slate-400 mb-2">
          Walk-Forward Validation, modeli geçmiş verilerle eğitip gelecek verilerde test eder.
          Her fold'da model, fiyat yönünü (yukarı/aşağı) ne kadar doğru bildi?
        </p>
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold ${data.directional_accuracy >= 0.6 ? 'text-green-400' : data.directional_accuracy >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
            %{Math.round(data.directional_accuracy * 100)}
          </span>
          <span className="text-slate-500 text-sm">
            ({totalCorrect} doğru / {totalAll} toplam tahmin)
          </span>
        </div>
      </div>

      {folds.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-300 mb-3">Fold Bazlı Sonuçlar</h4>
          <div className="space-y-2">
            {folds.map((fold) => (
              <div key={fold.fold} className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-slate-300">Fold {fold.fold}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    ({fold.train_size} eğitim → {fold.test_size} test)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-white/5 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${fold.accuracy >= 0.6 ? 'bg-green-500' : fold.accuracy >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${fold.accuracy * 100}%` }}
                    />
                  </div>
                  <span className={`text-sm font-bold min-w-[45px] text-right ${fold.accuracy >= 0.6 ? 'text-green-400' : fold.accuracy >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                    %{Math.round(fold.accuracy * 100)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300/80">
        <strong>Ne anlama gelir?</strong> %60 üzeri iyi, %50 yazı-tura gibi, %50 altı modelin ters sinyal ürettiği anlamına gelir.
      </div>
    </div>
  );
};

/* ─── CV R² Skoru ─── */
const CVDetail = ({ data, drill }) => {
  const foldDetails = drill.cv_fold_details || {};

  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-xl p-4">
        <p className="text-sm text-slate-400 mb-2">
          R² (determinasyon katsayısı), modelin veriyi ne kadar iyi açıkladığını gösterir.
          1.0 = mükemmel, 0 = rastgele, negatif = rastgeleden kötü.
        </p>
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold ${data.cv_r2 >= 0.5 ? 'text-green-400' : data.cv_r2 >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
            {data.cv_r2?.toFixed(4)}
          </span>
          <span className="text-slate-500 text-sm">
            ({data.model_name} — en iyi model)
          </span>
        </div>
      </div>

      {Object.keys(foldDetails).length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-300 mb-3">Model Karşılaştırması (Fold Bazlı)</h4>
          <div className="space-y-3">
            {Object.entries(foldDetails).map(([name, foldsArr]) => (
              <div key={name} className="bg-white/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold ${name === data.model_name ? 'text-blue-400' : 'text-slate-300'}`}>
                    {name} {name === data.model_name && '⭐'}
                  </span>
                  <span className={`text-sm font-bold ${(data.cv_scores?.[name] || 0) >= 0.5 ? 'text-green-400' : (data.cv_scores?.[name] || 0) >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    Ort: {data.cv_scores?.[name]?.toFixed(4)}
                  </span>
                </div>
                <div className="flex gap-2">
                  {foldsArr.map((score, i) => (
                    <div key={i} className="flex-1 bg-white/5 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-slate-500 mb-1">F{i + 1}</div>
                      <div className={`text-xs font-bold ${score >= 0.5 ? 'text-green-400' : score >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {score.toFixed(3)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300/80">
        <strong>Nasıl değerlendirilir?</strong> R² ≥ 0.7 mükemmel, ≥ 0.5 iyi, &lt; 0.5 zayıf, &lt; 0 modelin işe yaramadığı anlamına gelir.
      </div>
    </div>
  );
};

/* ─── RSI ─── */
const RSIDetail = ({ data, drill }) => {
  const history = drill.rsi_history || [];
  const maxRSI = Math.max(...history.map((h) => h.value), 0);
  const minRSI = Math.min(...history.map((h) => h.value), 100);

  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-xl p-4">
        <p className="text-sm text-slate-400 mb-2">
          RSI (Relative Strength Index), bir hissenin aşırı alım veya aşırı satım bölgesinde olup olmadığını gösterir.
        </p>
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold ${data.rsi > 70 ? 'text-red-400' : data.rsi < 30 ? 'text-green-400' : 'text-slate-300'}`}>
            {data.rsi}
          </span>
          <span className="text-slate-500 text-sm">
            {data.rsi > 70 ? '🔴 Aşırı Alım Bölgesi' : data.rsi < 30 ? '🟢 Aşırı Satım Bölgesi' : '⚪ Nötr Bölge'}
          </span>
        </div>
      </div>

      {/* RSI Gauge */}
      <div className="bg-white/5 rounded-xl p-4">
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span>0 (Aşırı Satım)</span>
          <span>50 (Nötr)</span>
          <span>100 (Aşırı Alım)</span>
        </div>
        <div className="relative w-full h-4 rounded-full overflow-hidden bg-gradient-to-r from-green-600 via-slate-600 to-red-600">
          <div
            className="absolute top-0 w-1 h-4 bg-white shadow-lg shadow-white/50 rounded-full"
            style={{ left: `${data.rsi}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <div className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400">0-30: AL fırsatı</div>
          <div className="text-[10px] px-2 py-0.5 rounded bg-slate-500/20 text-slate-400">30-70: Nötr</div>
          <div className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400">70-100: SAT sinyali</div>
        </div>
      </div>

      {/* RSI Geçmişi (tablo) */}
      {history.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-300 mb-3">Son 20 Günlük RSI</h4>
          <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
            {history.slice().reverse().map((h, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-1.5">
                <span className="text-xs text-slate-500">{h.date}</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${h.value > 70 ? 'bg-red-500' : h.value < 30 ? 'bg-green-500' : 'bg-slate-500'}`}
                      style={{ width: `${h.value}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold min-w-[35px] text-right ${h.value > 70 ? 'text-red-400' : h.value < 30 ? 'text-green-400' : 'text-slate-400'}`}>
                    {h.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Kullanılan Göstergeler (Features) ─── */
const FeaturesDetail = ({ data, drill }) => {
  const features = drill.feature_importances || [];
  const topN = features.slice(0, 15);
  const rest = features.slice(15);

  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-xl p-4">
        <p className="text-sm text-slate-400 mb-1">
          Model <strong className="text-white">{data.features_used}</strong> teknik gösterge kullanarak karar veriyor.
          En önemli göstergeler modelin tahmininde en çok ağırlığa sahip olanlar.
        </p>
      </div>

      {topN.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-300 mb-3">
            En Önemli {Math.min(15, features.length)} Gösterge
          </h4>
          <div className="space-y-1.5">
            {topN.map((f, i) => {
              const maxImp = topN[0]?.importance || 1;
              const pct = (f.importance / maxImp) * 100;
              return (
                <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                  <span className="text-[10px] text-slate-600 font-mono w-5">{i + 1}</span>
                  <span className="text-xs text-slate-300 flex-1 truncate font-mono">{f.name}</span>
                  <div className="w-24 bg-white/5 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${i < 3 ? 'bg-blue-500' : i < 7 ? 'bg-blue-400/60' : 'bg-slate-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 min-w-[50px] text-right">
                    {(f.importance * 100).toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div className="bg-white/5 rounded-xl p-3 text-xs text-slate-500">
          <strong>+{rest.length} düşük öneme sahip gösterge daha</strong>
          {data.low_importance_features > 0 && (
            <span className="ml-1">({data.low_importance_features} tanesi %0.5 altında etki)</span>
          )}
        </div>
      )}

      {data.top_features && data.top_features.length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300/80">
          <strong>Kümülatif %90 açıklama:</strong> {data.top_features.join(', ')}
        </div>
      )}
    </div>
  );
};

/* ─── Eğitim Verisi ─── */
const TrainingDetail = ({ data, drill }) => {
  const dateRange = drill.training_date_range || {};

  return (
    <div className="space-y-4">
      <div className="bg-white/5 rounded-xl p-4">
        <p className="text-sm text-slate-400 mb-2">
          Model, geçmiş fiyat verilerinden öğrenir. Daha fazla veri genellikle daha güvenilir sonuçlar verir,
          ancak çok eski veriler güncel piyasa koşullarını yansıtmayabilir.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 rounded-xl p-4 text-center">
          <div className="text-[10px] text-slate-500 uppercase mb-1">İşlem Günü</div>
          <div className="text-2xl font-bold text-white">{data.training_samples}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-4 text-center">
          <div className="text-[10px] text-slate-500 uppercase mb-1">Gösterge Sayısı</div>
          <div className="text-2xl font-bold text-white">{data.features_used}</div>
        </div>
      </div>

      {dateRange.start && dateRange.end && (
        <div className="bg-white/5 rounded-xl p-4">
          <h4 className="text-sm font-bold text-slate-300 mb-2">Veri Aralığı</h4>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-500">Başlangıç</div>
              <div className="text-sm font-bold text-slate-300">{dateRange.start}</div>
            </div>
            <div className="text-slate-600">→</div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500">Bitiş</div>
              <div className="text-sm font-bold text-slate-300">{dateRange.end}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/5 rounded-xl p-4">
        <h4 className="text-sm font-bold text-slate-300 mb-2">Cross-Validation Yapısı</h4>
        <p className="text-xs text-slate-400 mb-2">TimeSeriesSplit ile 3 fold kullanılıyor:</p>
        <div className="space-y-2">
          {(drill.directional_folds || []).map((fold) => (
            <div key={fold.fold} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 w-12">Fold {fold.fold}</span>
              <div className="flex-1 flex h-3 rounded-full overflow-hidden bg-white/5">
                <div
                  className="bg-blue-500/40 h-full"
                  style={{ width: `${(fold.train_size / (fold.train_size + fold.test_size)) * 100}%` }}
                  title={`Eğitim: ${fold.train_size} gün`}
                />
                <div
                  className="bg-green-500/40 h-full"
                  style={{ width: `${(fold.test_size / (fold.train_size + fold.test_size)) * 100}%` }}
                  title={`Test: ${fold.test_size} gün`}
                />
              </div>
              <span className="text-[10px] text-slate-500 min-w-[80px]">
                {fold.train_size}+{fold.test_size} gün
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded bg-blue-500/40" /> Eğitim
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-2 rounded bg-green-500/40" /> Test
          </span>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300/80">
        <strong>Veri kaynağı:</strong> Yahoo Finance (günlük kapanış fiyatları, son 2 yıl)
      </div>
    </div>
  );
};

/* ─── Kelly Criterion Pozisyon Detayı ─── */
const KellyDetail = ({ data }) => {
  const kellyFraction = data.kelly_fraction || 0;
  const positionSize = data.kelly_position_size || 0;
  const positionPct = data.kelly_position_pct || 0;
  const kellyReason = data.kelly_reason || '';
  const winRate = data.win_rate || 0;
  const avgWin = data.avg_win || 0;
  const avgLoss = data.avg_loss || 0;

  // Hesaplamalar
  const b = avgLoss > 0 ? avgWin / avgLoss : 0;
  const p = winRate;
  const q = 1 - p;
  const kellyFull = b > 0 ? (p * b - q) / b : 0;
  const edge = p * b - q;
  const portfolioValue = 250000;
  const isPositive = kellyFraction > 0;

  // Seviye belirleme
  const getKellyLevel = () => {
    if (!isPositive) return { label: 'İşlem Önerilmiyor', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    if (positionPct >= 15) return { label: 'Agresif Pozisyon', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
    if (positionPct >= 8) return { label: 'Orta Pozisyon', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
    return { label: 'Muhafazakâr Pozisyon', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' };
  };
  const level = getKellyLevel();

  return (
    <div className="space-y-4">
      {/* Özet Kutu */}
      <div className={`${level.bg} border ${level.border} rounded-xl p-4`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm font-bold ${level.color}`}>{level.label}</span>
          <span className="text-xs text-slate-500">{data.symbol}</span>
        </div>
        {isPositive ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">%{positionPct}</div>
              <div className="text-[10px] text-slate-500 mt-1">Portföy Payı (Half-Kelly)</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-200">₺{positionSize.toLocaleString('tr-TR')}</div>
              <div className="text-[10px] text-slate-500 mt-1">Önerilen Pozisyon Tutarı</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-400">{kellyReason || 'Kelly negatif — işlem önerilmiyor.'}</p>
        )}
      </div>

      {/* Strateji İstatistikleri */}
      <div>
        <h4 className="text-sm font-bold text-slate-300 mb-3">📊 Strateji İstatistikleri</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Kazanma Oranı</div>
            <div className={`text-xl font-bold ${winRate >= 0.55 ? 'text-green-400' : winRate >= 0.45 ? 'text-yellow-400' : 'text-red-400'}`}>
              %{Math.round(winRate * 100)}
            </div>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mt-2">
              <div className={`h-full rounded-full ${winRate >= 0.55 ? 'bg-green-500' : winRate >= 0.45 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${winRate * 100}%` }} />
            </div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Ort. Kazanç</div>
            <div className="text-xl font-bold text-green-400">%{(avgWin * 100).toFixed(2)}</div>
            <div className="text-[10px] text-slate-600 mt-2">İşlem başına</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Ort. Kayıp</div>
            <div className="text-xl font-bold text-red-400">%{(avgLoss * 100).toFixed(2)}</div>
            <div className="text-[10px] text-slate-600 mt-2">İşlem başına</div>
          </div>
        </div>
      </div>

      {/* Kelly Formülü & Hesaplama */}
      <div>
        <h4 className="text-sm font-bold text-slate-300 mb-3">🧮 Kelly Criterion Hesaplaması</h4>
        <div className="bg-white/5 rounded-xl p-4 space-y-3">
          {/* Formül */}
          <div className="bg-black/30 rounded-lg p-3 text-center">
            <div className="text-xs text-slate-500 mb-1">Kelly Formülü</div>
            <div className="text-sm font-mono text-blue-300">f* = (p × b − q) / b</div>
          </div>
          {/* Değişkenler */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">p (kazanma olasılığı)</span>
              <span className="font-bold text-slate-300">{winRate.toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">q (kaybetme olasılığı = 1 − p)</span>
              <span className="font-bold text-slate-300">{q.toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">b (kazanç/kayıp oranı = avg_win / avg_loss)</span>
              <span className="font-bold text-slate-300">{b.toFixed(4)}</span>
            </div>
            <div className="border-t border-white/5 pt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Full Kelly (f*)</span>
              <span className={`font-bold ${kellyFull > 0 ? 'text-blue-400' : 'text-red-400'}`}>{(kellyFull * 100).toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Half-Kelly (f* × 0.5) — Muhafazakâr</span>
              <span className={`font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>{(kellyFraction * 100).toFixed(2)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Edge (Avantaj = p × b − q)</span>
              <span className={`font-bold ${edge > 0 ? 'text-green-400' : 'text-red-400'}`}>{(edge * 100).toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pozisyon Gauge */}
      {isPositive && (
        <div>
          <h4 className="text-sm font-bold text-slate-300 mb-3">📏 Pozisyon Büyüklüğü Skalası</h4>
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
              <span>%0</span>
              <span>%5</span>
              <span>%10</span>
              <span>%15</span>
              <span>%20 (Maks.)</span>
            </div>
            <div className="relative w-full h-5 rounded-full overflow-hidden bg-gradient-to-r from-green-600/30 via-blue-600/30 to-orange-600/30">
              <div
                className="absolute top-0 h-5 rounded-full bg-blue-500/50"
                style={{ width: `${Math.min((positionPct / 20) * 100, 100)}%` }}
              />
              <div
                className="absolute top-0 w-1.5 h-5 bg-white shadow-lg shadow-white/50 rounded-full"
                style={{ left: `${Math.min((positionPct / 20) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <div className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400">0-5: Muhafazakâr</div>
              <div className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">5-10: Orta</div>
              <div className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">10-20: Agresif</div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Parametreleri */}
      <div>
        <h4 className="text-sm font-bold text-slate-300 mb-3">🛡️ Risk Limitleri</h4>
        <div className="bg-white/5 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Portföy Değeri (varsayılan)</span>
            <span className="font-bold text-slate-300">₺{portfolioValue.toLocaleString('tr-TR')}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Tek Hisseye Maks. Pay</span>
            <span className="font-bold text-slate-300">%20</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Maks. Pozisyon Tutarı</span>
            <span className="font-bold text-slate-300">₺50.000</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Portföy Maks. Drawdown</span>
            <span className="font-bold text-red-400">%10</span>
          </div>
        </div>
      </div>

      {/* Açıklama */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300/80">
        <strong>Kelly Criterion nedir?</strong> Matematiksel olarak optimal pozisyon büyüklüğünü hesaplayan formüldür.
        <strong> Half-Kelly</strong> (yarım Kelly) kullanılır — tam Kelly çok agresiftir, yarım Kelly daha muhafazakâr
        ve gerçek piyasa koşullarında daha güvenilir sonuçlar verir.
        Negatif Kelly değeri, stratejinin kârlı olmadığını ve işlem yapılmaması gerektiğini gösterir.
      </div>

      {/* Investopedia Link */}
      <a
        href="https://www.investopedia.com/articles/trading/04/091504.asp"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-xs text-blue-400/60 hover:text-blue-400 transition-colors"
      >
        <ExternalLink size={12} /> Kelly Criterion Nedir? — Investopedia (Detaylı Kaynak)
      </a>
    </div>
  );
};

export default DrillDownModal;
