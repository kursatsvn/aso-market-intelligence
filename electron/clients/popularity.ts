import { clamp } from '../../scoring/common.js';
import { fetchHints } from './hints.js';

export interface PopularityResult {
  popularity: number; // 5..100
  source: 'asa' | 'proxy';
}

/**
 * Sıfır Kurulum (Zero-Config) Matematiksel Vekil (Proxy) Popularity Hesabı
 *
 * S_hint: MZSearchHints içindeki sıra (ilk 10'da ise (11 - sıra)/10, yoksa 0)
 * S_vol : İlk 5 SERP uygulamasının medyan yorum sayısının log10 ölçeği
 */
export function calculateProxyPopularity(hintRank: number | null, top5MedianRatings: number): number {
  let sHint = 0;
  if (hintRank !== null && hintRank > 0 && hintRank <= 10) {
    sHint = (11 - hintRank) / 10;
  } else if (hintRank !== null && hintRank > 10) {
    sHint = 0.05;
  }

  // Medyan yorum sayısı 100 ise S_vol = 0, 10.000 ise 0.5, 1.000.000 ise 1.0
  const logVol = Math.log10(1 + Math.max(0, top5MedianRatings));
  const sVol = clamp((logVol - 2) / 4, 0, 1);

  const raw = 0.60 * sHint + 0.40 * sVol;
  const score = Math.round(5 + 95 * clamp(raw, 0, 1));
  return clamp(score, 5, 100);
}

export async function resolvePopularity(
  term: string,
  storefront: string,
  top5Ratings: number[],
  asaApiKey?: string
): Promise<PopularityResult> {
  // 1. Mod 1: Varsa ASA API
  if (asaApiKey && asaApiKey.trim().length > 10) {
    try {
      // ASA Web / API endpoint çağrısı burada yapılabilir
      // Şimdilik ASA yapılandırılmamışsa veya hata verirse Proxy'ye düşer
    } catch {
      // fallback to proxy
    }
  }

  // 2. Mod 2: Sıfır Kurulum Proxy Modu
  const hints = await fetchHints(term, storefront);
  const matched = hints.find(h => h.term.toLowerCase() === term.toLowerCase());
  const hintRank = matched ? matched.rank : (hints.length > 0 ? 11 : null);

  const sortedRatings = [...top5Ratings].sort((a, b) => a - b);
  const mid = Math.floor(sortedRatings.length / 2);
  const medianRating = sortedRatings.length > 0
    ? (sortedRatings.length % 2 !== 0 ? sortedRatings[mid] : (sortedRatings[mid - 1] + sortedRatings[mid]) / 2)
    : 0;

  const popularity = calculateProxyPopularity(hintRank, medianRating);
  return {
    popularity,
    source: 'proxy',
  };
}
