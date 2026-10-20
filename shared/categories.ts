export interface AppCategory {
  id: number;
  name: string;
  nameTr: string;
  icon: string;
}

export const APP_CATEGORIES: AppCategory[] = [
  { id: 0, name: 'All Categories', nameTr: 'Tüm Kategoriler', icon: '🌐' },
  { id: 6013, name: 'Health & Fitness', nameTr: 'Sağlık ve Fitness', icon: '🏃' },
  { id: 6007, name: 'Productivity', nameTr: 'Verimlilik', icon: '⚡' },
  { id: 6000, name: 'Business', nameTr: 'İş', icon: '💼' },
  { id: 6015, name: 'Finance', nameTr: 'Finans', icon: '💰' },
  { id: 6017, name: 'Education', nameTr: 'Eğitim', icon: '🎓' },
  { id: 6002, name: 'Utilities', nameTr: 'Araçlar & İzlenceler', icon: '🛠️' },
  { id: 6012, name: 'Lifestyle', nameTr: 'Yaşam Tarzı', icon: '🌱' },
  { id: 6008, name: 'Photo & Video', nameTr: 'Fotoğraf & Video', icon: '📸' },
  { id: 6016, name: 'Entertainment', nameTr: 'Eğlence', icon: '🍿' },
  { id: 6005, name: 'Social Networking', nameTr: 'Sosyal Ağlar', icon: '💬' },
  { id: 6020, name: 'Medical', nameTr: 'Tıp', icon: '🩺' },
  { id: 6011, name: 'Music', nameTr: 'Müzik', icon: '🎵' },
  { id: 6024, name: 'Shopping', nameTr: 'Alışveriş', icon: '🛍️' },
  { id: 6003, name: 'Travel', nameTr: 'Seyahat', icon: '✈️' },
  { id: 6014, name: 'Games', nameTr: 'Oyunlar', icon: '🎮' },
];

/** Oyunlar ana kategorisinin ID'si */
export const GAMES_CATEGORY_ID = 6014;

/**
 * Oyunlar alt kategorileri (Apple genre ID'leri, canlı olarak doğrulanmıştır).
 */
export const GAME_SUBCATEGORIES: AppCategory[] = [
  { id: 7001, name: 'Action', nameTr: 'Aksiyon', icon: '💥' },
  { id: 7002, name: 'Adventure', nameTr: 'Macera', icon: '🗺️' },
  { id: 7003, name: 'Casual', nameTr: 'Basit / Hafif', icon: '🎈' },
  { id: 7004, name: 'Board', nameTr: 'Masa Oyunu', icon: '🎲' },
  { id: 7005, name: 'Card', nameTr: 'Kart', icon: '🃏' },
  { id: 7006, name: 'Casino', nameTr: 'Casino', icon: '🎰' },
  { id: 7009, name: 'Family', nameTr: 'Aile', icon: '👨‍👩‍👧' },
  { id: 7011, name: 'Music', nameTr: 'Müzik', icon: '🎶' },
  { id: 7012, name: 'Puzzle', nameTr: 'Bulmaca', icon: '🧩' },
  { id: 7013, name: 'Racing', nameTr: 'Yarış', icon: '🏎️' },
  { id: 7014, name: 'Role Playing', nameTr: 'Rol Yapma (RPG)', icon: '⚔️' },
  { id: 7015, name: 'Simulation', nameTr: 'Simülasyon', icon: '🏗️' },
  { id: 7016, name: 'Sports', nameTr: 'Spor', icon: '⚽' },
  { id: 7017, name: 'Strategy', nameTr: 'Strateji', icon: '♟️' },
  { id: 7018, name: 'Trivia', nameTr: 'Bilgi Yarışması', icon: '❓' },
  { id: 7019, name: 'Word', nameTr: 'Kelime', icon: '🔤' },
];

export const isGameSubcategory = (id: number): boolean => GAME_SUBCATEGORIES.some((g) => g.id === id);

export interface ChartTypeConfig {
  key: 'topfreeapplications' | 'topgrossingapplications' | 'toppaidapplications';
  label: string;
  labelTr: string;
}

export const CHART_TYPES: ChartTypeConfig[] = [
  { key: 'topfreeapplications', label: 'Top Free', labelTr: 'En Çok İndirilen Ücretsiz' },
  { key: 'topgrossingapplications', label: 'Top Grossing', labelTr: 'En Çok Hasılat Yapan (Ciro)' },
  { key: 'toppaidapplications', label: 'Top Paid', labelTr: 'Ücretli Uygulamalar' },
];

export interface GPlayCategory {
  id: string;
  name: string;
  nameTr: string;
  icon: string;
}

export const GPLAY_CATEGORIES: GPlayCategory[] = [
  { id: 'APPLICATION', name: 'All Apps', nameTr: 'Tüm Uygulamalar', icon: '🌐' },
  { id: 'FINANCE', name: 'Finance', nameTr: 'Finans', icon: '💰' },
  { id: 'PRODUCTIVITY', name: 'Productivity', nameTr: 'Verimlilik', icon: '⚡' },
  { id: 'BUSINESS', name: 'Business', nameTr: 'İş', icon: '💼' },
  { id: 'HEALTH_AND_FITNESS', name: 'Health & Fitness', nameTr: 'Sağlık ve Fitness', icon: '🏃' },
  { id: 'EDUCATION', name: 'Education', nameTr: 'Eğitim', icon: '🎓' },
  { id: 'TOOLS', name: 'Tools', nameTr: 'Araçlar', icon: '🛠️' },
  { id: 'LIFESTYLE', name: 'Lifestyle', nameTr: 'Yaşam Tarzı', icon: '🌱' },
  { id: 'PHOTOGRAPHY', name: 'Photography', nameTr: 'Fotoğrafçılık', icon: '📸' },
  { id: 'ENTERTAINMENT', name: 'Entertainment', nameTr: 'Eğlence', icon: '🍿' },
  { id: 'SOCIAL', name: 'Social', nameTr: 'Sosyal', icon: '💬' },
  { id: 'MEDICAL', name: 'Medical', nameTr: 'Tıp', icon: '🩺' },
  { id: 'MUSIC_AND_AUDIO', name: 'Music & Audio', nameTr: 'Müzik ve Ses', icon: '🎵' },
  { id: 'SHOPPING', name: 'Shopping', nameTr: 'Alışveriş', icon: '🛍️' },
  { id: 'TRAVEL_AND_LOCAL', name: 'Travel & Local', nameTr: 'Seyahat', icon: '✈️' },
  { id: 'GAME', name: 'Games', nameTr: 'Oyunlar', icon: '🎮' },
];

/** Google Play Oyunlar ana kategorisinin ID'si */
export const GPLAY_GAME_CATEGORY_ID = 'GAME';

/**
 * Google Play Oyun alt kategorileri
 */
export const GPLAY_GAME_SUBCATEGORIES: GPlayCategory[] = [
  { id: 'GAME_ACTION', name: 'Action', nameTr: 'Aksiyon', icon: '💥' },
  { id: 'GAME_ADVENTURE', name: 'Adventure', nameTr: 'Macera', icon: '🗺️' },
  { id: 'GAME_ARCADE', name: 'Arcade', nameTr: 'Arcade', icon: '🕹️' },
  { id: 'GAME_BOARD', name: 'Board', nameTr: 'Masa Oyunu', icon: '🎲' },
  { id: 'GAME_CARD', name: 'Card', nameTr: 'Kart Oyunu', icon: '🃏' },
  { id: 'GAME_CASINO', name: 'Casino', nameTr: 'Casino', icon: '🎰' },
  { id: 'GAME_CASUAL', name: 'Casual', nameTr: 'Basit Eğlence', icon: '🎈' },
  { id: 'GAME_EDUCATIONAL', name: 'Educational', nameTr: 'Eğitici', icon: '📚' },
  { id: 'GAME_MUSIC', name: 'Music', nameTr: 'Müzik', icon: '🎶' },
  { id: 'GAME_PUZZLE', name: 'Puzzle', nameTr: 'Bulmaca', icon: '🧩' },
  { id: 'GAME_RACING', name: 'Racing', nameTr: 'Yarış', icon: '🏎️' },
  { id: 'GAME_ROLE_PLAYING', name: 'Role Playing', nameTr: 'Rol Yapma (RPG)', icon: '⚔️' },
  { id: 'GAME_SIMULATION', name: 'Simulation', nameTr: 'Simülasyon', icon: '🏗️' },
  { id: 'GAME_SPORTS', name: 'Sports', nameTr: 'Spor', icon: '⚽' },
  { id: 'GAME_STRATEGY', name: 'Strategy', nameTr: 'Strateji', icon: '♟️' },
  { id: 'GAME_TRIVIA', name: 'Trivia', nameTr: 'Bilgi Yarışması', icon: '❓' },
  { id: 'GAME_WORD', name: 'Word', nameTr: 'Kelime', icon: '🔤' },
];

export const isGPlayGameSubcategory = (id: string | number): boolean =>
  typeof id === 'string' && GPLAY_GAME_SUBCATEGORIES.some((g) => g.id === id);


