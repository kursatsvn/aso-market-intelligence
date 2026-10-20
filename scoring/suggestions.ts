import { clamp } from './common.js';

export interface CandidateEstimateInput {
  term: string;
  parentTerm: string;
  /** Baz alınan (tohum) kelimenin kayıtlı fırsat skoru (0-100) */
  parentOpportunity: number;
  /** Apple arama önerilerindeki sıra (1 = en üstte) */
  hintRank: number;
  /** Önerinin kaç öneri arasında listelendiği (varsayılan 10) */
  hintListSize?: number;
}

export interface CandidateEstimate {
  /** 0..100 tahmini potansiyel (gerçek analizden önce) */
  estimate: number;
  reasons: string[];
}

const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Henüz analiz edilmemiş aday bir kelimenin potansiyelini ağ isteği yapmadan tahmin eder.
 *
 *  - Tohum kelimenin fırsat skoru   (%45): iyi niş içindeki türev kelimeler de umut vericidir.
 *  - Arama önerisindeki sıra        (%35): üst sıradaki öneriler gerçek aramalarda daha sık geçer.
 *  - Long-tail derinliği            (%20): tohuma eklenen her kelime rekabeti genelde düşürür.
 *
 * Bu skor bir TAHMİNDİR; kesin değer için kelime analiz edilmelidir.
 */
export function estimateCandidatePotential(input: CandidateEstimateInput): CandidateEstimate {
  const listSize = Math.max(2, input.hintListSize ?? 10);
  const parentQuality = clamp(input.parentOpportunity / 100, 0, 1);
  const rankScore = clamp(1 - (input.hintRank - 1) / (listSize - 1), 0, 1);
  const extraWords = Math.max(0, wordCount(input.term) - wordCount(input.parentTerm));
  const longTail = clamp(extraWords / 2, 0, 1);

  const estimate = 100 * (0.45 * parentQuality + 0.35 * rankScore + 0.2 * longTail);

  const reasons: string[] = [];
  if (parentQuality >= 0.5) reasons.push(`"${input.parentTerm}" güçlü bir niş (fırsat ${Math.round(input.parentOpportunity)})`);
  if (rankScore >= 0.7) reasons.push(`Apple önerilerinde üst sıralarda (#${input.hintRank})`);
  if (longTail >= 0.5) reasons.push('Long-tail: daha az rekabet beklenir');
  if (reasons.length === 0) reasons.push('Düşük sinyalli aday');

  return { estimate: Math.round(clamp(estimate, 0, 100) * 10) / 10, reasons };
}

export type OpportunityTier = 'gold' | 'opportunity' | 'watch' | 'red_ocean';

/** opportunity.ts ile aynı eşikler */
export function tierFromScore(score: number): OpportunityTier {
  if (score >= 50) return 'gold';
  if (score >= 30) return 'opportunity';
  if (score >= 15) return 'watch';
  return 'red_ocean';
}
