import gplayPkg from 'google-play-scraper';

const gplay = (gplayPkg as any).default || gplayPkg;

export interface GPlayHintItem {
  term: string;
  priority: number; // 1 (en yüksek) .. 10
}

/**
 * Google Play Store otomatik tamamlama önerilerini çeker.
 */
export async function fetchGPlayHints(term: string, country = 'us', lang = 'en'): Promise<GPlayHintItem[]> {
  const cleanTerm = term.trim().toLowerCase();
  if (!cleanTerm) return [];

  try {
    const rawHints: string[] = await gplay.suggest({
      term: cleanTerm,
      country: country.toLowerCase(),
      lang: lang.toLowerCase() || (country === 'tr' ? 'tr' : 'en'),
    });

    if (Array.isArray(rawHints) && rawHints.length > 0) {
      return rawHints.slice(0, 10).map((hint, idx) => ({
        term: hint.toLowerCase().trim(),
        priority: idx + 1,
      }));
    }
  } catch (err) {
    console.warn('gplay.suggest failed, trying Google suggest endpoint:', err);
  }

  // Yedek (Fallback): Google suggest API
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=android-browser&q=${encodeURIComponent(cleanTerm)}&hl=${country === 'tr' ? 'tr' : 'en'}&gl=${country}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json() as any[];
      const suggestions: string[] = data?.[1] || [];
      return suggestions.slice(0, 10).map((h, idx) => ({
        term: String(h).toLowerCase().trim(),
        priority: idx + 1,
      }));
    }
  } catch {
    // ignore
  }

  return [];
}
