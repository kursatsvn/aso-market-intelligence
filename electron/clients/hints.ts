import { XMLParser } from 'fast-xml-parser';
import { getStorefront } from '../../shared/storefronts.js';

export interface HintItem {
  term: string;
  rank: number; // 1-indexed
  priority?: number;
}

const parser = new XMLParser({
  ignoreAttributes: true,
});

export async function fetchHints(term: string, storefront = 'us'): Promise<HintItem[]> {
  const sf = getStorefront(storefront);
  const url = `https://search.itunes.apple.com/WebObjects/MZSearchHints.woa/wa/hints?clientApplication=Software&term=${encodeURIComponent(term)}`;

  const res = await fetch(url, {
    headers: {
      'X-Apple-Store-Front': `${sf.id},29`,
      'User-Agent': 'AppStore/3.0 (iOS; 17.0; iPhone15,2)',
      'Accept': 'text/xml, application/xml',
    },
  });

  if (!res.ok) {
    return [];
  }

  const xml = await res.text();
  const items: HintItem[] = [];

  try {
    const parsed = parser.parse(xml);
    // Plist structure: plist.dict.array.dict
    const rawArray = parsed?.plist?.dict?.array?.dict;
    const dicts = Array.isArray(rawArray) ? rawArray : rawArray ? [rawArray] : [];

    let rank = 1;
    for (const d of dicts) {
      if (d?.string) {
        let hintTerm = String(d.string).trim();
        if (hintTerm.includes(',http')) {
          hintTerm = hintTerm.split(',')[0].trim();
        }
        if (hintTerm) {
          items.push({
            term: hintTerm,
            rank: rank++,
            priority: typeof d.integer === 'number' ? d.integer : undefined,
          });
        }
      }
    }
  } catch {
    // Regex fallback in case XML parser behaves differently with DTD
    const regex = /<key>term<\/key>\s*<string>([^<]+)<\/string>/gi;
    let match;
    let rank = 1;
    while ((match = regex.exec(xml)) !== null) {
      let hintTerm = match[1].trim();
      if (hintTerm.includes(',http')) {
        hintTerm = hintTerm.split(',')[0].trim();
      }
      if (hintTerm && !items.some(x => x.term.toLowerCase() === hintTerm.toLowerCase())) {
        items.push({ term: hintTerm, rank: rank++ });
      }
    }
  }

  return items;
}

export async function expandKeywordSuggestions(seed: string, storefront = 'us'): Promise<string[]> {
  const results = new Set<string>();
  const normalizedSeed = seed.trim().toLowerCase();
  results.add(normalizedSeed);

  // 1. Direct hints
  const direct = await fetchHints(normalizedSeed, storefront);
  for (const h of direct) {
    results.add(h.term.toLowerCase());
  }

  // 2. Letters a-z expansion
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  // Batched to avoid overwhelming local network
  for (let i = 0; i < letters.length; i += 4) {
    const batch = letters.slice(i, i + 4);
    await Promise.all(
      batch.map(async (char) => {
        const sub = await fetchHints(`${normalizedSeed} ${char}`, storefront);
        for (const h of sub) {
          results.add(h.term.toLowerCase());
        }
      })
    );
  }

  return Array.from(results);
}
