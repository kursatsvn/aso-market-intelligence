import { describe, it, expect } from 'vitest';
import { estimateCandidatePotential, tierFromScore } from './suggestions.js';

describe('Aday Keyword Potansiyel Tahmini', () => {
  it('güçlü tohum + üst sıra + long-tail en yüksek tahmini verir', () => {
    const strong = estimateCandidatePotential({
      term: 'habit tracker for adhd',
      parentTerm: 'habit tracker',
      parentOpportunity: 80,
      hintRank: 1,
    });
    const weak = estimateCandidatePotential({
      term: 'habit tracker',
      parentTerm: 'habit tracker',
      parentOpportunity: 10,
      hintRank: 10,
    });
    expect(strong.estimate).toBeGreaterThan(weak.estimate);
    expect(strong.estimate).toBeLessThanOrEqual(100);
    expect(weak.estimate).toBeGreaterThanOrEqual(0);
  });

  it('daha üst sıradaki öneri, aynı koşullarda daha yüksek skor alır', () => {
    const base = { term: 'water reminder app', parentTerm: 'water reminder', parentOpportunity: 50 };
    const top = estimateCandidatePotential({ ...base, hintRank: 1 });
    const low = estimateCandidatePotential({ ...base, hintRank: 8 });
    expect(top.estimate).toBeGreaterThan(low.estimate);
  });

  it('neden listesi her zaman en az bir madde içerir', () => {
    const res = estimateCandidatePotential({
      term: 'x',
      parentTerm: 'x',
      parentOpportunity: 0,
      hintRank: 10,
    });
    expect(res.reasons.length).toBeGreaterThan(0);
  });

  it('tierFromScore, opportunity.ts eşikleriyle uyumludur', () => {
    expect(tierFromScore(50)).toBe('gold');
    expect(tierFromScore(49.9)).toBe('opportunity');
    expect(tierFromScore(30)).toBe('opportunity');
    expect(tierFromScore(15)).toBe('watch');
    expect(tierFromScore(14.9)).toBe('red_ocean');
  });
});
