export interface ReviewCategoryCounts {
  pricing: number;
  bug: number;
  missingFeature: number;
  total: number;
}

export interface NGramFreq {
  phrase: string;
  count: number;
}

const STOPWORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of',
  'it', 'this', 'that', 'was', 'my', 'i', 'you', 'they', 'we', 'have', 'had', 'has', 'be', 'been',
  'not', 'so', 'as', 'if', 'just', 'from', 'by', 'are', 'were', 'their', 'app', 'apps',
  'all', 'after', 'again', 'very', 'more', 'also', 'out', 'up', 'down', 'only', 'can', 'cant', 'will',
  // Türkçe sık kullanılan bağlaç ve dolgular
  've', 'veya', 'ile', 'için', 'bir', 'bu', 'şu', 'o', 'da', 'de', 'ta', 'te', 'mi', 'mu', 'mü',
  'ama', 'fakat', 'ancak', 'çok', 'daha', 'gibi', 'kadar', 'en', 'ise', 'ben', 'sen', 'biz', 'uygulama',
  'tüm', 'bütün', 'sonra', 'yine', 'tekrar'
]);

const PRICING_REGEX = /(subscription|expensive|refund|trial|cancel|charge|overpriced|money|waste|paywall|abonelik|para|iptal|ücret|pahalı|kazık|soygun)/i;
const BUG_REGEX = /(crash|freeze|bug|black screen|error|sync|failed|glitch|update|broken|donuyor|hata|açılmıyor|kapandı|çöküyor|çöktü|kasıyor|atıyor)/i;
const MISSING_FEATURE_REGEX = /(wish|please add|missing|need|bring back|why can't|hope|export|widget|keşke|lütfen ekleyin|eksik|özellik|olsa|gelse)/i;

export function categorizeReview(text: string): { isPricing: boolean; isBug: boolean; isMissingFeature: boolean } {
  return {
    isPricing: PRICING_REGEX.test(text),
    isBug: BUG_REGEX.test(text),
    isMissingFeature: MISSING_FEATURE_REGEX.test(text),
  };
}

export function extractNGrams(reviews: string[], n: 2 | 3 = 2, topK = 20): NGramFreq[] {
  const counts = new Map<string, number>();

  for (const review of reviews) {
    // Küçük harfe çevir, özel karakterleri temizle
    const tokens = review
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && !STOPWORDS.has(t));

    if (tokens.length < n) continue;

    for (let i = 0; i <= tokens.length - n; i++) {
      const slice = tokens.slice(i, i + n);
      // Eğer grubun içindeki tüm kelimeler stopword değilse geçerli
      const phrase = slice.join(' ');
      counts.set(phrase, (counts.get(phrase) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([phrase, count]) => ({ phrase, count }))
    .filter(item => item.count >= 2) // en az 2 kere tekrar etmiş olsun
    .sort((a, b) => b.count - a.count)
    .slice(0, topK);
}
