import { clamp, bayesRating, daysBetween } from './common.js';

export interface RisingStarInput {
  appId: string;
  name: string;
  releaseDate: Date;
  hasIap: boolean;
  ratingCount: number;
  averageRating: number;
  pastSnapshot?: {
    ratingCount: number;
    capturedAt: Date;
  };
  now?: Date;
}

export interface RisingStarResult {
  score: number; // 0..100
  isEligible: boolean; // age <= 180 && hasIap && ratingCount >= 15
  isColdStart: boolean;
  confidence: number;
  metrics: {
    ageDays: number;
    rv30: number; // 30 günlük tahmini yorum artışı
    dailyVelocity: number;
    acceleration: number;
  };
}

export function calculateRisingStar(input: RisingStarInput): RisingStarResult {
  const now = input.now ?? new Date();
  const ageDays = Math.max(1, Math.round(daysBetween(input.releaseDate, now)));

  // Sert Kriterler
  const isEligible = ageDays <= 180 && input.hasIap && input.ratingCount >= 15;
  if (!isEligible) {
    return {
      score: 0,
      isEligible: false,
      isColdStart: false,
      confidence: 0,
      metrics: {
        ageDays,
        rv30: 0,
        dailyVelocity: 0,
        acceleration: 0,
      },
    };
  }

  let rv30 = 0;
  let dailyVelocity = 0;
  let acceleration = 1.0;
  let confidence = 0.40;
  let isColdStart = true;

  const past = input.pastSnapshot;
  const snapshotSpanDays = past ? daysBetween(past.capturedAt, now) : 0;

  if (past && snapshotSpanDays >= 7) {
    // Normal Mod: Gerçek Snapshot Delta Hesabı
    const deltaN = Math.max(0, input.ratingCount - past.ratingCount);
    dailyVelocity = deltaN / snapshotSpanDays;
    rv30 = dailyVelocity * 30;

    const lifetimeVelocity = input.ratingCount / ageDays;
    acceleration = dailyVelocity / Math.max(0.1, lifetimeVelocity);
    confidence = snapshotSpanDays >= 30 ? 1.0 : 0.75;
    isColdStart = false;
  } else {
    // Cold Start - İlk Gün / 7 Günden Az Veri: Uygulama Yaşına Göre Normalize Edilmiş Hız
    dailyVelocity = input.ratingCount / ageDays;
    rv30 = dailyVelocity * 30;
    acceleration = 1.0;
    confidence = 0.40;
    isColdStart = true;
  }

  // Normalize bileşenler
  const v = clamp(Math.log10(1 + rv30) / Math.log10(151), 0, 1);
  const acc = clamp(0.50 + Math.log2(Math.max(0.1, acceleration)) / 4, 0, 1);
  const fresh = clamp(1 - ageDays / 180, 0, 1);
  const bayes = bayesRating(input.averageRating, input.ratingCount);
  const q = clamp((bayes - 3.5) / 1.5, 0, 1);

  const rawScore = 100 * (0.45 * v + 0.25 * acc + 0.20 * fresh + 0.10 * q) * confidence;
  const score = Math.round(clamp(rawScore, 0, 100));

  return {
    score,
    isEligible: true,
    isColdStart,
    confidence,
    metrics: {
      ageDays,
      rv30: Math.round(rv30 * 10) / 10,
      dailyVelocity: Math.round(dailyVelocity * 100) / 100,
      acceleration: Math.round(acceleration * 100) / 100,
    },
  };
}
