import { getPrisma } from '../db/prisma.js';
import { fetchSerp } from '../clients/mzstore.js';
import { lookupApps } from '../clients/itunes.js';
import { checkAppIap } from '../clients/webScraper.js';
import { resolvePopularity } from '../clients/popularity.js';
import { expandKeywordSuggestions } from '../clients/hints.js';
import { fetchAppReviews } from '../clients/reviews.js';
import { calculateKeywordDifficulty, type SerpAppScoringInput } from '../../scoring/difficulty.js';
import { calculateOpportunityScore, type OpportunityResult } from '../../scoring/opportunity.js';
import { extractNGrams, categorizeReview, type NGramFreq } from '../../text/ngram.js';

export interface KeywordPipelineResult {
  keyword: string;
  storefront: string;
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

export async function analyzeKeyword(term: string, storefront = 'us', pullReviewsForTop = true): Promise<KeywordPipelineResult> {
  const prisma = getPrisma();
  const normalizedTerm = term.trim().toLowerCase();
  const today = new Date().toISOString().slice(0, 10);

  // 1. SERP Çekimi (İlk 20 Uygulama)
  const serpItems = await fetchSerp(normalizedTerm, storefront);
  const appIds = serpItems.map(s => s.appId);

  // 2. iTunes Toplu Metadata Çekimi
  const metadataMap = await lookupApps(appIds, storefront);

  // 3. İlk 10 Uygulama İçin hasIap Tespiti (Paralel)
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

  // 4. Skorlama Girdilerini Hazırlama
  const scoringInputs: SerpAppScoringInput[] = [];
  const topAppsResult: KeywordPipelineResult['topApps'] = [];

  for (const s of serpItems) {
    const meta = metadataMap.get(s.appId);
    if (!meta) continue;

    const hasIap = iapMap.get(s.appId) ?? false;
    const inputItem: SerpAppScoringInput = {
      rank: s.rank,
      title: meta.name,
      ratingCount: meta.ratingCount,
      averageRating: meta.averageRating,
      releaseDate: meta.releaseDate,
      lastUpdated: meta.lastUpdated,
    };

    scoringInputs.push(inputItem);

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
  }

  // 5. Popularity Hesaplama (Proxy veya ASA)
  const top5RatingCounts = scoringInputs.slice(0, 5).map(a => a.ratingCount);
  const popResult = await resolvePopularity(normalizedTerm, storefront, top5RatingCounts);

  // 6. Keyword Difficulty (KD) Hesabı
  const kdResult = calculateKeywordDifficulty(normalizedTerm, scoringInputs);

  // 7. Opportunity Score Hesabı
  const oppResult = calculateOpportunityScore(popResult.popularity, kdResult.kd, scoringInputs.slice(0, 10));

  // 8. Long-Tail Önerileri (Autocomplete)
  const suggestions = await expandKeywordSuggestions(normalizedTerm, storefront);

  // 9. SQLite Veritabanına Kalıcı Kayıt (Idempotent Upsert)
  const keywordRecord = await prisma.keyword.upsert({
    where: { term_storefront: { term: normalizedTerm, storefront } },
    update: {},
    create: { term: normalizedTerm, storefront },
  });

  await prisma.keywordMetric.upsert({
    where: { keywordId_day: { keywordId: keywordRecord.id, day: today } },
    update: {
      popularity: popResult.popularity,
      popularitySrc: popResult.source,
      difficulty: kdResult.kd,
      opportunity: oppResult.score,
    },
    create: {
      keywordId: keywordRecord.id,
      day: today,
      popularity: popResult.popularity,
      popularitySrc: popResult.source,
      difficulty: kdResult.kd,
      opportunity: oppResult.score,
    },
  });

  for (const app of topAppsResult) {
    const meta = metadataMap.get(app.id);
    if (!meta) continue;

    await prisma.app.upsert({
      where: { id: app.id },
      update: {
        name: meta.name,
        averageRating: meta.averageRating,
        ratingCount: meta.ratingCount,
        hasIap: app.hasIap,
        lastUpdated: meta.lastUpdated,
      },
      create: {
        id: app.id,
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
        hasIap: app.hasIap,
      },
    });

    await prisma.appSnapshot.upsert({
      where: { appId_day: { appId: app.id, day: today } },
      update: {
        ratingCount: meta.ratingCount,
        avgRating: meta.averageRating,
      },
      create: {
        appId: app.id,
        day: today,
        ratingCount: meta.ratingCount,
        avgRating: meta.averageRating,
      },
    });

    await prisma.serpEntry.upsert({
      where: { keywordId_appId_day: { keywordId: keywordRecord.id, appId: app.id, day: today } },
      update: { rank: app.rank },
      create: {
        keywordId: keywordRecord.id,
        appId: app.id,
        rank: app.rank,
        day: today,
      },
    });
  }

  // 10. İsteğe Bağlı: İlk Sıradaki Rakibin 1-3 Yıldızlı Yorumlarını Çek ve N-Gram Çıkar
  let reviewInsights: KeywordPipelineResult['reviewInsights'];
  if (pullReviewsForTop && topAppsResult.length > 0) {
    const topApp = topAppsResult[0];
    const rawReviews = await fetchAppReviews(topApp.id, storefront, 5); // ilk 5 sayfa (~250 yorum)

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

        // Veritabanına kaydet
        await prisma.review.upsert({
          where: { id: r.id },
          update: {},
          create: {
            id: r.id,
            appId: topApp.id,
            storefront,
            rating: r.rating,
            title: r.title,
            body: r.body,
            reviewedAt: r.reviewedAt,
            appVersion: r.appVersion,
          },
        });
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
    popularity: popResult.popularity,
    popularitySource: popResult.source,
    kd: kdResult.kd,
    opportunity: oppResult,
    topApps: topAppsResult,
    suggestions: suggestions.slice(0, 25),
    reviewInsights,
  };
}
