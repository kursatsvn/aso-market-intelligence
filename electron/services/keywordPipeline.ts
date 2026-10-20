import { getPrisma } from '../db/prisma.js';
import { fetchSerp } from '../clients/mzstore.js';
import { lookupApps } from '../clients/itunes.js';
import { checkAppIap } from '../clients/webScraper.js';
import { resolvePopularity } from '../clients/popularity.js';
import { expandKeywordSuggestions } from '../clients/hints.js';
import { fetchAppReviews } from '../clients/reviews.js';
import { fetchGPlaySerp } from '../clients/gplay/search.js';
import { fetchGPlayHints } from '../clients/gplay/hints.js';
import { fetchGPlayReviews } from '../clients/gplay/reviews.js';
import { calculateKeywordDifficulty, type SerpAppScoringInput } from '../../scoring/difficulty.js';
import { calculateOpportunityScore, type OpportunityResult } from '../../scoring/opportunity.js';
import { extractNGrams, categorizeReview, type NGramFreq } from '../../text/ngram.js';
import type { Platform } from '../../shared/platforms.js';

export interface KeywordPipelineResult {
  keyword: string;
  storefront: string;
  platform: Platform;
  popularity: number;
  popularitySource: string;
  kd: number;
  opportunity: OpportunityResult;
  topApps: Array<{
    rank: number;
    id: string;
    name: string;
    averageRating: number;
    ratingCount: number;
    installs?: string;
    hasIap: boolean;
    releaseDate: Date;
    lastUpdated: Date;
  }>;
  suggestions: string[];
  reviewInsights?: {
    appId: string;
    appName: string;
    reviewCount: number;
    categories: { pricing: number; bug: number; missingFeature: number };
    topBiGrams: NGramFreq[];
  };
}

export async function analyzeKeyword(
  term: string,
  storefront = 'us',
  platformOrPullReviews: Platform | boolean = 'ios',
  pullReviewsForTop = true
): Promise<KeywordPipelineResult> {
  const platform: Platform = typeof platformOrPullReviews === 'string' ? platformOrPullReviews : 'ios';
  const shouldPullReviews = typeof platformOrPullReviews === 'boolean' ? platformOrPullReviews : pullReviewsForTop;

  const prisma = getPrisma();
  const normalizedTerm = term.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);

  let scoringInputs: SerpAppScoringInput[] = [];
  let topAppsResult: KeywordPipelineResult['topApps'] = [];
  let suggestions: string[] = [];
  let popularity = 20;
  let popularitySource = 'proxy';

  if (platform === 'android') {
    // ================= GOOGLE PLAY PIPELINE =================
    const serpItems = await fetchGPlaySerp(normalizedTerm, storefront, 20);

    for (const app of serpItems) {
      scoringInputs.push({
        rank: app.rank,
        title: app.name,
        ratingCount: app.ratingCount,
        averageRating: app.averageRating,
        releaseDate: app.releaseDate,
        lastUpdated: app.lastUpdated,
      });

      topAppsResult.push({
        rank: app.rank,
        id: app.id,
        name: app.name,
        averageRating: app.averageRating,
        ratingCount: app.ratingCount,
        installs: app.installs,
        hasIap: app.hasIap,
        releaseDate: app.releaseDate,
        lastUpdated: app.lastUpdated,
      });
    }

    // Google Play Önerileri
    const gplayHints = await fetchGPlayHints(normalizedTerm, storefront);
    suggestions = gplayHints.map(h => h.term);

    // Google Play Hacim Tahmini: İpucu sırası ve medyan yorum/indirme yoğunluğu
    const hintMatch = gplayHints.findIndex(h => h.term.toLowerCase() === normalizedTerm);
    const hintScore = hintMatch !== -1 ? Math.max(10, 50 - hintMatch * 8) : 5;
    const medianRatings = topAppsResult.length > 0 ? (topAppsResult[Math.floor(topAppsResult.length / 2)].ratingCount || 100) : 100;
    const ratingFactor = Math.min(50, Math.round(Math.log10(Math.max(10, medianRatings)) * 10));
    popularity = Math.min(100, Math.max(5, hintScore + ratingFactor));
    popularitySource = 'gplay_proxy';
  } else {
    // ================= APPLE APP STORE PIPELINE =================
    const serpItems = await fetchSerp(normalizedTerm, storefront);
    const appIds = serpItems.map(s => s.appId);
    const metadataMap = await lookupApps(appIds, storefront);

    // İlk 10 uygulama için paralel IAP tespiti
    const top10Serp = serpItems.slice(0, 10);
    const iapPromises = top10Serp.map(async (item) => {
      const hasIap = await checkAppIap(item.appId, storefront);
      return { appId: item.appId, hasIap };
    });
    const iapResults = await Promise.all(iapPromises);
    const iapMap = new Map<string, boolean>();
    for (const res of iapResults) {
      iapMap.set(res.appId, res.hasIap);
    }

    for (const s of serpItems) {
      const meta = metadataMap.get(s.appId);
      if (!meta) continue;

      const hasIap = iapMap.get(s.appId) ?? false;
      scoringInputs.push({
        rank: s.rank,
        title: meta.name,
        ratingCount: meta.ratingCount,
        averageRating: meta.averageRating,
        releaseDate: meta.releaseDate,
        lastUpdated: meta.lastUpdated,
      });

      topAppsResult.push({
        rank: s.rank,
        id: s.appId,
        name: meta.name,
        averageRating: meta.averageRating,
        ratingCount: meta.ratingCount,
        hasIap,
        releaseDate: meta.releaseDate,
        lastUpdated: meta.lastUpdated,
      });

      // App Store uygulamasını kaydet
      await prisma.app.upsert({
        where: { id: s.appId },
        update: {
          name: meta.name,
          platform: 'ios',
          averageRating: meta.averageRating,
          ratingCount: meta.ratingCount,
          hasIap,
          lastUpdated: meta.lastUpdated,
        },
        create: {
          id: s.appId,
          platform: 'ios',
          name: meta.name,
          bundleId: meta.bundleId,
          sellerName: meta.sellerName,
          primaryGenreId: meta.primaryGenreId,
          releaseDate: meta.releaseDate,
          lastUpdated: meta.lastUpdated,
          version: meta.version,
          price: meta.price,
          currency: meta.currency,
          averageRating: meta.averageRating,
          ratingCount: meta.ratingCount,
          iconUrl: meta.iconUrl,
          hasIap,
        },
      });

      await prisma.appSnapshot.upsert({
        where: { appId_day: { appId: s.appId, day: today } },
        update: {
          ratingCount: meta.ratingCount,
          avgRating: meta.averageRating,
        },
        create: {
          appId: s.appId,
          day: today,
          ratingCount: meta.ratingCount,
          avgRating: meta.averageRating,
        },
      });
    }

    // Popularity Hesaplama (ASA veya Proxy)
    const top5RatingCounts = scoringInputs.slice(0, 5).map(a => a.ratingCount);
    const popResult = await resolvePopularity(normalizedTerm, storefront, top5RatingCounts);
    popularity = popResult.popularity;
    popularitySource = popResult.source;

    // Suggestions
    suggestions = await expandKeywordSuggestions(normalizedTerm, storefront);
  }

  // 6. Keyword Difficulty (KD) Hesabı (Algoritma her iki mağazaya da uygulanır)
  const kdResult = calculateKeywordDifficulty(normalizedTerm, scoringInputs);

  // 7. Opportunity Score Hesabı
  const oppResult = calculateOpportunityScore(popularity, kdResult.kd, scoringInputs.slice(0, 10));

  // 8. SQLite Veritabanına Kalıcı Kayıt (Platform İzolasyonu)
  const keywordRecord = await prisma.keyword.upsert({
    where: {
      term_storefront_platform: {
        term: normalizedTerm,
        storefront,
        platform,
      },
    },
    update: {},
    create: {
      term: normalizedTerm,
      storefront,
      platform,
    },
  });

  await prisma.keywordMetric.upsert({
    where: { keywordId_day: { keywordId: keywordRecord.id, day: today } },
    update: {
      popularity,
      popularitySrc: popularitySource,
      difficulty: kdResult.kd,
      opportunity: oppResult.score,
    },
    create: {
      keywordId: keywordRecord.id,
      day: today,
      popularity,
      popularitySrc: popularitySource,
      difficulty: kdResult.kd,
      opportunity: oppResult.score,
    },
  });

  // SERP Sıralama Girişlerini Kaydet
  for (const app of topAppsResult) {
    try {
      await prisma.serpEntry.upsert({
        where: {
          keywordId_appId_day: {
            keywordId: keywordRecord.id,
            appId: app.id,
            day: today,
          },
        },
        update: { rank: app.rank },
        create: {
          keywordId: keywordRecord.id,
          appId: app.id,
          rank: app.rank,
          day: today,
        },
      });
    } catch {
      // ignore individual serp upsert errors
    }
  }

  // 9. İlk Sıradaki Rakibin Yorum Röntgeni (Opsiyonel)
  let reviewInsights: KeywordPipelineResult['reviewInsights'];
  if (shouldPullReviews && topAppsResult.length > 0) {
    const topApp = topAppsResult[0];
    let rawReviews: Array<{ id: string; rating: number; title: string; body: string }> = [];

    if (platform === 'android') {
      const gReviews = await fetchGPlayReviews(topApp.id, storefront, 100);
      rawReviews = gReviews.map(r => ({ id: r.id, rating: r.rating, title: r.title, body: r.body }));
    } else {
      const appleReviews = await fetchAppReviews(topApp.id, storefront, 5);
      rawReviews = appleReviews.map(r => ({ id: r.id, rating: r.rating, title: r.title, body: r.body }));
    }

    if (rawReviews.length > 0) {
      let pricing = 0;
      let bug = 0;
      let missingFeature = 0;
      const reviewBodies: string[] = [];

      for (const r of rawReviews) {
        const cat = categorizeReview(r.title + ' ' + r.body);
        if (cat.isPricing) pricing++;
        if (cat.isBug) bug++;
        if (cat.isMissingFeature) missingFeature++;
        reviewBodies.push(r.body);
      }

      const topBiGrams = extractNGrams(reviewBodies, 2, 10);

      reviewInsights = {
        appId: topApp.id,
        appName: topApp.name,
        reviewCount: rawReviews.length,
        categories: { pricing, bug, missingFeature },
        topBiGrams,
      };
    }
  }

  return {
    keyword: normalizedTerm,
    storefront,
    platform,
    popularity,
    popularitySource,
    kd: kdResult.kd,
    opportunity: oppResult,
    topApps: topAppsResult,
    suggestions: suggestions.slice(0, 25),
    reviewInsights,
  };
}
