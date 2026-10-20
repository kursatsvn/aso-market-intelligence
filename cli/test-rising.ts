import { getPrisma } from '../electron/db/prisma.js';
import { calculateRisingStar } from '../scoring/risingStar.js';

async function main() {
  const prisma = getPrisma();
  console.log(`\n======================================================`);
  console.log(`⭐ RISING STARS (Yeni & Hızlı Büyüyen Uygulamalar Radarı)`);
  console.log(`======================================================\n`);

  const apps = await prisma.app.findMany({
    include: {
      snapshots: {
        orderBy: { day: 'desc' },
        take: 2,
      },
    },
  });

  const results = [];
  for (const app of apps) {
    if (!app.releaseDate) continue;

    const pastSnapshot = app.snapshots.length > 1
      ? { ratingCount: app.snapshots[1].ratingCount, capturedAt: app.snapshots[1].capturedAt }
      : undefined;

    const res = calculateRisingStar({
      appId: app.id,
      name: app.name,
      releaseDate: app.releaseDate,
      hasIap: app.hasIap,
      ratingCount: app.ratingCount,
      averageRating: app.averageRating,
      pastSnapshot,
    });

    if (res.isEligible) {
      results.push({ app, res });
    }
  }

  results.sort((a, b) => b.res.score - a.res.score);

  if (results.length === 0) {
    console.log(`Şu an veritabanındaki 40 uygulama arasında son 180 günde çıkmış ve IAP barındıran aday bulunamadı.`);
    console.log(`(Yeni aramalar yaptıkça ve pazar tarandıkça burası otomatik dolacaktır.)\n`);
  } else {
    for (const { app, res } of results) {
      console.log(
        `⭐ Skor: ${res.score}/100 | Yaş: ${res.metrics.ageDays} gün | Günlük Hız: ~${res.metrics.dailyVelocity} yorum/gün | ${app.name}`
      );
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
