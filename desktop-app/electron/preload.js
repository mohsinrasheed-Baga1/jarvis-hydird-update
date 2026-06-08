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
  getApiKeyStatus: () => ipcRenderer.invoke('get-api-key-status'),
  saveApiKeys: (keys) => ipcRenderer.invoke('save-api-keys', keys),

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
  playAudio: (urlOrQuery) => ipcRenderer.invoke('desktop-action', { type: 'play-audio', url: urlOrQuery, query: urlOrQuery }),
  openWhatsApp: (phone, message) => ipcRenderer.invoke('desktop-action', { type: 'open-whatsapp', phone, message }),
  systemCommand: (cmd) => ipcRenderer.invoke('desktop-action', { type: 'system-command', command: cmd }),
  volumeUp: () => ipcRenderer.invoke('desktop-action', { type: 'volume-up' }),
  volumeDown: () => ipcRenderer.invoke('desktop-action', { type: 'volume-down' }),
  muteToggle: () => ipcRenderer.invoke('desktop-action', { type: 'mute-toggle' }),
  screenshot: () => ipcRenderer.invoke('desktop-action', { type: 'screenshot' }),
  openFolder: (path) => ipcRenderer.invoke('desktop-action', { type: 'open-folder', path }),
  openApp: (app) => ipcRenderer.invoke('desktop-action', { type: 'open-app', app }),
  showNotification: (title, body) => ipcRenderer.invoke('desktop-action', { type: 'notification', title, body }),

  // ─── Voice IPC — Direct STT & TTS through main process ───
  // These bypass the renderer's fetch() calls which can fail in Electron
  // Recording happens in the RENDERER (has proper mic access), transcription in MAIN process

  // Transcribe pre-recorded audio (base64) via Groq/OpenAI Whisper in main process
  transcribeAudioBase64: (base64Audio, language, apiKeys) => ipcRenderer.invoke('transcribe-audio-base64', base64Audio, language, apiKeys),

  // Generate TTS audio via ElevenLabs / OpenAI / Sarvam in main process
  generateTTS: (text, lang, emotion, apiKeys) => ipcRenderer.invoke('tts-generate', text, lang, emotion, apiKeys),

  // DEPRECATED: recordAndTranscribe removed - recording must happen in renderer context
  // where navigator.mediaDevices is available. Use the renderer's MediaRecorder + transcribeAudioBase64 instead.

  // Dev tools
  toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),
  checkWebVersion: () => ipcRenderer.invoke('check-web-version'),

  // Platform (sync)
  platform: process.platform,
});
