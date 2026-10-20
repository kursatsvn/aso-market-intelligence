import gplayPkg from 'google-play-scraper';
import { getPrisma } from '../../db/prisma.js';

const gplay = (gplayPkg as any).default || gplayPkg;

export interface GPlayReviewItem {
  id: string;
  appId: string;
  rating: number;
  title: string;
  body: string;
  reviewedAt: Date;
  appVersion: string;
}

/**
 * Google Play uygulamasının kullanıcı yorumlarını (özellikle 1-3 yıldızlı şikayetleri) çeker.
 */
export async function fetchGPlayReviews(
  appId: string, // 'com.package.name' veya 'android:com.package.name'
  country = 'us',
  count = 100
): Promise<GPlayReviewItem[]> {
  const cleanAppId = appId.replace(/^android:/, '');
  const lang = country.toLowerCase() === 'tr' ? 'tr' : 'en';

  try {
    const res = await gplay.reviews({
      appId: cleanAppId,
      country: country.toLowerCase(),
      lang,
      num: count,
      sort: gplay.sort.NEWEST,
    });

    const reviews = res?.data || [];
    const items: GPlayReviewItem[] = [];
    const namespacedAppId = `android:${cleanAppId}`;
    const prisma = getPrisma();

    for (const r of reviews) {
      const rating = Number(r.score) || 0;
      // Yorum Röntgeni için 1, 2 ve 3 yıldızlı şikayetleri al
      if (rating < 1 || rating > 3) continue;

      const item: GPlayReviewItem = {
        id: `gplay_${r.id || Math.random().toString(36).slice(2)}`,
        appId: namespacedAppId,
        rating,
        title: r.title || '',
        body: r.text || '',
        reviewedAt: r.date ? new Date(r.date) : new Date(),
        appVersion: r.version || '',
      };

      items.push(item);

      // Veritabanına asenkron kaydet
      prisma.review
        .upsert({
          where: { id: item.id },
          update: {},
          create: {
            id: item.id,
            appId: namespacedAppId,
            platform: 'android',
            storefront: country,
            rating: item.rating,
            title: item.title,
            body: item.body,
            reviewedAt: item.reviewedAt,
            appVersion: item.appVersion,
          },
        })
        .catch(() => {});
    }

    return items;
  } catch (err) {
    console.warn(`gplay.reviews failed for ${cleanAppId}:`, err);
    return [];
  }
}
