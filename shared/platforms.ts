export type Platform = 'ios' | 'android';

export interface PlatformConfig {
  id: Platform;
  name: string;
  shortName: string;
  icon: string;
  badgeColor: string;
}

export const PLATFORMS: PlatformConfig[] = [
  {
    id: 'ios',
    name: 'Apple App Store',
    shortName: 'iOS',
    icon: '🍏',
    badgeColor: 'blue',
  },
  {
    id: 'android',
    name: 'Google Play Store',
    shortName: 'Android',
    icon: '🤖',
    badgeColor: 'emerald',
  },
];

/**
 * iOS App Store için yorum/değerlendirme sayısına dayalı ASO indirme tahmini üretir.
 * Apple indirme sayılarını halka açık paylaşmaz; endüstri standardı ASO çarpanı
 * (ortalama her 1 değerlendirme için 35 - 75 indirme) ile tahmini indirme hesaplanır.
 */
export function estimateIosInstalls(ratingCount: number): { formatted: string; minInstalls: number } {
  if (!ratingCount || ratingCount <= 0) {
    return { formatted: '< 500 (Tahmini)', minInstalls: 100 };
  }

  const multiplier = ratingCount < 1000 ? 35 : ratingCount < 20000 ? 45 : ratingCount < 100000 ? 60 : 75;
  const estimated = ratingCount * multiplier;

  let formatted = '';
  if (estimated >= 1_000_000_000) {
    formatted = `~${(estimated / 1_000_000_000).toFixed(1)}B+ (Tahmini)`;
  } else if (estimated >= 1_000_000) {
    formatted = `~${(estimated / 1_000_000).toFixed(1)}M+ (Tahmini)`;
  } else if (estimated >= 10_000) {
    formatted = `~${Math.round(estimated / 1000)}K+ (Tahmini)`;
  } else if (estimated >= 1_000) {
    formatted = `~${(estimated / 1000).toFixed(1)}K+ (Tahmini)`;
  } else {
    formatted = `~${Math.round(estimated)}+ (Tahmini)`;
  }

  return { formatted, minInstalls: estimated };
}
