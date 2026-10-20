import * as cheerio from 'cheerio';

const iapCache = new Map<string, { hasIap: boolean; checkedAt: number }>();
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün

export async function checkAppIap(appId: string, country = 'us'): Promise<boolean> {
  const cached = iapCache.get(appId);
  if (cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return cached.hasIap;
  }

  const url = `https://apps.apple.com/${country}/app/id${appId}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
      },
    });

    if (!res.ok) {
      return false;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // 1. Doğrudan metin kontrolü
    const textHasIap = /In-App Purchases|Uygulama İçi Satın Alım|In-App-Käufe|Achats intégrés/i.test(html);

    // 2. Information / Bilgi listesindeki IAP bölümü
    const listHasIap = $('.information-list__item:contains("In-App Purchases"), .information-list__item:contains("Uygulama İçi")').length > 0;

    // 3. Schema.org JSON-LD script kontrolü
    let jsonLdHasIap = false;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html() || '{}');
        if (parsed?.offers?.category === 'InAppPurchase' || Array.isArray(parsed?.offers?.offers)) {
          jsonLdHasIap = true;
        }
      } catch {
        // ignore
      }
    });

    const hasIap = textHasIap || listHasIap || jsonLdHasIap;
    iapCache.set(appId, { hasIap, checkedAt: Date.now() });
    return hasIap;
  } catch (err) {
    return false;
  }
}
