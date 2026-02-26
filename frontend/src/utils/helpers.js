/**
 * helpers.js — Yardımcı Fonksiyonlar (v8.09)
 * ═══════════════════════════════════════════
 *
 * Proje genelinde kullanılan utility fonksiyonları.
 * Tailwind CSS sınıfları ile tutarlı renk/stil haritaları sağlar.
 *
 * Fonksiyonlar:
 * - getRiskColor(signal) — AI sinyal tipine göre Tailwind CSS renk sınıfları döner
 *
 * Changelog:
 * - v8.09.01: JSDoc header eklendi (Sprint 3)
 */

/**
 * AI sinyal tipine (BUY/SELL/HOLD) göre Tailwind CSS renk sınıflarını döner.
 *
 * @param {string} signal — AI sinyal tipi: "BUY", "SELL" veya "HOLD"
 * @returns {{ bg: string, border: string, text: string, badge: string }}
 *   bg     — Arka plan sınıfı (opacity'li, örn: bg-green-500/[0.03])
 *   border — Border sınıfı (border-green-500/20)
 *   text   — Metin rengi (text-green-400)
 *   badge  — Badge arka plan + metin (bg-green-500/20 text-green-400)
 *
 * Renk Haritası:
 *   BUY  → yeşil (green-400/500)
 *   SELL → kırmızı (red-400/500)
 *   HOLD → sarı (yellow-400/500) — varsayılan
 */
export const getRiskColor = (signal) => {
  if (signal === 'BUY')
    return {
      bg: 'bg-green-500/[0.03]',
      border: 'border-green-500/20',
      text: 'text-green-400',
      badge: 'bg-green-500/20 text-green-400',
    };
  if (signal === 'SELL')
    return {
      bg: 'bg-red-500/[0.03]',
      border: 'border-red-500/20',
      text: 'text-red-400',
      badge: 'bg-red-500/20 text-red-400',
    };
  return {
    bg: 'bg-yellow-500/[0.03]',
    border: 'border-yellow-500/20',
    text: 'text-yellow-400',
    badge: 'bg-yellow-500/20 text-yellow-400',
  };
};
