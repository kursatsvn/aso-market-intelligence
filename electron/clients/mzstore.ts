import { getStorefrontHeader } from '../../shared/storefronts.js';

export interface SerpResultItem {
  rank: number;
  appId: string;
}

export async function fetchSerp(term: string, storefront = 'us'): Promise<SerpResultItem[]> {
  const url = `https://search.itunes.apple.com/WebObjects/MZStore.woa/wa/search?clientApplication=Software&media=software&term=${encodeURIComponent(term)}`;
  const sfHeader = getStorefrontHeader(storefront);

  try {
    const res = await fetch(url, {
      headers: {
        'X-Apple-Store-Front': sfHeader,
        'User-Agent': 'AppStore/3.0 (iOS; 17.0; iPhone15,2)',
        'Accept': 'application/json, text/javascript, */*',
        'Accept-Language': 'en-us, en;q=0.9',
      },
    });

    if (res.ok) {
      const data = await res.json() as any;
      const items: SerpResultItem[] = [];

      // Structure: data.bubbles[0].results[]
      const results = data?.bubbles?.[0]?.results;
      if (Array.isArray(results) && results.length > 0) {
        let rank = 1;
        for (const r of results) {
          const id = String(r.id || r.trackId || '');
          if (id && (r.type === 'software' || !r.type)) {
            items.push({ rank, appId: id });
            rank++;
            if (items.length >= 20) break;
          }
        }
        if (items.length > 0) return items;
      }
    }
  } catch {
    // proceed to fallback
  }

  // Fallback: iTunes Search API
  const fallbackUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=${storefront}&entity=software&limit=20`;
  const fbRes = await fetch(fallbackUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });

  if (!fbRes.ok) {
    throw new Error(`SERP search failed with status ${fbRes.status}: ${fbRes.statusText}`);
  }

  const fbData = await fbRes.json() as any;
  const items: SerpResultItem[] = [];
  if (Array.isArray(fbData?.results)) {
    let rank = 1;
    for (const r of fbData.results) {
      const id = String(r.trackId || '');
      if (id) {
        items.push({ rank, appId: id });
        rank++;
        if (items.length >= 20) break;
      }
    }
  }

  return items;
}
