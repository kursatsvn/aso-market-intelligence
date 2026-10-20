import { ipcMain } from 'electron';
import { getPrisma } from '../db/prisma.js';
import { analyzeKeyword } from '../services/keywordPipeline.js';
import { getOpportunitySuggestions } from '../services/opportunitySuggestions.js';
import { calculateRisingStar } from '../../scoring/risingStar.js';
import { extractNGrams, categorizeReview } from '../../text/ngram.js';
import { fetchAppReviews } from '../clients/reviews.js';
import { fetchGPlayReviews } from '../clients/gplay/reviews.js';
import type { Platform } from '../../shared/platforms.js';

export function registerIpcHandlers(): void {
  const prisma = getPrisma();

  // 1. Keyword Analiz (Store ve Platform Duyarlı)
  ipcMain.handle('keyword:analyze', async (_, term: string, storefront = 'us', platform: Platform = 'ios', pullReviews = true) => {
    try {
      const result = await analyzeKeyword(term, storefront, platform, pullReviews);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });

  // 1b. Fırsatlara Göre Keyword Önerileri
  ipcMain.handle('keyword:suggest-opportunities', async (_, storefront = 'us', seed?: string) => {
    try {
      const data = await getOpportunitySuggestions(storefront, seed);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  });

  // 2. Kayıtlı Keyword Listesi (Platforma Göre Filtrelenebilir)
  ipcMain.handle('keyword:list', async (_, platform?: Platform) => {
    try {
      const where = platform ? { platform } : {};
      const keywords = await prisma.keyword.findMany({
        where,
        include: {
          metrics: {
            orderBy: { day: 'desc' },
            take: 1,
          },
          _count: {
            select: { serpEntries: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        data: keywords.map(k => ({
          id: k.id,
          term: k.term,
          storefront: k.storefront,
          platform: (k.platform as Platform) || 'ios',
          popularity: k.metrics[0]?.popularity ?? 0,
          difficulty: k.metrics[0]?.difficulty ?? 0,
          opportunity: k.metrics[0]?.opportunity ?? 0,
          lastAnalyzed: k.metrics[0]?.day ?? null,
          appCount: k._count.serpEntries,
        })),
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 3. Kayıtlı Uygulamalar Listesi
  ipcMain.handle('app:list', async (_, platform?: Platform) => {
    try {
      const where = platform ? { platform } : {};
      const apps = await prisma.app.findMany({
        where,
        orderBy: { ratingCount: 'desc' },
        take: 100,
      });
      return { success: true, data: apps };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 4. Rising Stars (Yeni & Hızlı Büyüyenler)
  ipcMain.handle('app:rising-stars', async (_, platform?: Platform) => {
    try {
      const where = platform ? { platform } : {};
      const apps = await prisma.app.findMany({
        where,
        include: {
          snapshots: {
            orderBy: { day: 'desc' },
            take: 2,
          },
        },
      });

      const list = [];
      for (const app of apps) {
        if (!app.releaseDate) continue;

        const pastSnapshot = app.snapshots.length > 1
          ? { ratingCount: app.snapshots[1].ratingCount, capturedAt: app.snapshots[1].capturedAt }
          : undefined;

        const res = calculateRisingStar({
          appId: app.id,
          name: app.name,
          releaseDate: app.releaseDate,
          hasIap: app.hasIap,
          ratingCount: app.ratingCount,
          averageRating: app.averageRating,
          pastSnapshot,
        });

        if (res.isEligible) {
          list.push({
            app: {
              id: app.id,
              platform: (app.platform as Platform) || 'ios',
              name: app.name,
              sellerName: app.sellerName,
              iconUrl: app.iconUrl,
              averageRating: app.averageRating,
              ratingCount: app.ratingCount,
              installs: app.installs,
              hasIap: app.hasIap,
              releaseDate: app.releaseDate,
            },
            score: res.score,
            isColdStart: res.isColdStart,
            confidence: res.confidence,
            metrics: res.metrics,
          });
        }
      }

      list.sort((a, b) => b.score - a.score);
      return { success: true, data: list };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 5. Yorum Röntgeni & N-Gram (iOS ve Google Play Uyumlu)
  ipcMain.handle('review:get', async (_, appId: string, storefront = 'us') => {
    try {
      const isAndroid = appId.startsWith('android:') || appId.includes('.') || !/^\d+$/.test(appId);
      const targetAppId = isAndroid && !appId.startsWith('android:') ? `android:${appId}` : appId;

      let reviews = await prisma.review.findMany({
        where: { appId: targetAppId },
        orderBy: { reviewedAt: 'desc' },
        take: 200,
      });

      // Eğer veritabanında yoksa platformuna göre canlı çek ve kaydet
      if (reviews.length === 0) {
        if (isAndroid) {
          const gReviews = await fetchGPlayReviews(targetAppId, storefront, 100);
          reviews = await prisma.review.findMany({
            where: { appId: targetAppId },
            orderBy: { reviewedAt: 'desc' },
            take: 200,
          });
          if (reviews.length === 0 && gReviews.length > 0) {
            reviews = gReviews as any;
          }
        } else {
          const raw = await fetchAppReviews(targetAppId, storefront, 5);
          for (const r of raw) {
            await prisma.review.upsert({
              where: { id: r.id },
              update: {},
              create: {
                id: r.id,
                appId: targetAppId,
                platform: 'ios',
                storefront,
                rating: r.rating,
                title: r.title,
                body: r.body,
                reviewedAt: r.reviewedAt,
                appVersion: r.appVersion,
              },
            });
          }
          reviews = await prisma.review.findMany({
            where: { appId: targetAppId },
            orderBy: { reviewedAt: 'desc' },
            take: 200,
          });
          if (reviews.length === 0 && raw.length > 0) {
            reviews = raw as any;
          }
        }
      }

      const reviewBodies = reviews.map(r => r.body);
      const topBiGrams = extractNGrams(reviewBodies, 2, 15);
      const topTriGrams = extractNGrams(reviewBodies, 3, 10);

      let pricing = 0;
      let bug = 0;
      let missingFeature = 0;

      for (const r of reviews) {
        const cat = categorizeReview((r.title || '') + ' ' + r.body);
        if (cat.isPricing) pricing++;
        if (cat.isBug) bug++;
        if (cat.isMissingFeature) missingFeature++;
      }

      return {
        success: true,
        data: {
          reviews,
          summary: {
            total: reviews.length,
            pricing,
            bug,
            missingFeature,
          },
          topBiGrams,
          topTriGrams,
        },
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // 6. Kategori Sıralamaları (Top Charts - Platform Seçimli)
  ipcMain.handle(
    'category:top-charts',
    async (
      _,
      genreId: any = 0,
      chartType: string = 'topfreeapplications',
      storefront = 'us',
      limit: number = 200,
      platform: Platform = 'ios'
    ) => {
      try {
        if (platform === 'android') {
          const { fetchGPlayTopCharts } = await import('../clients/gplay/categories.js');
          const catId = typeof genreId === 'string' && isNaN(Number(genreId)) ? genreId : 'APPLICATION';
          const items = await fetchGPlayTopCharts(catId, chartType, storefront, limit);
          return { success: true, data: items };
        } else {
          const { fetchCategoryTopCharts } = await import('../clients/categories.js');
          const numericGenre = typeof genreId === 'number' ? genreId : Number(genreId) || 0;
          const items = await fetchCategoryTopCharts(numericGenre, chartType, storefront, limit);
          return { success: true, data: items };
        }
      } catch (err: any) {
        return { success: false, error: err.message || String(err) };
      }
    }
  );
}
