import { clamp, rankWeight, W10, bayesRating, daysBetween } from './common.js';

export interface SerpAppScoringInput {
  rank: number; // 1..10
  title: string;
  ratingCount: number;
  averageRating: number;
  releaseDate: Date;
  lastUpdated: Date;
}

export interface KdResult {
  kd: number; // 1..100
  components: {
    rStar: number;
    rBar: number;
    tBar: number;
    qBar: number;
    aBar: number;
    appCount: number;
  };
}

function cleanTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Başlık eşleşmesi (t_i):
 * 1.00: tam ardışık ifade başlıkta geçiyor
 * 0.70: tüm kelimeler başlıkta geçiyor (sıra bağımsız)
 * 0.35: kelimelerin en az yarısı başlıkta geçiyor
 * 0.00: eşleşme yok
 */
export function titleMatchScore(keyword: string, title: string): number {
  const kTokens = cleanTokens(keyword);
  const tTokens = cleanTokens(title);

  if (!kTokens.length || !tTokens.length) return 0;

  const kStr = kTokens.join(' ');
  const tStr = tTokens.join(' ');

  if (tStr.includes(kStr)) {
    return 1.0;
  }

  const matchingCount = kTokens.filter(k => tTokens.includes(k)).length;
  if (matchingCount === kTokens.length) {
    return 0.70;
  }

  if (matchingCount >= Math.ceil(kTokens.length / 2)) {
    return 0.35;
  }

  return 0.0;
}

export function calculateKeywordDifficulty(
  keyword: string,
  apps: SerpAppScoringInput[],
  now = new Date()
): KdResult {
  const top10 = apps
    .filter(a => a.rank >= 1 && a.rank <= 10)
    .sort((a, b) => a.rank - b.rank);

  let sumR = 0;
  let sumT = 0;
  let sumQ = 0;
  let sumA = 0;
  const top3R: number[] = [];

  for (const app of top10) {
    const w = rankWeight(app.rank);

    // 1. Yorum Hacim Ağırlığı r_i
    const ri = clamp((Math.log10(1 + app.ratingCount) - 1) / 5, 0, 1);
    sumR += w * ri;
    if (app.rank <= 3) top3R.push(ri);

    // 2. Başlık Eşleşmesi t_i
    const ti = titleMatchScore(keyword, app.title);
    sumT += w * ti;

    // 3. Bayes Düzeltmeli Kalite Puanı q_i
    const bayes = bayesRating(app.averageRating, app.ratingCount);
    const qi = clamp((bayes - 3.5) / 1.5, 0, 1);
    sumQ += w * qi;

    // 4. Uygulama Yaşı ve Olgunluk a_i
    const ageDays = daysBetween(app.releaseDate, now);
    const updateDays = daysBetween(app.lastUpdated, now);
    const maturity = clamp(ageDays / 1095, 0, 1); // 3 yıl = 1.0
    const activity = Math.exp(-updateDays / 365);
    const ai = 0.70 * maturity + 0.30 * activity;
    sumA += w * ai;
  }

  // Sabit W10 paydası ile normalizasyon
  const rBar = sumR / W10;
  const tBar = sumT / W10;
  const qBar = sumQ / W10;
  const aBar = sumA / W10;

  // İlk 3 sıradaki dev oyuncuların ezici etkisi (r*)
  const maxTop3R = top3R.length > 0 ? Math.max(...top3R) : 0;
  const rStar = 0.70 * rBar + 0.30 * maxTop3R;

  const kdRaw = 0.45 * rStar + 0.25 * tBar + 0.15 * qBar + 0.15 * aBar;
  const kd = Math.round(1 + 99 * clamp(kdRaw, 0, 1));

  return {
    kd,
    components: {
      rStar,
      rBar,
      tBar,
      qBar,
      aBar,
      appCount: top10.length,
    },
  };
}
