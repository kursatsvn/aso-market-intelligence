import { getPrisma } from '../db/prisma.js';
import { fetchHints } from '../clients/hints.js';
import { estimateCandidatePotential, tierFromScore, type OpportunityTier } from '../../scoring/suggestions.js';

export interface VerifiedOpportunity {
  term: string;
  storefront: string;
  popularity: number;
  difficulty: number;
  opportunity: number;
  tier: OpportunityTier;
  inTargetZone: boolean;
  lastAnalyzed: string | null;
}

export interface CandidateSuggestion {
  term: string;
  parentTerm: string;
  hintRank: number;
  estimate: number;
  reasons: string[];
}

export interface OpportunitySuggestions {
  storefront: string;
  /** Önerilerin türetildiği, DB'deki en yüksek fırsat skorlu kelimeler */
  seeds: Array<{ term: string; opportunity: number }>;
  /** Analizi yapılmış ve fırsat eşiğini geçen kelimeler */
  verified: VerifiedOpportunity[];
  /** Tohumlardan türetilen, henüz analiz edilmemiş adaylar */
  candidates: CandidateSuggestion[];
}

const MAX_SEEDS = 6;
const MAX_CANDIDATES = 40;
const CUSTOM_SEED_DEFAULT_OPPORTUNITY = 40;

interface RawHint {
  term: string;
  rank: number;
}

async function collectHints(seed: string, storefront: string, deep: boolean): Promise<RawHint[]> {
  const found = new Map<string, number>();

  const direct = await fetchHints(seed, storefront).catch(() => []);
  for (const h of direct) {
    const t = h.term.toLowerCase();
    if (!found.has(t)) found.set(t, h.rank);
  }

  if (deep) {
    // Özel tohum kelime için a-z genişletmesi (daha geniş long-tail havuzu)
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    for (let i = 0; i < letters.length; i += 4) {
      const batch = letters.slice(i, i + 4);
      const results = await Promise.all(
        batch.map((c) => fetchHints(`${seed} ${c}`, storefront).catch(() => []))
      );
      for (const sub of results) {
        for (const h of sub) {
          const t = h.term.toLowerCase();
          // a-z ile bulunanlar doğrudan önerilere göre daha düşük sinyal taşır
          if (!found.has(t)) found.set(t, Math.max(h.rank, 6));
        }
      }
    }
  }

  return Array.from(found, ([term, rank]) => ({ term, rank }));
}

export async function getOpportunitySuggestions(
  storefront = 'us',
  customSeed?: string
): Promise<OpportunitySuggestions> {
  const prisma = getPrisma();

  const stored = await prisma.keyword.findMany({
    where: { storefront },
    include: { metrics: { orderBy: { day: 'desc' }, take: 1 } },
  });

  const storedTerms = new Set(stored.map((k) => k.term));
  const withMetric = stored
    .filter((k) => k.metrics.length > 0)
    .map((k) => ({
      term: k.term,
      popularity: k.metrics[0].popularity,
      difficulty: k.metrics[0].difficulty,
      opportunity: k.metrics[0].opportunity,
      day: k.metrics[0].day,
    }));

  // 1. Doğrulanmış fırsatlar: skoru >= 30 veya hedef bölgede (Pop > 30 & KD < 40)
  const verified: VerifiedOpportunity[] = withMetric
    .filter((k) => k.opportunity >= 30 || (k.popularity > 30 && k.difficulty < 40))
    .sort((a, b) => b.opportunity - a.opportunity)
    .map((k) => ({
      term: k.term,
      storefront,
      popularity: k.popularity,
      difficulty: k.difficulty,
      opportunity: k.opportunity,
      tier: tierFromScore(k.opportunity),
      inTargetZone: k.popularity > 30 && k.difficulty < 40,
      lastAnalyzed: k.day,
    }));

  // 2. Tohumlar: en yüksek fırsat skorlu kayıtlı kelimeler (+ kullanıcının girdiği tohum)
  const seeds: Array<{ term: string; opportunity: number; deep: boolean }> = withMetric
    .filter((k) => k.opportunity > 0)
    .sort((a, b) => b.opportunity - a.opportunity)
    .slice(0, MAX_SEEDS)
    .map((k) => ({ term: k.term, opportunity: k.opportunity, deep: false }));

  const normalizedCustom = customSeed?.trim().toLowerCase();
  if (normalizedCustom) {
    const existing = withMetric.find((k) => k.term === normalizedCustom);
    const idx = seeds.findIndex((s) => s.term === normalizedCustom);
    const entry = {
      term: normalizedCustom,
      opportunity: existing?.opportunity ?? CUSTOM_SEED_DEFAULT_OPPORTUNITY,
      deep: true,
    };
    if (idx >= 0) seeds[idx] = entry;
    else seeds.unshift(entry);
  }

  // 3. Her tohum için Apple arama önerilerini çek, tahmini potansiyele göre puanla
  const hintLists = await Promise.all(
    seeds.map(async (seed) => ({ seed, hints: await collectHints(seed.term, storefront, seed.deep) }))
  );

  const best = new Map<string, CandidateSuggestion>();
  for (const { seed, hints } of hintLists) {
    for (const h of hints) {
      if (h.term === seed.term || storedTerms.has(h.term)) continue;

      const { estimate, reasons } = estimateCandidatePotential({
        term: h.term,
        parentTerm: seed.term,
        parentOpportunity: seed.opportunity,
        hintRank: h.rank,
      });

      const prev = best.get(h.term);
      if (!prev || estimate > prev.estimate) {
        best.set(h.term, { term: h.term, parentTerm: seed.term, hintRank: h.rank, estimate, reasons });
      }
    }
  }

  const candidates = Array.from(best.values())
    .sort((a, b) => b.estimate - a.estimate)
    .slice(0, MAX_CANDIDATES);

  return {
    storefront,
    seeds: seeds.map(({ term, opportunity }) => ({ term, opportunity })),
    verified,
    candidates,
  };
}
