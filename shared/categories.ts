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
