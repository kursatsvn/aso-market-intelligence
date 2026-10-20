'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  TrendingUp,
  MessageSquare,
  Database,
  Layers,
  Zap,
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
  RefreshCw,
  Lightbulb,
} from 'lucide-react';
import {
  APP_CATEGORIES,
  CHART_TYPES,
  GAMES_CATEGORY_ID,
  GAME_SUBCATEGORIES,
  GPLAY_CATEGORIES,
  GPLAY_GAME_CATEGORY_ID,
  GPLAY_GAME_SUBCATEGORIES,
  isGameSubcategory,
  isGPlayGameSubcategory,
  type AppCategory,
  type GPlayCategory,
} from '../shared/categories';
import { PLATFORMS, type Platform, estimateIosInstalls } from '../shared/platforms';

interface ElectronApi {
  analyzeKeyword: (term: string, storefront?: string, platform?: string | boolean, pullReviews?: boolean) => Promise<any>;
  getOpportunitySuggestions: (storefront?: string, seed?: string) => Promise<any>;
  getStoredKeywords: (platform?: string) => Promise<any>;
  getStoredApps: (platform?: string) => Promise<any>;
  getRisingStars: (platform?: string) => Promise<any>;
  getAppReviews: (appId: string, storefront?: string) => Promise<any>;
  getCategoryTopCharts: (genreId: any, chartType: string, storefront?: string, limit?: number, platform?: string) => Promise<any>;
}

declare global {
  interface Window {
    api?: ElectronApi;
  }
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'explorer' | 'categories' | 'stored' | 'suggestions' | 'rising' | 'reviews'>('explorer');
  const [platform, setPlatform] = useState<Platform>('ios');
  const [storedPlatformFilter, setStoredPlatformFilter] = useState<'all' | 'ios' | 'android'>('all');
  const [searchTerm, setSearchTerm] = useState('habit tracker');
  const [storefront, setStorefront] = useState('us');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analiz Sonuçları (Keyword Explorer)
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Kategori Sıralamaları (Top Charts)
  const [selectedCategory, setSelectedCategory] = useState<number | string>(6013); // iOS: 6013, Android: 'APPLICATION'
  const [selectedChartType, setSelectedChartType] = useState<string>('topfreeapplications');
  const [selectedLimit, setSelectedLimit] = useState<number>(200);
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>('');
  const [categoryApps, setCategoryApps] = useState<any[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [ageFilterDays, setAgeFilterDays] = useState<number | null>(null); // null = tümü
  const [categorySort, setCategorySort] = useState<'rank' | 'newest' | 'oldest'>('rank');

  // Kayıtlı Kelimeler
  const [storedKeywords, setStoredKeywords] = useState<any[]>([]);
  const [filterGoldOnly, setFilterGoldOnly] = useState(false);

  // Rising Stars
  const [risingStars, setRisingStars] = useState<any[]>([]);

  // Fırsat Önerileri
  const [suggestions, setSuggestions] = useState<any>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [customSeed, setCustomSeed] = useState('');
  const [analyzingTerm, setAnalyzingTerm] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number; current: string } | null>(null);

  // Yorum Röntgeni
  const [selectedAppForReviews, setSelectedAppForReviews] = useState<any>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewCategoryFilter, setReviewCategoryFilter] = useState<'all' | 'pricing' | 'bug' | 'missingFeature'>('all');

  // İlk yüklemede verileri çek
  useEffect(() => {
    loadStoredKeywords();
    loadRisingStars();
    loadCategoryTopCharts(selectedCategory, selectedChartType, storefront, selectedLimit, platform);
  }, []);

  const handleSwitchPlatform = (newPlat: Platform) => {
    setPlatform(newPlat);
    if (newPlat === 'android') {
      setSelectedCategory('APPLICATION');
      if (activeTab === 'categories') {
        loadCategoryTopCharts('APPLICATION', selectedChartType, storefront, selectedLimit, 'android');
      }
    } else {
      setSelectedCategory(6013);
      if (activeTab === 'categories') {
        loadCategoryTopCharts(6013, selectedChartType, storefront, selectedLimit, 'ios');
      }
    }
    loadStoredKeywords();
    loadRisingStars(newPlat);
  };

  const loadStoredKeywords = async (platFilter = storedPlatformFilter) => {
    if (window.api) {
      const filterArg = platFilter === 'all' ? undefined : platFilter;
      const res = await window.api.getStoredKeywords(filterArg);
      if (res?.success) setStoredKeywords(res.data);
    }
  };

  const loadRisingStars = async (plat = platform) => {
    if (window.api) {
      const res = await window.api.getRisingStars(plat);
      if (res?.success) setRisingStars(res.data);
    }
  };

  const loadSuggestions = async (sf = storefront, seed = customSeed) => {
    if (!window.api) return;
    setSuggestLoading(true);
    setSuggestError(null);
    try {
      const res = await window.api.getOpportunitySuggestions(sf, seed.trim() || undefined);
      if (res?.success) {
        setSuggestions(res.data);
      } else {
        setSuggestError(res?.error || 'Öneriler alınamadı');
      }
    } catch (err: any) {
      setSuggestError(err.message || 'Hata oluştu');
    } finally {
      setSuggestLoading(false);
    }
  };

  // Tek bir adayı hızlıca (yorum indirmeden) analiz edip listeyi tazeler
  const analyzeCandidate = async (term: string) => {
    if (!window.api || analyzingTerm || scanProgress) return;
    setAnalyzingTerm(term);
    try {
      await window.api.analyzeKeyword(term, storefront, platform, false);
      await loadStoredKeywords();
      await loadSuggestions();
    } finally {
      setAnalyzingTerm(null);
    }
  };

  // En yüksek tahmini skorlu ilk N adayı sırayla analiz eder
  const scanTopCandidates = async (count = 8) => {
    if (!window.api || scanProgress || analyzingTerm || !suggestions?.candidates?.length) return;
    const targets: string[] = suggestions.candidates.slice(0, count).map((c: any) => c.term);
    for (let i = 0; i < targets.length; i++) {
      setScanProgress({ done: i, total: targets.length, current: targets[i] });
      try {
        await window.api.analyzeKeyword(targets[i], storefront, platform, false);
      } catch {
        // Tek bir kelimedeki ağ hatası taramayı durdurmasın
      }
    }
    setScanProgress(null);
    await loadStoredKeywords();
    await loadSuggestions();
  };

  const openInExplorer = (term: string) => {
    setSearchTerm(term);
    setActiveTab('explorer');
    handleAnalyze(term);
  };

  const loadCategoryTopCharts = async (
    genreId: any = selectedCategory,
    chartType = selectedChartType,
    sf = storefront,
    limit = selectedLimit,
    plat = platform
  ) => {
    setCategoryLoading(true);
    setCategoryError(null);

    if (window.api) {
      try {
        const res = await window.api.getCategoryTopCharts(genreId, chartType, sf, limit, plat);
        if (res?.success) {
          setCategoryApps(res.data);
        } else {
          setCategoryError(res?.error || 'Kategori verisi alınamadı');
        }
      } catch (err: any) {
        setCategoryError(err.message || 'Hata oluştu');
      } finally {
        setCategoryLoading(false);
      }
    } else {
      // Tarayıcı önizleme fallback
      setTimeout(() => {
        setCategoryApps([
          {
            rank: 1,
            id: '1573778936',
            name: 'MAC+: Gym & Home Workouts',
            sellerName: 'Mars Sportif',
            averageRating: 4.8,
            ratingCount: 45400,
            hasIap: true,
            price: 0,
            releaseDate: new Date('2021-06-01'),
          },
          {
            rank: 2,
            id: '1099770',
            name: 'Period & Cycle Tracker',
            sellerName: 'Flo Health',
            averageRating: 4.9,
            ratingCount: 80700,
            hasIap: true,
            price: 0,
            releaseDate: new Date('2018-03-12'),
          },
        ]);
        setCategoryLoading(false);
      }, 500);
    }
  };

  const handleAnalyze = async (termToAnalyze = searchTerm) => {
    if (!termToAnalyze.trim()) return;
    setLoading(true);
    setError(null);

    if (window.api) {
      try {
        const res = await window.api.analyzeKeyword(termToAnalyze.trim(), storefront, platform);
        if (res?.success) {
          setAnalysisResult(res.data);
          loadStoredKeywords();
        } else {
          setError(res?.error || 'Analiz sırasında bir hata oluştu');
        }
      } catch (err: any) {
        setError(err.message || 'Hata oluştu');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOpenReviews = async (app: any) => {
    setSelectedAppForReviews(app);
    setActiveTab('reviews');
    setReviewData(null);
    setReviewLoading(true);
    setReviewError(null);

    if (window.api) {
      try {
        const res = await window.api.getAppReviews(app.id, storefront);
        if (res?.success) {
          setReviewData(res.data);
        } else {
          setReviewError(res?.error || 'Yorumlar alınamadı');
        }
      } catch (err: any) {
        setReviewError(err.message || 'Hata oluştu');
      } finally {
        setReviewLoading(false);
      }
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#090d16] text-slate-100">
      {/* Üst Başlık & Menü */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800/80 bg-[#0c1222] px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-lg shadow-blue-500/20">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              ASO Pazar İstihbarat Radarı
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400 border border-blue-500/20">
                Local-First / Zero-LLM
              </span>
            </h1>
            <p className="text-xs text-slate-400">Saf Matematiksel Skorlama & Yerel SQLite</p>
          </div>
        </div>

        {/* Tab Butonları */}
        <nav className="flex items-center gap-1 rounded-xl bg-slate-900/80 p-1 border border-slate-800">
          <button
            onClick={() => setActiveTab('explorer')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'explorer'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Search className="h-4 w-4" />
            Keyword Explorer
          </button>
          <button
            onClick={() => {
              setActiveTab('categories');
              loadCategoryTopCharts(selectedCategory, selectedChartType, storefront);
            }}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'categories'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Kategori Sıralamaları
          </button>
          <button
            onClick={() => {
              setActiveTab('stored');
              loadStoredKeywords();
            }}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'stored'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Database className="h-4 w-4" />
            Kayıtlı Kelimeler ({storedKeywords.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('suggestions');
              loadSuggestions();
            }}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'suggestions'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Lightbulb className="h-4 w-4" />
            Fırsat Önerileri
          </button>
          <button
            onClick={() => {
              setActiveTab('rising');
              loadRisingStars();
            }}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'rising'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Rising Stars
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeTab === 'reviews'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Yorum Röntgeni
          </button>
        </nav>

        {/* Platform & Storefront Seçimi */}
        <div className="flex items-center gap-3">
          {/* Store Switcher (iOS vs Android) */}
          <div className="flex items-center rounded-xl bg-slate-900/90 p-1 border border-slate-800 shadow-inner">
            <button
              onClick={() => handleSwitchPlatform('ios')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                platform === 'ios'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🍏</span>
              <span>App Store</span>
            </button>
            <button
              onClick={() => handleSwitchPlatform('android')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                platform === 'android'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🤖</span>
              <span>Google Play</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Ülke:</span>
            <select
              value={storefront}
              onChange={(e) => {
                const newSf = e.target.value;
                setStorefront(newSf);
                if (activeTab === 'categories') {
                  loadCategoryTopCharts(selectedCategory, selectedChartType, newSf, selectedLimit, platform);
                }
                if (activeTab === 'suggestions') {
                  loadSuggestions(newSf);
                }
              }}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="us">🇺🇸 ABD (US)</option>
              <option value="tr">🇹🇷 Türkiye (TR)</option>
              <option value="gb">🇬🇧 Birleşik Krallık (GB)</option>
              <option value="de">🇩🇪 Almanya (DE)</option>
            </select>
          </div>
        </div>
      </header>

      {/* Ana İçerik Alanı */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* ================= TAB 1: KEYWORD EXPLORER ================= */}
        {activeTab === 'explorer' && (
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder={
                    platform === 'android'
                      ? 'Google Play anahtar kelimesi yazın... (Örn: borsa, kripto, finans, habit tracker)'
                      : 'App Store anahtar kelimesi yazın... (Örn: habit tracker, su içme, pomodoro)'
                  }
                  className="w-full rounded-2xl border border-slate-800 bg-[#0f172a] py-3.5 pl-12 pr-4 text-sm font-medium text-slate-100 placeholder-slate-500 shadow-inner focus:border-blue-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => handleAnalyze()}
                disabled={loading}
                className={`flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-white shadow-lg transition-all disabled:opacity-50 ${
                  platform === 'android'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                    : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                }`}
              >
                {loading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                {loading ? 'Analiz Ediliyor...' : `${platform === 'android' ? 'Play Store' : 'App Store'} Analiz Et`}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {analysisResult && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-2xl border border-slate-800/80 bg-[#0f172a] p-5">
                    <span className="text-xs font-medium text-slate-400">Arama Hacmi (Popularity)</span>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-white">{analysisResult.popularity}</span>
                      <span className="text-xs text-slate-500">/ 100</span>
                    </div>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${analysisResult.popularity}%` }} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800/80 bg-[#0f172a] p-5">
                    <span className="text-xs font-medium text-slate-400">Keyword Difficulty (KD)</span>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className={`text-3xl font-extrabold ${
                        analysisResult.kd > 70 ? 'text-red-400' : analysisResult.kd > 40 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {analysisResult.kd}
                      </span>
                      <span className="text-xs text-slate-500">/ 100</span>
                    </div>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          analysisResult.kd > 70 ? 'bg-red-500' : analysisResult.kd > 40 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${analysisResult.kd}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800/80 bg-[#0f172a] p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-400">Fırsat Skoru</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        analysisResult.opportunity.tier === 'gold'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {analysisResult.opportunity.tier}
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-white">{analysisResult.opportunity.score}</span>
                      <span className="text-xs text-slate-500">/ 100</span>
                    </div>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${analysisResult.opportunity.score}%` }} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800/80 bg-[#0f172a] p-5">
                    <span className="text-xs font-medium text-slate-400">Hedef Bölge Durumu</span>
                    <div className="mt-3 flex items-center gap-2">
                      {analysisResult.opportunity.inTargetZone ? (
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
                          <CheckCircle2 className="h-6 w-6" />
                          <span>GİRİLEBİLİR</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400 font-semibold text-base">
                          <XCircle className="h-5 w-5 text-slate-500" />
                          <span>Hedef Dışı</span>
                        </div>
                      )}
                    </div>
                    <p className="mt-3 text-[11px] text-slate-500">
                      {analysisResult.opportunity.inTargetZone
                        ? 'Yüksek hacim ve düşük rekabetle girilmesi önerilir.'
                        : 'Pazar doymuş ya da hacim yetersiz.'}
                    </p>
                  </div>
                </div>

                {/* Long-Tail Öneriler */}
                {analysisResult.suggestions?.length > 0 && (
                  <div className="rounded-2xl border border-slate-800/80 bg-[#0f172a] p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-blue-400" />
                      Long-Tail Otomatik Tamamlama Önerileri
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.suggestions.map((s: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSearchTerm(s);
                            handleAnalyze(s);
                          }}
                          className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-blue-500/50 hover:bg-blue-600/10 hover:text-blue-300"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* SERP Tablosu */}
                <div className="rounded-2xl border border-slate-800/80 bg-[#0f172a] overflow-hidden">
                  <div className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Award className="h-4 w-4 text-amber-400" />
                        App Store İlk 20 Sıralama (SERP)
                      </h3>
                      <p className="text-xs text-slate-400">Gerçek sıralama, puan ve monetizasyon modeli</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                        <tr>
                          <th className="py-3 px-4 w-12 text-center">Sıra</th>
                          <th className="py-3 px-4">Uygulama Adı</th>
                          <th className="py-3 px-4">Puan &amp; Yorum</th>
                          <th className="py-3 px-4">Uygulama Yaşı</th>
                          <th className="py-3 px-4">Monetizasyon</th>
                          <th className="py-3 px-4 text-right">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {analysisResult.topApps.map((app: any) => {
                          const ageDays = Math.round(
                            (Date.now() - new Date(app.releaseDate).getTime()) / (1000 * 60 * 60 * 24)
                          );
                          const ageYears = (ageDays / 365).toFixed(1);

                          return (
                            <tr key={app.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="py-3.5 px-4 font-mono font-bold text-center text-slate-400">
                                #{app.rank}
                              </td>
                              <td className="py-3.5 px-4 font-medium text-white max-w-xs truncate">
                                {app.name}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                                  <span>⭐ {app.averageRating.toFixed(1)}</span>
                                  <span className="text-[11px] text-slate-500 font-normal">
                                    ({app.ratingCount.toLocaleString()} yorum)
                                  </span>
                                </div>
                                {(app.installs || (app.ratingCount > 0 ? estimateIosInstalls(app.ratingCount).formatted : undefined)) && (
                                  <span className="mt-0.5 inline-block text-[10px] text-emerald-400 font-medium">
                                    ⬇️ {app.installs || estimateIosInstalls(app.ratingCount).formatted} indirme
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-slate-400">
                                {ageYears} yıl ({ageDays} gün)
                              </td>
                              <td className="py-3.5 px-4">
                                {app.hasIap ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-400 border border-indigo-500/20">
                                    💎 Abonelik / IAP
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                                    🆓 Ücretsiz
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  onClick={() => handleOpenReviews(app)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600/10 px-2.5 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all"
                                >
                                  <MessageSquare className="h-3 w-3" />
                                  Yorumları Gör
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ================= TAB 2: KATEGORİ SIRALAMALARI (YENİ - 200'E KADAR) ================= */}
        {activeTab === 'categories' && (() => {
          const DAY_MS = 1000 * 60 * 60 * 24;
          // Yayın tarihi bilinmeyen (epoch) kayıtlar zaman filtresine dahil edilmez
          const releaseTime = (app: any): number => new Date(app.releaseDate).getTime();
          const hasReleaseDate = (app: any): boolean => releaseTime(app) > 0;

          const filteredCategoryApps = categoryApps
            .filter((app: any) => {
              if (ageFilterDays !== null) {
                if (!hasReleaseDate(app)) return false;
                if ((Date.now() - releaseTime(app)) / DAY_MS > ageFilterDays) return false;
              }
              if (!categorySearchQuery.trim()) return true;
              const q = categorySearchQuery.toLowerCase();
              return (
                app.name?.toLowerCase().includes(q) ||
                app.sellerName?.toLowerCase().includes(q)
              );
            })
            .sort((a: any, b: any) => {
              if (categorySort === 'newest') return releaseTime(b) - releaseTime(a);
              if (categorySort === 'oldest') {
                // Tarihi bilinmeyenler en sona
                const ta = hasReleaseDate(a) ? releaseTime(a) : Infinity;
                const tb = hasReleaseDate(b) ? releaseTime(b) : Infinity;
                return ta === tb ? 0 : ta - tb;
              }
              return a.rank - b.rank;
            });

          return (
            <div className="mx-auto max-w-7xl space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <BarChart3 className={`h-5 w-5 ${platform === 'android' ? 'text-emerald-400' : 'text-blue-400'}`} />
                      Kategoriye Göre {platform === 'android' ? 'Google Play' : 'App Store'} Sıralamaları (Top Charts)
                    </h2>
                    <p className="text-xs text-slate-400">
                      Herhangi bir anahtar kelime girmeden doğrudan mağaza kategorilerindeki lider uygulamaları inceleyin
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Limit:</span>
                    {[50, 100, 200].map((l) => (
                      <button
                        key={l}
                        onClick={() => {
                          setSelectedLimit(l);
                          loadCategoryTopCharts(selectedCategory, selectedChartType, storefront, l);
                        }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                          selectedLimit === l
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        {l === 200 ? 'Top 200 (Tam)' : `Top ${l}`}
                      </button>
                    ))}
                    <button
                      onClick={() => loadCategoryTopCharts(selectedCategory, selectedChartType, storefront, selectedLimit)}
                      disabled={categoryLoading}
                      title="Yenile"
                      className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#0f172a] px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${categoryLoading ? 'animate-spin text-blue-500' : ''}`} />
                      Yenile
                    </button>
                  </div>
                </div>

                {/* Grafik Türü Seçimi & İçi Arama Çubuğu */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                    {CHART_TYPES.map((ct) => (
                      <button
                        key={ct.key}
                        onClick={() => {
                          setSelectedChartType(ct.key);
                          loadCategoryTopCharts(selectedCategory, ct.key, storefront, selectedLimit);
                        }}
                        className={`rounded-xl px-4 py-2 text-xs font-bold transition-all shrink-0 ${
                          selectedChartType === ct.key
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                            : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        {ct.labelTr}
                      </button>
                    ))}
                  </div>

                  {/* Kategori İçi Hızlı Arama & Sayaç */}
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={categorySearchQuery}
                        onChange={(e) => setCategorySearchQuery(e.target.value)}
                        placeholder="Uygulama veya geliştirici ara..."
                        className="w-56 rounded-xl border border-slate-800 bg-[#0f172a] py-1.5 pl-8 pr-3 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {categorySearchQuery && (
                        <button
                          onClick={() => setCategorySearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <span className="rounded-lg bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-300 border border-slate-700/60">
                      {filteredCategoryApps.length} / {categoryApps.length} Uygulama
                    </span>
                  </div>
                </div>

                {/* Zamana Göre Filtre & Sıralama */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                    <span className="shrink-0 text-xs font-medium text-slate-400">📅 Yayın Tarihi:</span>
                    {[
                      { label: 'Tümü', days: null },
                      { label: 'Son 30 Gün', days: 30 },
                      { label: 'Son 3 Ay', days: 90 },
                      { label: 'Son 6 Ay', days: 180 },
                      { label: 'Son 1 Yıl', days: 365 },
                      { label: 'Son 2 Yıl', days: 730 },
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => setAgeFilterDays(opt.days)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                          ageFilterDays === opt.days
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                            : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400">Sırala:</span>
                    <select
                      value={categorySort}
                      onChange={(e) => setCategorySort(e.target.value as 'rank' | 'newest' | 'oldest')}
                      className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="rank">Mağaza Sırası</option>
                      <option value="newest">En Yeni Önce</option>
                      <option value="oldest">En Eski Önce</option>
                    </select>
                  </div>
                </div>

                {/* Kategori Seçim Butonları (Yatay Kaydırma) */}
                <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                  {platform === 'android' ? (
                    GPLAY_CATEGORIES.map((cat: GPlayCategory) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          loadCategoryTopCharts(cat.id, selectedChartType, storefront, selectedLimit, 'android');
                        }}
                        className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                          selectedCategory === cat.id ||
                          (cat.id === GPLAY_GAME_CATEGORY_ID && isGPlayGameSubcategory(selectedCategory))
                            ? 'border border-emerald-500 bg-emerald-600/20 text-emerald-300 shadow-sm'
                            : 'border border-slate-800 bg-[#0f172a] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.nameTr}</span>
                      </button>
                    ))
                  ) : (
                    APP_CATEGORIES.map((cat: AppCategory) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          loadCategoryTopCharts(cat.id, selectedChartType, storefront, selectedLimit, 'ios');
                        }}
                        className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium transition-all ${
                          selectedCategory === cat.id ||
                          (typeof selectedCategory === 'number' && cat.id === GAMES_CATEGORY_ID && isGameSubcategory(selectedCategory))
                            ? 'border border-blue-500 bg-blue-600/20 text-blue-300 shadow-sm'
                            : 'border border-slate-800 bg-[#0f172a] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.nameTr}</span>
                      </button>
                    ))
                  )}
                </div>

                {/* Oyunlar Alt Kategorileri (App Store / iOS) */}
                {platform === 'ios' && (selectedCategory === GAMES_CATEGORY_ID || (typeof selectedCategory === 'number' && isGameSubcategory(selectedCategory))) && (
                  <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      🎮 App Store Oyun Türleri
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: GAMES_CATEGORY_ID, nameTr: 'Tüm Oyunlar', icon: '🎮' } as AppCategory,
                        ...GAME_SUBCATEGORIES,
                      ].map((sub: AppCategory) => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setSelectedCategory(sub.id);
                            loadCategoryTopCharts(sub.id, selectedChartType, storefront, selectedLimit, 'ios');
                          }}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                            selectedCategory === sub.id
                              ? 'border border-blue-500 bg-blue-600/20 text-blue-300'
                              : 'border border-slate-800 bg-[#0f172a] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <span>{sub.icon}</span>
                          <span>{sub.nameTr}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Oyunlar Alt Kategorileri (Google Play / Android) */}
                {platform === 'android' && (selectedCategory === GPLAY_GAME_CATEGORY_ID || isGPlayGameSubcategory(selectedCategory)) && (
                  <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      🎮 Google Play Oyun Türleri
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: GPLAY_GAME_CATEGORY_ID, nameTr: 'Tüm Oyunlar', icon: '🎮' } as GPlayCategory,
                        ...GPLAY_GAME_SUBCATEGORIES,
                      ].map((sub: GPlayCategory) => (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setSelectedCategory(sub.id);
                            loadCategoryTopCharts(sub.id, selectedChartType, storefront, selectedLimit, 'android');
                          }}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                            selectedCategory === sub.id
                              ? 'border border-emerald-500 bg-emerald-600/20 text-emerald-300'
                              : 'border border-slate-800 bg-[#0f172a] text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <span>{sub.icon}</span>
                          <span>{sub.nameTr}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {categoryLoading ? (
                <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-16 text-center text-slate-400">
                  <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-500 mb-3" />
                  <p className="text-sm font-semibold text-slate-300">{selectedLimit} uygulama canlı çekiliyor...</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {platform === 'android' ? 'Google Play liderleri ve indirme/puan bilgileri taranıyor' : 'App Store liderleri ve fiyat/puan bilgileri taranıyor'}
                  </p>
                </div>
              ) : categoryError ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                  {categoryError}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800/80 bg-[#0f172a] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">Sıra</th>
                        <th className="py-3 px-4">Uygulama Adı</th>
                        <th className="py-3 px-4">Geliştirici</th>
                        <th className="py-3 px-4">Puan &amp; Yorum</th>
                        <th className="py-3 px-4">Yayın Tarihi / Yaş</th>
                        <th className="py-3 px-4">Monetizasyon</th>
                        <th className="py-3 px-4 text-right">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredCategoryApps.map((app: any) => {
                        const knownDate = new Date(app.releaseDate).getTime() > 0;
                        const ageDays = Math.round(
                          (Date.now() - new Date(app.releaseDate).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        const ageYears = (ageDays / 365).toFixed(1);

                        return (
                          <tr key={app.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3.5 px-4 font-mono font-bold text-center text-slate-400">
                              #{app.rank}
                            </td>
                            <td className="py-3.5 px-4 font-medium text-white max-w-xs truncate">
                              <div className="flex items-center gap-3">
                                {app.iconUrl && (
                                  <img src={app.iconUrl} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />
                                )}
                                <span className="truncate">{app.name}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-slate-400 truncate max-w-[150px]">
                              {app.sellerName}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                                <span>⭐ {app.averageRating.toFixed(1)}</span>
                                <span className="text-[11px] text-slate-500 font-normal">
                                  ({app.ratingCount.toLocaleString()} yorum)
                                </span>
                              </div>
                              {(app.installs || (app.ratingCount > 0 ? estimateIosInstalls(app.ratingCount).formatted : undefined)) && (
                                <span className="mt-0.5 inline-block text-[10px] text-emerald-400 font-medium">
                                  ⬇️ {app.installs || estimateIosInstalls(app.ratingCount).formatted} indirme
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-slate-400">
                              {knownDate ? (
                                <>
                                  <span className="block text-slate-300">
                                    {new Date(app.releaseDate).toLocaleDateString('tr-TR')}
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    {ageYears} yıl ({ageDays} gün)
                                  </span>
                                </>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {app.hasIap ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-400 border border-indigo-500/20">
                                  💎 Abonelik / IAP
                                </span>
                              ) : app.price > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                                  💵 {app.currency}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                                  🆓 Ücretsiz
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => handleOpenReviews(app)}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-600/10 px-2.5 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all"
                              >
                                <MessageSquare className="h-3 w-3" />
                                Yorumları Gör
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredCategoryApps.length === 0 && !categoryLoading && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            {categorySearchQuery ? 'Aramanızla eşleşen uygulama bulunamadı.' : 'Bu kategori için veri bulunamadı.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {/* ================= TAB 3: KAYITLI KELİMELER ================= */}
        {activeTab === 'stored' && (
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Veritabanındaki Kayıtlı Kelimeler</h2>
                <p className="text-xs text-slate-400">Yerel SQLite tablonuzda biriken tüm analiz geçmişi (iOS &amp; Google Play izole)</p>
              </div>

              <div className="flex items-center gap-4">
                {/* Platform Filtre Hapları */}
                <div className="flex items-center rounded-xl bg-slate-900/80 p-1 border border-slate-800">
                  {(['all', 'ios', 'android'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setStoredPlatformFilter(p);
                        loadStoredKeywords(p);
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                        storedPlatformFilter === p
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {p === 'all' ? 'Tüm Mağazalar' : p === 'ios' ? '🍏 App Store' : '🤖 Google Play'}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                  <input
                    type="checkbox"
                    checked={filterGoldOnly}
                    onChange={(e) => setFilterGoldOnly(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0"
                  />
                  Sadece Fırsatları Göster (Pop&gt;30 &amp; KD&lt;40)
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-[#0f172a] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Anahtar Kelime</th>
                    <th className="py-3 px-4">Mağaza / Platform</th>
                    <th className="py-3 px-4">Ülke</th>
                    <th className="py-3 px-4">Hacim (Pop)</th>
                    <th className="py-3 px-4">Zorluk (KD)</th>
                    <th className="py-3 px-4">Fırsat Skoru</th>
                    <th className="py-3 px-4">Son Analiz</th>
                    <th className="py-3 px-4 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {storedKeywords
                    .filter((k) => (!filterGoldOnly ? true : k.popularity > 30 && k.difficulty < 40))
                    .map((kw) => (
                      <tr key={kw.id} className="hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-semibold text-white">{kw.term}</td>
                        <td className="py-3 px-4">
                          {kw.platform === 'android' ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
                              🤖 Play Store
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-400 border border-blue-500/20">
                              🍏 App Store
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 uppercase text-slate-400">{kw.storefront}</td>
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">{kw.popularity}/100</td>
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">{kw.difficulty}/100</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">{kw.opportunity}/100</td>
                        <td className="py-3 px-4 text-slate-500">{kw.lastAnalyzed || '-'}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setSearchTerm(kw.term);
                              setStorefront(kw.storefront);
                              if (kw.platform) setPlatform(kw.platform);
                              setActiveTab('explorer');
                              handleAnalyze(kw.term);
                            }}
                            className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                          >
                            Tekrar Analiz Et →
                          </button>
                        </td>
                      </tr>
                    ))}
                  {storedKeywords.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Henüz bu filtreye uygun kayıtlı kelime yok. Explorer sekmesinden ilk aramanızı yapın!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB: FIRSAT ÖNERİLERİ ================= */}
        {activeTab === 'suggestions' && (
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-amber-400" />
                  Fırsat Önerileri
                </h2>
                <p className="text-xs text-slate-400">
                  En yüksek fırsat skorlu kelimelerinizden türetilen, henüz denenmemiş yeni keyword adayları
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customSeed}
                  onChange={(e) => setCustomSeed(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadSuggestions()}
                  placeholder="İsteğe bağlı tohum kelime (örn: meditation)"
                  className="w-64 rounded-xl border border-slate-800 bg-[#0f172a] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={() => loadSuggestions()}
                  disabled={suggestLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-600/30 transition-all hover:bg-blue-500 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${suggestLoading ? 'animate-spin' : ''}`} />
                  {customSeed.trim() ? 'Bu Kelimeden Öner' : 'Önerileri Yenile'}
                </button>
              </div>
            </div>

            {suggestError && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>{suggestError}</span>
              </div>
            )}

            {!suggestions && !suggestLoading && !suggestError && (
              <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-12 text-center text-slate-400">
                <Lightbulb className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <p className="text-xs text-slate-500">
                  Öneriler yalnızca masaüstü uygulamasında (Electron) çalışır. <code>npm run dev</code> ile açın.
                </p>
              </div>
            )}

            {suggestLoading && !suggestions && (
              <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-16 text-center text-slate-400">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-500 mb-3" />
                <p className="text-sm font-semibold text-slate-300">Öneriler hazırlanıyor...</p>
                <p className="text-xs text-slate-500 mt-1">Apple arama önerileri taranıyor</p>
              </div>
            )}

            {suggestions && (
              <>
                {/* Baz Alınan Tohumlar */}
                {suggestions.seeds.length > 0 ? (
                  <div className="rounded-2xl border border-slate-800/80 bg-[#0f172a] p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-blue-400" />
                      Baz Alınan Güçlü Kelimeler
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.seeds.map((s: any) => (
                        <span
                          key={s.term}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300"
                        >
                          <span className="font-semibold text-white">{s.term}</span>
                          <span className="rounded-full bg-emerald-500/10 px-1.5 text-[10px] font-mono text-emerald-400">
                            {s.opportunity}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-10 text-center text-slate-400">
                    <Lightbulb className="mx-auto h-10 w-10 text-slate-600 mb-3" />
                    <h3 className="text-base font-bold text-slate-300">Henüz Baz Alınacak Kelime Yok</h3>
                    <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                      Yukarıya bir tohum kelime yazıp öneri alabilir ya da Keyword Explorer'dan birkaç kelime analiz edebilirsiniz.
                    </p>
                  </div>
                )}

                {/* Doğrulanmış Fırsatlar */}
                {suggestions.verified.length > 0 && (
                  <div className="rounded-2xl border border-slate-800/80 bg-[#0f172a] overflow-hidden">
                    <div className="border-b border-slate-800/80 px-6 py-4">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        Doğrulanmış Fırsatlar ({suggestions.verified.length})
                      </h3>
                      <p className="text-xs text-slate-400">Analizi yapılmış, fırsat skoru ≥ 30 veya hedef bölgedeki kelimeler</p>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Anahtar Kelime</th>
                          <th className="py-3 px-4">Hacim</th>
                          <th className="py-3 px-4">Zorluk (KD)</th>
                          <th className="py-3 px-4">Fırsat Skoru</th>
                          <th className="py-3 px-4">Seviye</th>
                          <th className="py-3 px-4 text-right">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {suggestions.verified.map((v: any) => (
                          <tr key={v.term} className="hover:bg-slate-800/30">
                            <td className="py-3 px-4 font-semibold text-white">
                              {v.term}
                              {v.inTargetZone && (
                                <span className="ml-2 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                                  Girilebilir
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-blue-400">{v.popularity}/100</td>
                            <td className="py-3 px-4 font-mono font-bold text-amber-400">{v.difficulty}/100</td>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-400">{v.opportunity}/100</td>
                            <td className="py-3 px-4">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  v.tier === 'gold'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {v.tier}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => openInExplorer(v.term)}
                                className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                              >
                                Detaya Git →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Yeni Adaylar */}
                {suggestions.candidates.length > 0 && (
                  <div className="rounded-2xl border border-slate-800/80 bg-[#0f172a] overflow-hidden">
                    <div className="flex flex-col gap-3 border-b border-slate-800/80 px-6 py-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-amber-400" />
                          Yeni Keyword Adayları ({suggestions.candidates.length})
                        </h3>
                        <p className="text-xs text-slate-400">
                          Tahmini potansiyele göre sıralı. Skorlar tahmindir; kesin değer için analiz edin.
                        </p>
                      </div>
                      <button
                        onClick={() => scanTopCandidates(8)}
                        disabled={!!scanProgress || !!analyzingTerm}
                        className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300 border border-amber-500/30 transition-all hover:bg-amber-500 hover:text-slate-900 disabled:opacity-50"
                      >
                        {scanProgress ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Zap className="h-3.5 w-3.5" />
                        )}
                        {scanProgress
                          ? `Taranıyor ${scanProgress.done + 1}/${scanProgress.total}: ${scanProgress.current}`
                          : 'İlk 8 Adayı Otomatik Analiz Et'}
                      </button>
                    </div>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                        <tr>
                          <th className="py-3 px-4">Aday Kelime</th>
                          <th className="py-3 px-4">Türetildiği Kelime</th>
                          <th className="py-3 px-4">Tahmini Potansiyel</th>
                          <th className="py-3 px-4">Neden?</th>
                          <th className="py-3 px-4 text-right">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {suggestions.candidates.map((c: any) => (
                          <tr key={c.term} className="hover:bg-slate-800/30">
                            <td className="py-3 px-4 font-semibold text-white">{c.term}</td>
                            <td className="py-3 px-4 text-slate-400">{c.parentTerm}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-20 rounded-full bg-slate-800 overflow-hidden">
                                  <div className="h-full rounded-full bg-amber-500" style={{ width: `${c.estimate}%` }} />
                                </div>
                                <span className="font-mono font-bold text-amber-400">~{c.estimate}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-[11px] text-slate-500 max-w-xs">{c.reasons.join(' • ')}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => analyzeCandidate(c.term)}
                                disabled={!!analyzingTerm || !!scanProgress}
                                className="inline-flex items-center gap-1 rounded-lg bg-blue-600/10 px-2.5 py-1 text-xs font-semibold text-blue-400 border border-blue-500/20 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50"
                              >
                                {analyzingTerm === c.term ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Search className="h-3 w-3" />
                                )}
                                Analiz Et
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {suggestions.seeds.length > 0 && suggestions.candidates.length === 0 && (
                  <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-8 text-center text-xs text-slate-500">
                    Yeni aday bulunamadı: türetilen tüm kelimeler zaten analiz edilmiş. Farklı bir tohum kelime deneyin.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ================= TAB 4: RISING STARS ================= */}
        {activeTab === 'rising' && (
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                  Rising Stars Radarı
                </h2>
                <p className="text-xs text-slate-400">
                  Son 180 gün içinde çıkmış, abonelikli ve yorum artış hızı yüksek yeni pazar liderleri
                </p>
              </div>
            </div>

            {risingStars.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-12 text-center text-slate-400">
                <TrendingUp className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <h3 className="text-base font-bold text-slate-300">Henüz Yükselen Uygulama Tespit Edilmedi</h3>
                <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                  Kategori sıralamalarını ve anahtar kelimeleri gezdikçe, son 6 ayda çıkıp hızla büyüyen abonelikli uygulamalar bu radara otomatik düşecektir.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {risingStars.map((item, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-800/80 bg-[#0f172a] p-5 shadow-sm hover:border-slate-700 transition-all">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {item.app.iconUrl && (
                          <img src={item.app.iconUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                        )}
                        <div>
                          <h4 className="text-sm font-bold text-white line-clamp-1">{item.app.name}</h4>
                          <p className="text-xs text-slate-400">{item.app.sellerName}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-400 border border-blue-500/20">
                        {item.score}/100
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-3 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Yaş</span>
                        <span className="font-semibold text-slate-300">{item.metrics.ageDays} gün</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Günlük Hız</span>
                        <span className="font-semibold text-emerald-400">~{item.metrics.dailyVelocity} yorum</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">30G Hız (RV30)</span>
                        <span className="font-semibold text-blue-400">+{item.metrics.rv30}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 5: YORUM RÖNTGENİ ================= */}
        {activeTab === 'reviews' && (
          <div className="mx-auto max-w-7xl space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-400" />
                Rakip Yorum Röntgeni (LLM'siz N-Gram &amp; Filtre)
              </h2>
              <p className="text-xs text-slate-400">
                {selectedAppForReviews
                  ? `${selectedAppForReviews.name} uygulamasının 1-3 yıldızlı şikayet analizi`
                  : 'İncelemek istediğiniz uygulamanın ilk 20 sıralamadan "Yorumları Gör" butonuna tıklayın.'}
              </p>
            </div>

            {reviewError && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>{reviewError}</span>
              </div>
            )}

            {reviewLoading && (
              <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-16 text-center text-slate-400">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-500 mb-3" />
                <p className="text-sm font-semibold text-slate-300">Kullanıcı yorumları taranıyor...</p>
                <p className="text-xs text-slate-500 mt-1">1-3 yıldızlı şikayetler ve n-gram öbekleri taranıyor</p>
              </div>
            )}

            {!reviewLoading && reviewData && (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div
                    onClick={() => setReviewCategoryFilter(reviewCategoryFilter === 'pricing' ? 'all' : 'pricing')}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                      reviewCategoryFilter === 'pricing'
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-slate-800 bg-[#0f172a] hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-semibold text-indigo-400 block">💰 Fiyat &amp; Abonelik</span>
                    <span className="text-2xl font-bold text-white mt-1 block">
                      {reviewData.summary.pricing} Şikayet
                    </span>
                  </div>
                  <div
                    onClick={() => setReviewCategoryFilter(reviewCategoryFilter === 'bug' ? 'all' : 'bug')}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                      reviewCategoryFilter === 'bug'
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-slate-800 bg-[#0f172a] hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-semibold text-red-400 block">🐛 Hata &amp; Çökme</span>
                    <span className="text-2xl font-bold text-white mt-1 block">
                      {reviewData.summary.bug} Şikayet
                    </span>
                  </div>
                  <div
                    onClick={() => setReviewCategoryFilter(reviewCategoryFilter === 'missingFeature' ? 'all' : 'missingFeature')}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                      reviewCategoryFilter === 'missingFeature'
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-800 bg-[#0f172a] hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-semibold text-amber-400 block">✨ Eksik Özellik</span>
                    <span className="text-2xl font-bold text-white mt-1 block">
                      {reviewData.summary.missingFeature} Şikayet
                    </span>
                  </div>
                </div>

                {reviewData.topBiGrams?.length > 0 && (
                  <div className="rounded-2xl border border-slate-800/80 bg-[#0f172a] p-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      En Sık Tekrar Eden 2'li Şikayet Kalıpları
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {reviewData.topBiGrams.map((bg: any, i: number) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-300"
                        >
                          <span className="font-semibold text-white">"{bg.phrase}"</span>
                          <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-blue-400 font-mono">
                            {bg.count}x
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-800/80 bg-[#0f172a] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Kullanıcı Yorumları ({reviewData.reviews.length} Adet)
                    </h3>
                    {reviewCategoryFilter !== 'all' && (
                      <button
                        onClick={() => setReviewCategoryFilter('all')}
                        className="text-xs text-blue-400 hover:underline"
                      >
                        Filtreyi Temizle
                      </button>
                    )}
                  </div>
                  {reviewData.reviews.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                      <p className="text-sm font-semibold text-slate-300">Bu uygulama için son dönemde 1-3 yıldızlı şikayet bulunamadı.</p>
                      <p className="text-xs text-slate-500 mt-1">Uygulamanın yakın tarihli yorumlarının çoğu olumlu (4-5 yıldız) olabilir.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                      {reviewData.reviews.map((r: any) => (
                        <div key={r.id} className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-amber-400 font-bold">⭐ {r.rating} / 5</span>
                            <span className="text-slate-500">{new Date(r.reviewedAt).toLocaleDateString()}</span>
                          </div>
                          {r.title && <h5 className="text-xs font-bold text-white mt-1">{r.title}</h5>}
                          <p className="text-xs text-slate-300 mt-1 leading-relaxed">{r.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {!selectedAppForReviews && !reviewLoading && (
              <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-12 text-center text-slate-400">
                <MessageSquare className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <h3 className="text-base font-bold text-slate-300">Uygulama Seçilmedi</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Explorer veya Kategori Sıralamaları sekmesinden bir uygulamanın "Yorumları Gör" butonuna tıklayın.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
