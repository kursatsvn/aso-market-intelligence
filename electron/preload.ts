import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronApi {
  analyzeKeyword: (term: string, storefront?: string, platform?: string | boolean, pullReviews?: boolean) => Promise<any>;
  getOpportunitySuggestions: (storefront?: string, seed?: string) => Promise<any>;
  getStoredKeywords: (platform?: string) => Promise<any[]>;
  getStoredApps: (platform?: string) => Promise<any[]>;
  getRisingStars: (platform?: string) => Promise<any[]>;
  getAppReviews: (appId: string, storefront?: string) => Promise<any>;
  getCategoryTopCharts: (genreId: any, chartType: string, storefront?: string, limit?: number, platform?: string) => Promise<any>;
  getAppKeywords: (appId: string) => Promise<any>;
  checkAppKeywordRank: (appId: string, term: string, storefront?: string, platform?: string) => Promise<any>;
  discoverAppKeywords: (appId: string, storefront?: string, platform?: string) => Promise<any>;
}

const api: ElectronApi = {
  analyzeKeyword: (term: string, storefront = 'us', platform: string | boolean = 'ios', pullReviews = true) => {
    const plat = typeof platform === 'string' ? platform : 'ios';
    const pull = typeof platform === 'boolean' ? platform : pullReviews;
    return ipcRenderer.invoke('keyword:analyze', term, storefront, plat, pull);
  },
  getOpportunitySuggestions: (storefront = 'us', seed?: string) =>
    ipcRenderer.invoke('keyword:suggest-opportunities', storefront, seed),
  getStoredKeywords: (platform?: string) => ipcRenderer.invoke('keyword:list', platform),
  getStoredApps: (platform?: string) => ipcRenderer.invoke('app:list', platform),
  getRisingStars: (platform?: string) => ipcRenderer.invoke('app:rising-stars', platform),
  getAppReviews: (appId: string, storefront = 'us') => ipcRenderer.invoke('review:get', appId, storefront),
  getCategoryTopCharts: (genreId: any, chartType: string, storefront = 'us', limit = 200, platform = 'ios') =>
    ipcRenderer.invoke('category:top-charts', genreId, chartType, storefront, limit, platform),
  getAppKeywords: (appId: string) => ipcRenderer.invoke('app:get-keywords', appId),
  checkAppKeywordRank: (appId: string, term: string, storefront = 'us', platform = 'ios') =>
    ipcRenderer.invoke('app:check-keyword-rank', appId, term, storefront, platform),
  discoverAppKeywords: (appId: string, storefront = 'us', platform = 'ios') =>
    ipcRenderer.invoke('app:discover-keywords', appId, storefront, platform),
};

contextBridge.exposeInMainWorld('api', api);
