export interface AppLookupMetadata {
  id: string;
  name: string;
  bundleId: string;
  sellerName: string;
  primaryGenreId: number;
  releaseDate: Date;
  lastUpdated: Date;
  version: string;
  price: number;
  currency: string;
  averageRating: number;
  ratingCount: number;
  iconUrl: string;
}

export async function lookupApps(appIds: string[], country = 'us'): Promise<Map<string, AppLookupMetadata>> {
  const map = new Map<string, AppLookupMetadata>();
  if (!appIds.length) return map;

  const chunks: string[][] = [];
  for (let i = 0; i < appIds.length; i += 150) {
    chunks.push(appIds.slice(i, i + 150));
  }

  for (const chunk of chunks) {
    const url = `https://itunes.apple.com/lookup?id=${chunk.join(',')}&country=${country}&entity=software`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      continue;
    }

    const json = await res.json() as any;
    const results = json?.results;
    if (Array.isArray(results)) {
      for (const item of results) {
        if (item.wrapperType === 'software' || item.kind === 'software') {
          const id = String(item.trackId);
          map.set(id, {
            id,
            name: item.trackName || '',
            bundleId: item.bundleId || '',
            sellerName: item.artistName || '',
            primaryGenreId: Number(item.primaryGenreId) || 0,
            releaseDate: new Date(item.releaseDate || Date.now()),
            lastUpdated: new Date(item.currentVersionReleaseDate || item.releaseDate || Date.now()),
            version: item.version || '',
            price: Number(item.price) || 0,
            currency: item.currency || 'USD',
            averageRating: Number(item.averageUserRating) || 0,
            ratingCount: Number(item.userRatingCount) || 0,
            iconUrl: item.artworkUrl100 || item.artworkUrl512 || '',
          });
        }
      }
    }
  }

  return map;
}
