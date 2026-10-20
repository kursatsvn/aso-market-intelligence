import gplayPkg from 'google-play-scraper';
import { getPrisma } from '../../db/prisma.js';

const gplay = (gplayPkg as any).default || gplayPkg;

export interface GPlayCategoryAppItem {
  rank: number;
  id: string; // 'android:com.package.name'
  rawAppId: string;
  name: string;
  sellerName: string;
  iconUrl: string;
  averageRating: number;
  ratingCount: number;
  installs: string;
  minInstalls: number;
  price: number;
  currency: string;
  hasIap: boolean;
  releaseDate: Date;
  lastUpdated: Date;
}

const COLLECTION_MAP: Record<string, any> = {
  topfreeapplications: gplay.collection.TOP_FREE,
  topgrossingapplications: gplay.collection.GROSSING,
  toppaidapplications: gplay.collection.TOP_PAID,
};

/**
 * Google Play Store Kategori Liderlerini (Top Charts) çeker.
 */
export async function fetchGPlayTopCharts(
  category = 'APPLICATION',
  chartType = 'topfreeapplications',
  country = 'us',
  limit = 50
): Promise<GPlayCategoryAppItem[]> {
  const collection = COLLECTION_MAP[chartType] || gplay.collection.TOP_FREE;
  const lang = country.toLowerCase() === 'tr' ? 'tr' : 'en';

  let rawCategory = category;
  if (!rawCategory || rawCategory === '0' || rawCategory === 'all') {
    rawCategory = gplay.category.APPLICATION;
  }

  const results = await gplay.list({
    category: rawCategory,
    collection,
    num: Math.min(limit, 100),
    country: country.toLowerCase(),
    lang,
    fullDetail: true, // Puan ve yorum sayılarının 0 gözükmemesi için tam detay
  });

  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }

  const items: GPlayCategoryAppItem[] = [];
  const prisma = getPrisma();
  const today = new Date().toISOString().slice(0, 10);

  let rank = 1;
  for (const r of results) {
    const rawAppId = String(r.appId || '');
    if (!rawAppId) continue;

    const namespacedId = `android:${rawAppId}`;

    let releaseDate = new Date();
    if (r.released) {
      const parsed = new Date(r.released);
      if (!isNaN(parsed.getTime())) releaseDate = parsed;
    }

    let lastUpdated = new Date();
    if (r.updated) {
      const parsed = new Date(r.updated);
      if (!isNaN(parsed.getTime())) lastUpdated = parsed;
    }

    const item: GPlayCategoryAppItem = {
      rank,
      id: namespacedId,
      rawAppId,
      name: r.title || 'Bilinmeyen Uygulama',
      sellerName: r.developer || '',
      iconUrl: r.icon || '',
      averageRating: Number((r.score || 0).toFixed(1)),
      ratingCount: r.ratings || r.reviews || 0,
      installs: r.installs || '0+',
      minInstalls: r.minInstalls || 0,
      price: r.price || 0,
      currency: r.currency || (country === 'tr' ? 'TRY' : 'USD'),
      hasIap: !!r.offersIAP,
      releaseDate,
      lastUpdated,
    };

    items.push(item);
    rank++;

    // Asenkron SQLite kaydet
    prisma.app
      .upsert({
        where: { id: namespacedId },
        update: {
          name: item.name,
          platform: 'android',
          bundleId: rawAppId,
          sellerName: item.sellerName,
          averageRating: item.averageRating,
          ratingCount: item.ratingCount,
          installs: item.installs,
          minInstalls: item.minInstalls,
          price: item.price,
          currency: item.currency,
          hasIap: item.hasIap,
          iconUrl: item.iconUrl,
          lastUpdated: item.lastUpdated,
        },
        create: {
          id: namespacedId,
          platform: 'android',
          bundleId: rawAppId,
          name: item.name,
          sellerName: item.sellerName,
          averageRating: item.averageRating,
          ratingCount: item.ratingCount,
          installs: item.installs,
          minInstalls: item.minInstalls,
          price: item.price,
          currency: item.currency,
          hasIap: item.hasIap,
          iconUrl: item.iconUrl,
          releaseDate: item.releaseDate,
          lastUpdated: item.lastUpdated,
        },
      })
      .then(() => {
        return prisma.appSnapshot.upsert({
          where: { appId_day: { appId: namespacedId, day: today } },
          update: {
            ratingCount: item.ratingCount,
            avgRating: item.averageRating,
          },
          create: {
            appId: namespacedId,
            day: today,
            ratingCount: item.ratingCount,
            avgRating: item.averageRating,
          },
        });
      })
      .catch(() => {});
  }

  return items;
}
