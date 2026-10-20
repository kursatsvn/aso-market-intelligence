export interface RawReviewItem {
  id: string;
  rating: number;
  title: string;
  body: string;
  reviewedAt: Date;
  appVersion: string;
}

export async function fetchAppReviews(appId: string, country = 'us', maxPages = 10): Promise<RawReviewItem[]> {
  const reviews: RawReviewItem[] = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${appId}/sortby=mostrecent/json`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        break;
      }

      const data = await res.json() as any;
      const entries = data?.feed?.entry;
      if (!Array.isArray(entries) || entries.length === 0) {
        break;
      }

      for (const entry of entries) {
        // İlk eleman bazen uygulama meta bilgisidir, im:rating yoksa atla
        const ratingRaw = entry['im:rating']?.label;
        if (!ratingRaw) continue;

        const rating = parseInt(ratingRaw, 10);
        // Sadece 1, 2 ve 3 yıldızlı yorumları topluyoruz
        if (rating > 3) continue;

        const id = String(entry.id?.label || '');
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);

        const title = entry.title?.label || '';
        const body = entry.content?.label || '';
        if (body.trim().length < 10) continue; // çok kısa/boş yorumları atla

        const reviewedAt = entry.updated?.label ? new Date(entry.updated.label) : new Date();
        const appVersion = entry['im:version']?.label || '';

        reviews.push({
          id,
          rating,
          title,
          body,
          reviewedAt,
          appVersion,
        });

        if (reviews.length >= 500) break;
      }

      if (reviews.length >= 500) break;
    } catch {
      break;
    }
  }

  return reviews;
}
