import gplayPkg from 'google-play-scraper';
import { getPrisma } from '../../db/prisma.js';

const gplay = (gplayPkg as any).default || gplayPkg;

export interface GPlaySerpAppItem {
  rank: number;
  id: string; // 'android:com.package.name'
  rawAppId: string; // 'com.package.name'
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

/**
 * Google Play Store'da anahtar kelime araması yapar (SERP).
 * İlk 20-30 sonucu çeker ve arka planda yerel SQLite'a kaydeder.
 */
export async function fetchGPlaySerp(
  term: string,
  country = 'us',
  limit = 20
): Promise<GPlaySerpAppItem[]> {
  const cleanTerm = term.trim();
  const lang = country.toLowerCase() === 'tr' ? 'tr' : 'en';

  const results = await gplay.search({
    term: cleanTerm,
    num: limit,
    country: country.toLowerCase(),
    lang,
    fullDetail: true,
  });

  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }

  const items: GPlaySerpAppItem[] = [];
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

    const item: GPlaySerpAppItem = {
      rank,
      id: namespacedId,
      rawAppId,
      name: r.title || 'Bilinmeyen Uygulama',
      sellerName: r.developer || '',
      iconUrl: r.icon || '',
      averageRating: Number((r.score || 0).toFixed(1)),
      ratingCount: r.ratings || 0,
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

    // Veritabanına asenkron kaydet (izole olarak)
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
      .catch(() => {
        // ignore background upsert errors
      });
  }

  return items;
}
