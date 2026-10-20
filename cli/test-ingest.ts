import { analyzeKeyword } from '../electron/services/keywordPipeline.js';

async function main() {
  const keyword = process.argv[2] || 'habit tracker';
  const storefront = process.argv[3] || 'us';
  const platform = (process.argv[4] as 'ios' | 'android') || 'ios';

  console.log(`\n======================================================`);
  console.log(`🔍 ASO & Pazar İstihbaratı: "${keyword.toUpperCase()}" (${storefront.toUpperCase()} - ${platform.toUpperCase()})`);
  console.log(`======================================================\n`);
  console.log(`[1/5] Gerçek ${platform === 'android' ? 'Google Play' : 'App Store'} SERP çekiliyor...`);

  const startTime = Date.now();
  const res = await analyzeKeyword(keyword, storefront, platform, true);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n📊 SKORLAMA ÖZETİ (${elapsed} saniyede tamamlandı):`);
  console.log(`------------------------------------------------------`);
  console.log(`🔥 Arama Hacmi (Popularity) : ${res.popularity}/100  [Kaynak: ${res.popularitySource}]`);
  console.log(`🛡️  Keyword Difficulty (KD)  : ${res.kd}/100`);
  console.log(`🎯 Fırsat Skoru (Opportunity) : ${res.opportunity.score}/100  [Etiket: ${res.opportunity.tier.toUpperCase()}]`);
  console.log(`💡 Hedef Bölge (Pop>30 & KD<40): ${res.opportunity.inTargetZone ? '✅ EVET (GİRİLEBİLİR)' : '❌ HAYIR'}`);

  console.log(`\n🏆 İLK 10 RAKİP ANALİZİ:`);
  console.log(`------------------------------------------------------`);
  for (const app of res.topApps.slice(0, 10)) {
    const ageDays = Math.round((Date.now() - app.releaseDate.getTime()) / (1000 * 60 * 60 * 24));
    const ageYears = (ageDays / 365).toFixed(1);
    const iapBadge = app.hasIap ? '💎 [IAP/Abonelik]' : '🆓 [Ücretsiz]';
    console.log(
      `#${app.rank.toString().padEnd(2)} | ⭐ ${app.averageRating.toFixed(1)} (${app.ratingCount.toLocaleString().padStart(8)} yorum) | ${ageYears} yıl | ${iapBadge} | ${app.name.slice(0, 35)}`
    );
  }

  console.log(`\n🔍 LONG-TAIL KEYWORD ÖNERİLERİ (${res.suggestions.length} Adet):`);
  console.log(`------------------------------------------------------`);
  console.log(res.suggestions.slice(0, 15).map(s => `• ${s}`).join('\n'));

  if (res.reviewInsights) {
    console.log(`\n💬 #1 RAKİP YORUM RÖNTGENİ (${res.reviewInsights.appName}):`);
    console.log(`------------------------------------------------------`);
    console.log(`Toplanan 1-3 Yıldızlı Yorum : ${res.reviewInsights.reviewCount}`);
    console.log(`  💰 Fiyat/Abonelik Şikayeti : ${res.reviewInsights.categories.pricing}`);
    console.log(`  🐛 Hata/Çökme Şikayeti     : ${res.reviewInsights.categories.bug}`);
    console.log(`  ✨ Eksik Özellik Talebi    : ${res.reviewInsights.categories.missingFeature}`);
    
    if (res.reviewInsights.topBiGrams.length > 0) {
      console.log(`\nEn Çok Tekrar Eden Şikayet Öbekleri:`);
      for (const bg of res.reviewInsights.topBiGrams.slice(0, 6)) {
        console.log(`  📌 "${bg.phrase}": ${bg.count} kez`);
      }
    }
  }

  console.log(`\n💾 Tüm veriler yerel SQLite veritabanına (aso.db) kaydedildi.\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('\nHata oluştu:', err);
  process.exit(1);
});
