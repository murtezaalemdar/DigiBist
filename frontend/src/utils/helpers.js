/* Yardımcı fonksiyonlar */

/** Risk sinyal rengini döner */
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
