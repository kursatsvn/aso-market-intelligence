import { contextBridge, ipcRenderer } from 'electron';

export interface ElectronApi {
  analyzeKeyword: (term: string, storefront?: string) => Promise<any>;
  getStoredKeywords: () => Promise<any[]>;
  getStoredApps: () => Promise<any[]>;
  getRisingStars: () => Promise<any[]>;
  getAppReviews: (appId: string) => Promise<any>;
  getCategoryTopCharts: (genreId: number, chartType: string, storefront?: string, limit?: number) => Promise<any>;
}

const api: ElectronApi = {
  analyzeKeyword: (term: string, storefront = 'us') => ipcRenderer.invoke('keyword:analyze', term, storefront),
  getStoredKeywords: () => ipcRenderer.invoke('keyword:list'),
  getStoredApps: () => ipcRenderer.invoke('app:list'),
  getRisingStars: () => ipcRenderer.invoke('app:rising-stars'),
  getAppReviews: (appId: string) => ipcRenderer.invoke('review:get', appId),
  getCategoryTopCharts: (genreId: number, chartType: string, storefront = 'us', limit = 200) =>
    ipcRenderer.invoke('category:top-charts', genreId, chartType, storefront, limit),
};

contextBridge.exposeInMainWorld('api', api);
