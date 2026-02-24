import React from 'react';
import { X, TrendingUp, BarChart3, Activity, Settings, Database } from 'lucide-react';

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

export default DrillDownModal;
