import { lookupApps } from './itunes.js';
import { checkAppIap } from './webScraper.js';
import { getPrisma } from '../db/prisma.js';
import { getStorefrontHeader } from '../../shared/storefronts.js';
import { GAMES_CATEGORY_ID, isGameSubcategory } from '../../shared/categories.js';

export interface CategoryAppItem {
  rank: number;
  id: string;
  name: string;
  sellerName: string;
  iconUrl: string;
  averageRating: number;
  ratingCount: number;
  price: number;
  currency: string;
  hasIap: boolean;
  releaseDate: Date;
  lastUpdated: Date;
}

const POP_ID_MAP: Record<string, number> = {
  topfreeapplications: 27,
  toppaidapplications: 30,
  topgrossingapplications: 38,
};

/**
 * MZStore Native Endpoint üzerinden 200'e kadar App Store kategori sıralaması çeker.
 * Tek istekte tüm metadata, puanlar ve IAP durumu gelir.
 */
async function fetchCategoryTopChartsFromMZStore(
  genreId: number,
  chartType: string,
  storefront: string,
  limit: number
): Promise<CategoryAppItem[]> {
  const popId = POP_ID_MAP[chartType] || 27;
  const g = genreId > 0 ? genreId : 36; // 36 = Tüm Uygulamalar (Overall Apps)
  const url = `https://itunes.apple.com/WebObjects/MZStore.woa/wa/viewTop?genreId=${g}&popId=${popId}`;

  const res = await fetch(url, {
    headers: {
      'X-Apple-Store-Front': getStorefrontHeader(storefront),
      'User-Agent': 'AppStore/3.0 (iOS; 17.0; iPhone15,2)',
      'Accept': 'application/json, text/javascript, */*',
      'Accept-Language': 'en-us, en;q=0.9',
    },
  });

  if (!res.ok) {
    throw new Error(`MZStore viewTop failed with status ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as any;
  const contentIds: any[] = data?.charts?.[0]?.contentIds || [];
  const results = data?.storePlatformData?.['lockup-charts']?.results || {};

  if (!Array.isArray(contentIds) || contentIds.length === 0) {
    return [];
  }

  const targetIds = contentIds.slice(0, limit);
  const items: CategoryAppItem[] = [];

  let rank = 1;
  for (const rawId of targetIds) {
    const id = String(rawId);
    const it = results[id];
    if (!it) continue;

    const iconUrl =
      it.artwork?.[1]?.url ||
      it.artwork?.[0]?.url ||
      it.iconArtwork?.url ||
      '';

    const price = it.offers?.[0]?.price ?? 0;
    const currency = it.offers?.[0]?.priceFormatted || (storefront === 'tr' ? 'TRY' : 'USD');
    const hasIap = !!it.hasInAppPurchases;
    const relDate = it.releaseDate ? new Date(it.releaseDate) : new Date(0); // bilinmiyor

    items.push({
      rank,
      id,
      name: it.name || 'Bilinmeyen Uygulama',
      sellerName: it.artistName || '',
      iconUrl,
      averageRating: Number((it.userRating?.value ?? 0).toFixed(1)),
      ratingCount: it.userRating?.ratingCount ?? 0,
      price,
      currency,
      hasIap,
      releaseDate: relDate,
      lastUpdated: relDate,
    });

    rank++;
  }

  return items;
}

/**
 * Yedek (Fallback): Apple RSS Feed uç noktası (maksimum 100 döndürür)
 */
async function fetchCategoryTopChartsFromRss(
  genreId: number,
  chartType: string,
  storefront: string,
  limit: number
): Promise<CategoryAppItem[]> {
  const genreSegment = genreId > 0 ? `/genre=${genreId}` : '';
  const rssLimit = Math.min(limit, 100);
  const url = `https://itunes.apple.com/${storefront}/rss/${chartType}/limit=${rssLimit}${genreSegment}/json`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Top Charts RSS failed with status ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as any;
  const entries = data?.feed?.entry;
  if (!Array.isArray(entries) || entries.length === 0) {
    return [];
  }

  const appIds: string[] = [];
  const rankMap = new Map<string, number>();

  let rank = 1;
  for (const entry of entries) {
    const id = entry?.id?.attributes?.['im:id'];
    if (id) {
      const idStr = String(id);
      appIds.push(idStr);
      rankMap.set(idStr, rank++);
    }
  }

  const metadataMap = await lookupApps(appIds, storefront);
  const items: CategoryAppItem[] = [];

  for (const id of appIds) {
    const meta = metadataMap.get(id);
    const appRank = rankMap.get(id) || 0;
    if (!meta) continue;

    items.push({
      rank: appRank,
      id,
      name: meta.name,
      sellerName: meta.sellerName,
      iconUrl: meta.iconUrl,
      averageRating: meta.averageRating,
      ratingCount: meta.ratingCount,
      price: meta.price,
      currency: meta.currency,
      hasIap: false,
      releaseDate: meta.releaseDate,
      lastUpdated: meta.lastUpdated,
    });
  }

  return items;
}

/**
 * Ana fonksiyon: Önce MZStore viewTop (200'e kadar) dener, hata alırsa RSS'e geçer.
 * Başarıyla çekilen uygulamaları SQLite'a asenkron kaydeder.
 */
export async function fetchCategoryTopCharts(
  genreId: number = 0,
  chartType: string = 'topfreeapplications',
  storefront: string = 'us',
  limit: number = 200
): Promise<CategoryAppItem[]> {
  let items: CategoryAppItem[] = [];

  try {
    items = await fetchCategoryTopChartsFromMZStore(genreId, chartType, storefront, limit);
  } catch (err) {
    console.warn('MZStore category top charts failed, falling back to RSS:', err);
    items = await fetchCategoryTopChartsFromRss(genreId, chartType, storefront, limit);
  }

  // Veritabanına asenkron kaydet (UI'ı bekletmez)
  saveTopChartsToDatabase(items, genreId).catch((e) =>
    console.warn('Top charts DB save failed:', e)
  );

  return items;
}

async function saveTopChartsToDatabase(items: CategoryAppItem[], genreId: number) {
  const prisma = getPrisma();
  const today = new Date().toISOString().slice(0, 10);

  for (const item of items) {
    try {
      await prisma.app.upsert({
        where: { id: item.id },
        update: {
          name: item.name,
          averageRating: item.averageRating,
          ratingCount: item.ratingCount,
          hasIap: item.hasIap,
        },
        create: {
          id: item.id,
          name: item.name,
          sellerName: item.sellerName,
          primaryGenreId: isGameSubcategory(genreId) ? GAMES_CATEGORY_ID : genreId > 0 ? genreId : 6000,
          releaseDate: item.releaseDate,
          lastUpdated: item.lastUpdated,
          price: item.price,
          currency: item.currency,
          averageRating: item.averageRating,
          ratingCount: item.ratingCount,
          iconUrl: item.iconUrl,
          hasIap: item.hasIap,
        },
      });

      await prisma.appSnapshot.upsert({
        where: { appId_day: { appId: item.id, day: today } },
        update: {
          ratingCount: item.ratingCount,
          avgRating: item.averageRating,
        },
        create: {
          appId: item.id,
          day: today,
          ratingCount: item.ratingCount,
          avgRating: item.averageRating,
        },
      });
    } catch {
      // ignore individual upsert errors
    }
  }
}
