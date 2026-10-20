export const clamp = (x: number, a = 0, b = 1): number => Math.min(b, Math.max(a, x));

export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));

/**
 * Sıralama sönümleme ağırlığı (Discounted Cumulative Gain)
 * w_i = 1 / log2(i + 1)
 */
export const rankWeight = (rank: number): number => 1 / Math.log2(rank + 1);

/**
 * İlk 10 sıranın toplam teorik ağırlık paydası
 * W = sum_{i=1..10} w_i ≈ 4.5436
 */
export const W10 = Array.from({ length: 10 }, (_, k) => rankWeight(k + 1)).reduce((acc, w) => acc + w, 0);

/**
 * Bayes düzeltmeli kalite puanı
 * m = 50 minimum yorum, C = 4.0 kategori ortalaması
 */
export const bayesRating = (rating: number, count: number, m = 50, C = 4.0): number => {
  return (count * rating + m * C) / (count + m);
};

export const daysBetween = (earlier: Date, later: Date): number => {
  const ms = Math.max(0, later.getTime() - earlier.getTime());
  return ms / (1000 * 60 * 60 * 24);
};
