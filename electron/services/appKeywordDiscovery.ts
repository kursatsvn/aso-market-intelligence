import { getPrisma } from '../db/prisma.js';
import { fetchSerp } from '../clients/mzstore.js';
import { lookupApps } from '../clients/itunes.js';
import { fetchHints } from '../clients/hints.js';
import { fetchGPlayHints } from '../clients/gplay/hints.js';
import { fetchGPlaySerp } from '../clients/gplay/search.js';
import { analyzeKeyword } from './keywordPipeline.js';
import type { Platform } from '../../shared/platforms.js';
import gplayPkg from 'google-play-scraper';

const gplay = (gplayPkg as any).default || gplayPkg;

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'with', 'in', 'by', 'of', 'on', 'at', 'to', 'from',
  '&', '+', '-', 'app', 'apps', 'free', 'pro', 'lite', 'hd', 'new', 'official', 'mobile',
  've', 'ile', 'için', 'bir', 'bu', 'en', 'uygulama', 'uygulaması', 'ücretsiz', 'indir',
]);

/**
 * Uygulama başlığı ve alt başlığından arama kelimesi adayları üretir.
 */
function extractCandidateKeywords(appName: string, sellerName?: string): string[] {
  const candidates = new Set<string>();

  // 1. Orijinal başlığı segmentlere böl (örn: "Flo: Period Tracker & Calendar" -> ["Flo", "Period Tracker & Calendar"])
  const segments = appName.split(/[:|\-–—]/).map(s => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const cleaned = seg.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    if (cleaned.length >= 3 && cleaned.split(' ').length <= 4) {
      candidates.add(cleaned);
    }
  }

  // 2. Anlamlı 2'li ve 3'lü kelime öbekleri (N-Grams)
  const cleanTokens = appName
    .toLowerCase()
    .replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));

  // 2'li öbekler (örn: "habit tracker", "period calendar")
  for (let i = 0; i < cleanTokens.length - 1; i++) {
    candidates.add(`${cleanTokens[i]} ${cleanTokens[i + 1]}`);
  }

  // 3'lü öbekler (örn: "home gym workout")
  for (let i = 0; i < cleanTokens.length - 2; i++) {
    candidates.add(`${cleanTokens[i]} ${cleanTokens[i + 1]} ${cleanTokens[i + 2]}`);
  }

  // 3. Marka/Geliştirici adı tekil
  if (sellerName) {
    const cleanSeller = sellerName.toLowerCase().replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ\s]/g, '').trim();
    if (cleanSeller.length >= 3 && !cleanSeller.includes('inc') && !cleanSeller.includes('ltd')) {
      candidates.add(cleanSeller);
    }
  }

  return Array.from(candidates).slice(0, 8);
}

/**
 * Kullanıcı arama yapmadan, uygulamanın App Store veya Google Play'de üst sıralarda (#1 - #30)
 * yer aldığı anahtar kelimeleri otomatik olarak keşfeder.
 */
export async function discoverAppTopKeywords(
  appId: string,
  storefront = 'us',
  platform: Platform = 'ios',
  maxKeywordsToDiscover = 12
): Promise<any[]> {
  const prisma = getPrisma();
  const cleanId = appId.replace('android:', '');
  const possibleIds = [appId, cleanId, `android:${cleanId}`];

  // 1. Uygulama bilgilerini bul veya mağazadan getir
  let app = await prisma.app.findFirst({
    where: { id: { in: possibleIds } },
  });

  if (!app) {
    if (platform === 'android') {
      try {
        const raw = await gplay.app({ appId: cleanId, country: storefront });
        if (raw) {
          app = {
            id: `android:${cleanId}`,
            platform: 'android',
            name: raw.title || cleanId,
            sellerName: raw.developer || '',
            averageRating: raw.score || 0,
            ratingCount: raw.ratings || 0,
            installs: raw.installs || '',
            minInstalls: raw.minInstalls || 0,
            iconUrl: raw.icon || '',
            hasIap: !!raw.offersIAP,
          } as any;
        }
      } catch {
        // ignore
      }
    } else {
      try {
        const map = await lookupApps([cleanId], storefront);
        const meta = map.get(cleanId);
        if (meta) {
          app = {
            id: cleanId,
            platform: 'ios',
            name: meta.name,
            sellerName: meta.sellerName,
            averageRating: meta.averageRating,
            ratingCount: meta.ratingCount,
            iconUrl: meta.iconUrl,
            hasIap: false,
          } as any;
        }
      } catch {
        // ignore
      }
    }
  }

  if (!app) {
    throw new Error(`Uygulama bilgisi bulunamadı (ID: ${appId})`);
  }

  // 2. Başlıktan aday tohum kelimeler üret
  const seedKeywords = extractCandidateKeywords(app.name, app.sellerName || undefined);

  // 3. Autocomplete (Öneri) API'leri ile kullanıcıların gerçekte aradığı ilişkili kelimeleri genişlet
  const searchCandidates = new Set<string>(seedKeywords);

  for (const seed of seedKeywords.slice(0, 3)) {
    try {
      if (platform === 'android') {
        const hints = await fetchGPlayHints(seed, storefront);
        for (const h of hints.slice(0, 5)) {
          searchCandidates.add(h.term);
        }
      } else {
        const hints = await fetchHints(seed, storefront);
        for (const h of hints.slice(0, 5)) {
          searchCandidates.add(h.term);
        }
      }
    } catch {
      // devam et
    }
  }

  const candidateList = Array.from(searchCandidates).slice(0, 20);

  // 4. Hızlı SERP taraması ile uygulamanın ilk 30'da yer aldığı kelimeleri tespit et
  const matchedTerms: Array<{ term: string; rank: number }> = [];

  for (const term of candidateList) {
    try {
      if (platform === 'android') {
        const results = await fetchGPlaySerp(term, storefront, 30);
        const found = results.find(
          r => r.rawAppId === cleanId || r.id === appId || r.id === `android:${cleanId}`
        );
        if (found) {
          matchedTerms.push({ term, rank: found.rank });
        }
      } else {
        const results = await fetchSerp(term, storefront);
        const found = results.find(r => r.appId === cleanId || r.appId === appId);
        if (found) {
          matchedTerms.push({ term, rank: found.rank });
        }
      }
    } catch {
      // devam et
    }

    if (matchedTerms.length >= maxKeywordsToDiscover) break;
  }

  // 5. Sıralandığı tespit edilen anahtar kelimeleri pipeline ile detaylandırıp veritabanına kaydet
  // En üst sıradaki kelimeler öncelikli analiz edilir
  matchedTerms.sort((a, b) => a.rank - b.rank);

  for (const match of matchedTerms.slice(0, 10)) {
    try {
      await analyzeKeyword(match.term, storefront, platform, false);
    } catch {
      // devam et
    }
  }

  // 6. Veritabanındaki tüm güncel kayıtları çek ve sıralamaya göre döndür
  const serpEntries = await prisma.serpEntry.findMany({
    where: { appId: { in: possibleIds } },
    include: {
      keyword: {
        include: {
          metrics: {
            orderBy: { day: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ day: 'desc' }, { rank: 'asc' }],
  });

  const keywordMap = new Map<number, any>();
  for (const entry of serpEntries) {
    if (!keywordMap.has(entry.keywordId)) {
      const metric = entry.keyword.metrics[0];
      keywordMap.set(entry.keywordId, {
        id: entry.keyword.id,
        term: entry.keyword.term,
        storefront: entry.keyword.storefront,
        platform: entry.keyword.platform,
        rank: entry.rank,
        day: entry.day,
        popularity: metric?.popularity ?? 0,
        difficulty: metric?.difficulty ?? 0,
        opportunity: metric?.opportunity ?? 0,
      });
    }
  }

  const finalKeywords = Array.from(keywordMap.values()).sort((a, b) => a.rank - b.rank);

  return finalKeywords;
}
