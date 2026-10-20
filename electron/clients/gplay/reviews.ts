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
  const namespacedAppId = `android:${cleanAppId}`;
  const lang = country.toLowerCase() === 'tr' ? 'tr' : 'en';
  const prisma = getPrisma();

  try {
    // 1. Önce NEWEST yorumları çek
    const rawRes = await gplay.reviews({
      appId: cleanAppId,
      country: country.toLowerCase(),
      lang,
      num: count,
      sort: gplay.sort.NEWEST,
    });

    let rawReviews: any[] = rawRes?.data || [];

    // 2. Eğer yeterli 1-3 yıldızlı şikayet çıkmadıysa HELPFULNESS (faydalı bulunan şikayetler) da çek
    const lowCount = rawReviews.filter(r => (Number(r.score) || 0) <= 3).length;
    if (lowCount < 15) {
      try {
        const helpfulRes = await gplay.reviews({
          appId: cleanAppId,
          country: country.toLowerCase(),
          lang,
          num: Math.min(count, 100),
          sort: gplay.sort.HELPFULNESS,
        });
        const helpfulData: any[] = helpfulRes?.data || [];
        const seenIds = new Set(rawReviews.map(r => r.id));
        for (const hr of helpfulData) {
          if (!seenIds.has(hr.id)) {
            seenIds.add(hr.id);
            rawReviews.push(hr);
          }
        }
      } catch {
        // Yardımcı istek başarısız olursa mevcut olanlarla devam et
      }
    }

    if (rawReviews.length === 0) {
      return [];
    }

    // 3. Yorum Röntgeni için 1, 2 ve 3 yıldızlı yorumları filtrele (eğer hiç şikayet yoksa tümünü al)
    let targetReviews = rawReviews.filter(r => {
      const score = Number(r.score) || 0;
      return score >= 1 && score <= 3;
    });

    if (targetReviews.length === 0) {
      targetReviews = rawReviews.slice(0, 50);
    }

    const items: GPlayReviewItem[] = [];
    for (const r of targetReviews) {
      const rating = Number(r.score) || 0;
      const text = (r.text || r.body || '').trim();
      if (!text) continue;

      const item: GPlayReviewItem = {
        id: `gplay_${r.id || Math.random().toString(36).slice(2)}`,
        appId: namespacedAppId,
        rating: Math.max(1, Math.min(5, rating)),
        title: r.title || '',
        body: text,
        reviewedAt: r.date ? new Date(r.date) : new Date(),
        appVersion: r.version || '',
      };

      items.push(item);
    }

    // 4. Foreign key kısıtlamasına takılmamak için App kaydının varlığını garantile
    try {
      await prisma.app.upsert({
        where: { id: namespacedAppId },
        update: { platform: 'android' },
        create: {
          id: namespacedAppId,
          platform: 'android',
          name: cleanAppId,
          bundleId: cleanAppId,
        },
      });
    } catch (e) {
      console.warn(`App record upsert error for ${namespacedAppId}:`, e);
    }

    // 5. Yorumları veritabanına kaydet
    await Promise.allSettled(
      items.map(item =>
        prisma.review.upsert({
          where: { id: item.id },
          update: {
            rating: item.rating,
            title: item.title,
            body: item.body,
            reviewedAt: item.reviewedAt,
            appVersion: item.appVersion,
          },
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
      )
    );

    return items;
  } catch (err) {
    console.warn(`gplay.reviews failed for ${cleanAppId}:`, err);
    return [];
  }
}
