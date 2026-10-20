import { describe, it, expect } from 'vitest';
import { calculateKeywordDifficulty, titleMatchScore } from './difficulty.js';
import { calculateOpportunityScore } from './opportunity.js';
import { calculateRisingStar } from './risingStar.js';
import { extractNGrams, categorizeReview } from '../text/ngram.js';
import { calculateProxyPopularity } from '../electron/clients/popularity.js';
import { estimateIosInstalls } from '../shared/platforms.js';

describe('Keyword Difficulty (KD)', () => {
  it('titleMatchScore identifies exact match', () => {
    expect(titleMatchScore('habit tracker', 'Habit Tracker: Daily Routine')).toBe(1.0);
    expect(titleMatchScore('habit tracker', 'Daily Habit and Tracker')).toBe(0.70);
    expect(titleMatchScore('habit tracker', 'Meditation App')).toBe(0.0);
  });

  it('calculates KD appropriately for competitive vs niche apps', () => {
    const competitiveApps = Array.from({ length: 10 }, (_, i) => ({
      rank: i + 1,
      title: 'Habit Tracker App',
      ratingCount: 150000,
      averageRating: 4.8,
      releaseDate: new Date(Date.now() - 1500 * 24 * 60 * 60 * 1000), // ~4 yıl
      lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),    // 5 gün önce
    }));

    const resultComp = calculateKeywordDifficulty('habit tracker', competitiveApps);
    expect(resultComp.kd).toBeGreaterThan(70);

    const nicheApps = Array.from({ length: 3 }, (_, i) => ({
      rank: i + 1,
      title: 'Simple Note Tool',
      ratingCount: 40,
      averageRating: 3.8,
      releaseDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      lastUpdated: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000),
    }));

    const resultNiche = calculateKeywordDifficulty('adhd focus timer notes', nicheApps);
    expect(resultNiche.kd).toBeLessThan(40);
  });
});

describe('Opportunity Score', () => {
  it('identifies Gold Opportunity keywords (High Pop, Low KD)', () => {
    const top10 = [
      {
        rank: 1,
        title: 'Old App',
        ratingCount: 100,
        averageRating: 3.5, // zayıf rakip
        releaseDate: new Date(),
        lastUpdated: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 1+ yıldır güncellenmemiş
      },
    ];

    const result = calculateOpportunityScore(65, 25, top10);
    expect(result.inTargetZone).toBe(true);
    expect(result.score).toBeGreaterThan(45);
    expect(result.tier).toBe('gold');
  });
});

describe('Rising Star Engine', () => {
  it('handles cold-start fallback when past snapshot is missing', () => {
    const result = calculateRisingStar({
      appId: '123456',
      name: 'New Viral Habit App',
      releaseDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 gün önce çıkmış
      hasIap: true,
      ratingCount: 600, // günde 20 yorum!
      averageRating: 4.7,
    });

    expect(result.isEligible).toBe(true);
    expect(result.isColdStart).toBe(true);
    expect(result.metrics.dailyVelocity).toBe(20);
    expect(result.score).toBeGreaterThan(25);
  });

  it('rejects apps older than 180 days or without IAP', () => {
    const resultOld = calculateRisingStar({
      appId: '999',
      name: 'Old App',
      releaseDate: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000),
      hasIap: true,
      ratingCount: 1000,
      averageRating: 4.5,
    });
    expect(resultOld.isEligible).toBe(false);
    expect(resultOld.score).toBe(0);
  });
});

describe('Text Mining (N-Gram & Categories)', () => {
  it('categorizes review complaints accurately', () => {
    const c1 = categorizeReview('Charged me yearly subscription without consent! Refund please.');
    expect(c1.isPricing).toBe(true);
    expect(c1.isBug).toBe(false);

    const c2 = categorizeReview('App crashes on launch after the latest update.');
    expect(c2.isBug).toBe(true);
  });

  it('extracts top bi-grams from review texts', () => {
    const reviews = [
      'I lost all my data after update',
      'The app lost all my data and crashed',
      'Terrible update lost all data again',
      'Customer support never answered',
    ];

    const ngrams = extractNGrams(reviews, 2);
    expect(ngrams.some(x => x.phrase === 'lost data')).toBe(true);
  });
});

describe('Popularity Proxy', () => {
  it('calculates proxy popularity between 5 and 100', () => {
    const pop1 = calculateProxyPopularity(1, 100000); // 1st hint + huge review count
    expect(pop1).toBeGreaterThan(80);

    const popLow = calculateProxyPopularity(null, 50); // Not in hints + few reviews
    expect(popLow).toBeLessThanOrEqual(15);
  });
});

describe('iOS Installs Estimator', () => {
  it('handles 0 or undefined ratingCount gracefully', () => {
    expect(estimateIosInstalls(0).formatted).toBe('< 500 (Tahmini)');
    expect(estimateIosInstalls(-5).formatted).toBe('< 500 (Tahmini)');
  });

  it('calculates accurate estimates across scales', () => {
    const small = estimateIosInstalls(100); // 100 * 35 = 3500
    expect(small.formatted).toBe('~3.5K+ (Tahmini)');
    expect(small.minInstalls).toBe(3500);

    const medium = estimateIosInstalls(5000); // 5000 * 45 = 225,000
    expect(medium.formatted).toBe('~225K+ (Tahmini)');
    expect(medium.minInstalls).toBe(225000);

    const large = estimateIosInstalls(50000); // 50000 * 60 = 3,000,000
    expect(large.formatted).toBe('~3.0M+ (Tahmini)');
    expect(large.minInstalls).toBe(3000000);

    const huge = estimateIosInstalls(20000000); // 20M * 75 = 1.5B
    expect(huge.formatted).toContain('B+ (Tahmini)');
  });
});
