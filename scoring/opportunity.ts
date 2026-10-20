import { clamp, sigmoid, bayesRating, daysBetween } from './common.js';
import type { SerpAppScoringInput } from './difficulty.js';

export interface OpportunityResult {
  score: number; // 0..100
  tier: 'gold' | 'opportunity' | 'watch' | 'red_ocean';
  inTargetZone: boolean; // Pop > 30 && KD < 40
  components: {
    Pn: number;
    Dn: number;
    G: number;
    weakCompetitorRatio: number;
  };
}

export function calculateOpportunityScore(
  popularity: number,
  kd: number,
  top10Apps: SerpAppScoringInput[],
  now = new Date()
): OpportunityResult {
  const Pn = clamp((popularity - 5) / 95, 0, 1);
  const Dn = clamp(kd / 100, 0, 1);

  // Zayıf Rakip Oranı: Puanı < 4.0 veya son 365 gündür güncellenmemiş olanlar
  let weakCount = 0;
  for (const app of top10Apps) {
    const bayes = bayesRating(app.averageRating, app.ratingCount);
    const updateDays = daysBetween(app.lastUpdated, now);
    if (bayes < 4.0 || updateDays > 365) {
      weakCount++;
    }
  }
  const weakCompetitorRatio = top10Apps.length > 0 ? weakCount / top10Apps.length : 0;

  // Hedef Bölge Kapısı: Pop > 30 & KD < 40 yumuşak sigmoid geçişi
  const G = sigmoid((popularity - 30) / 4) * sigmoid((40 - kd) / 4);

  // Fırsat formülü
  const rawScore =
    100 *
    Math.sqrt(Pn) *
    Math.pow(1 - Dn, 1.5) *
    (0.60 + 0.40 * G) *
    (1 + 0.25 * weakCompetitorRatio);

  const score = Math.round(clamp(rawScore, 0, 100) * 10) / 10;

  let tier: OpportunityResult['tier'] = 'red_ocean';
  if (score >= 50) {
    tier = 'gold';
  } else if (score >= 30) {
    tier = 'opportunity';
  } else if (score >= 15) {
    tier = 'watch';
  }

  return {
    score,
    tier,
    inTargetZone: popularity > 30 && kd < 40,
    components: {
      Pn,
      Dn,
      G,
      weakCompetitorRatio,
    },
  };
}
