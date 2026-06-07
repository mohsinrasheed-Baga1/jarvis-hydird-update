const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  isDesktop: () => ipcRenderer.invoke('is-desktop'),
  getAppUrl: () => ipcRenderer.invoke('get-app-url'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  getLogPath: () => ipcRenderer.invoke('get-log-path'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  listenOnce: (language) => ipcRenderer.invoke('listen-once', language),

  // Navigation
  retryLoad: () => ipcRenderer.send('retry-load'),
  reloadPage: () => ipcRenderer.send('reload-page'),
  hardRefresh: () => ipcRenderer.send('hard-refresh'),
  clearCache: () => ipcRenderer.send('clear-cache'),

  // Auto-update
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateStatus: (cb) => { ipcRenderer.removeAllListeners('update-status'); ipcRenderer.on('update-status', (_, d) => cb(d)); },
  onWebUpdated: (cb) => { ipcRenderer.on('web-updated', (_, d) => cb(d)); },
  onCacheCleared: (cb) => { ipcRenderer.on('cache-cleared', (_, d) => cb(d)); },

  // ─── Desktop Automation ───
  desktopAction: (action) => ipcRenderer.invoke('desktop-action', action),
  openUrl: (url) => ipcRenderer.invoke('desktop-action', { type: 'open-url', url }),
  searchGoogle: (query) => ipcRenderer.invoke('desktop-action', { type: 'search-google', query }),
  openYoutube: (query) => ipcRenderer.invoke('desktop-action', { type: 'open-youtube', query }),
  searchYoutube: (query) => ipcRenderer.invoke('desktop-action', { type: 'search-youtube', query }),
  playYoutube: (queryOrUrl) => {
    if (queryOrUrl && queryOrUrl.startsWith('http')) return ipcRenderer.invoke('desktop-action', { type: 'play-youtube', url: queryOrUrl });
    return ipcRenderer.invoke('desktop-action', { type: 'play-youtube', query: queryOrUrl });
  },
  playAudio: (url) => ipcRenderer.invoke('desktop-action', { type: 'play-audio', url }),
  systemCommand: (cmd) => ipcRenderer.invoke('desktop-action', { type: 'system-command', command: cmd }),
  volumeUp: () => ipcRenderer.invoke('desktop-action', { type: 'volume-up' }),
  volumeDown: () => ipcRenderer.invoke('desktop-action', { type: 'volume-down' }),
  muteToggle: () => ipcRenderer.invoke('desktop-action', { type: 'mute-toggle' }),
  screenshot: () => ipcRenderer.invoke('desktop-action', { type: 'screenshot' }),
  openFolder: (path) => ipcRenderer.invoke('desktop-action', { type: 'open-folder', path }),
  openApp: (app) => ipcRenderer.invoke('desktop-action', { type: 'open-app', app }),
  showNotification: (title, body) => ipcRenderer.invoke('desktop-action', { type: 'notification', title, body }),

  // Dev tools
  toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),
  checkWebVersion: () => ipcRenderer.invoke('check-web-version'),

  // Platform (sync)
  platform: process.platform,
});
