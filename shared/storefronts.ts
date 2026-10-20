export interface StorefrontConfig {
  code: string;       // 'us', 'tr', 'gb'
  id: string;         // '143441', '143480'
  name: string;
  defaultLang: string;
}

export const STOREFRONTS: Record<string, StorefrontConfig> = {
  us: { code: 'us', id: '143441', name: 'United States', defaultLang: 'en-US' },
  tr: { code: 'tr', id: '143480', name: 'Turkey', defaultLang: 'tr-TR' },
  gb: { code: 'gb', id: '143444', name: 'United Kingdom', defaultLang: 'en-GB' },
  de: { code: 'de', id: '143443', name: 'Germany', defaultLang: 'de-DE' },
  fr: { code: 'fr', id: '143442', name: 'France', defaultLang: 'fr-FR' },
  ca: { code: 'ca', id: '143455', name: 'Canada', defaultLang: 'en-CA' },
  au: { code: 'au', id: '143460', name: 'Australia', defaultLang: 'en-AU' },
  jp: { code: 'jp', id: '143462', name: 'Japan', defaultLang: 'ja-JP' },
};

export function getStorefront(code = 'us'): StorefrontConfig {
  return STOREFRONTS[code.toLowerCase()] ?? STOREFRONTS.us;
}

export function getStorefrontHeader(code = 'us'): string {
  const sf = getStorefront(code);
  return `${sf.id},24 t:native`;
}
