import React from 'react';
import {
  BrainCircuit,
  Cpu,
  ShieldCheck,
  Shield,
  Wifi,
  WifiOff,
  Bell,
} from 'lucide-react';

const ModelsPage = ({ wsConnected, livePrices }) => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold mb-2 flex items-center gap-3">
          <Cpu className="text-blue-500" size={28} /> ML Modelleri
        </h2>
        <p className="text-slate-500 text-sm">
          Sistemde kullanılan makine öğrenme modelleri ve performans metrikleri.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Random Forest */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <BrainCircuit size={120} />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-500/20 p-2.5 rounded-xl">
              <ShieldCheck className="text-green-400" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Random Forest</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                AKTİF
              </span>
            </div>
          </div>
          <p className="text-slate-400 text-sm mb-6">
            252 günlük geçmiş veri üzerinde eğitilmiş ensemble karar ağacı modeli. RSI, MACD,
            Bollinger Bantları ve hareketli ortalama kesişimlerini özellik olarak kullanır.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-black/30 rounded-2xl p-3 text-center border border-white/5">
              <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Doğruluk</div>
              <div className="text-lg font-bold text-green-400">%87</div>
            </div>
            <div className="bg-black/30 rounded-2xl p-3 text-center border border-white/5">
              <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Özellik</div>
              <div className="text-lg font-bold">14</div>
            </div>
            <div className="bg-black/30 rounded-2xl p-3 text-center border border-white/5">
              <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Ağaç</div>
              <div className="text-lg font-bold">100</div>
            </div>
          </div>
        </div>

        {/* Risk Engine */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Shield size={120} />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-yellow-500/20 p-2.5 rounded-xl">
              <Shield className="text-yellow-400" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Risk Engine</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                FİLTRE
              </span>
            </div>
          </div>
          <p className="text-slate-400 text-sm mb-6">
            Sinyal doğrulama ve pozisyon kontrolü yapan risk yönetim motoru. Düşük güvenli
            sinyalleri HOLD'a çevirir, pozisyon büyüklüğünü sınırlar.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-black/30 rounded-2xl p-3 text-center border border-white/5">
              <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Güven Eşiği</div>
              <div className="text-lg font-bold text-yellow-400">%70</div>
            </div>
            <div className="bg-black/30 rounded-2xl p-3 text-center border border-white/5">
              <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Maks Risk</div>
              <div className="text-lg font-bold">%2</div>
            </div>
            <div className="bg-black/30 rounded-2xl p-3 text-center border border-white/5">
              <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Durum</div>
              <div className="text-lg font-bold text-green-400">✓</div>
            </div>
          </div>
        </div>

        {/* WebSocket Stream */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2.5 rounded-xl ${wsConnected ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {wsConnected ? (
                <Wifi className="text-green-400" size={20} />
              ) : (
                <WifiOff className="text-red-400" size={20} />
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg">WebSocket Stream</h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  wsConnected
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {wsConnected ? 'BAĞLI' : 'BAĞLANTI YOK'}
              </span>
            </div>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            Gerçek zamanlı piyasa verisi akışı. Yahoo Finance API üzerinden her 10 saniyede
            güncelleme.
          </p>
          <div className="text-xs text-slate-500">
            Aktif sembol sayısı:{' '}
            <span className="text-white font-bold">{Object.keys(livePrices).length}</span>
          </div>
        </div>

        {/* Telegram Notifier */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-500/20 p-2.5 rounded-xl">
              <Bell className="text-blue-400" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Telegram Bildirimler</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                HAZIR
              </span>
            </div>
          </div>
          <p className="text-slate-400 text-sm mb-4">
            AI sinyalleri için otomatik Telegram bildirimi. Risk Engine onayından geçen sinyaller
            anında iletilir.
          </p>
          <div className="text-xs text-slate-500">
            Kullanım:{' '}
            <code className="text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
              /api/ai-forecast/THYAO?notify=true
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelsPage;
