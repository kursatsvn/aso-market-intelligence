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
