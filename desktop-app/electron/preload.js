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
  playYoutubeAuto: (query) => ipcRenderer.invoke('play-youtube-auto', query),
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
  transcribeAudioBase64: (base64Audio, language, apiKeys) => ipcRenderer.invoke('transcribe-audio-base64', base64Audio, language, apiKeys),
  generateTTS: (text, lang, emotion, apiKeys) => ipcRenderer.invoke('tts-generate', text, lang, emotion, apiKeys),
  getElevenLabsVoices: (apiKeys) => ipcRenderer.invoke('get-elevenlabs-voices', apiKeys),

  // Piper offline TTS
  getPiperModelStatus: () => ipcRenderer.invoke('piper-model-status'),
  downloadPiperModel: (lang) => ipcRenderer.invoke('download-piper-model', lang),
  downloadPiperBinary: () => ipcRenderer.invoke('download-piper-binary'),
  installEdgeTTS: () => ipcRenderer.invoke('install-edge-tts'),
  testTTS: (lang) => ipcRenderer.invoke('test-tts', lang),
  saveTempAudio: (audioBase64, contentType) => ipcRenderer.invoke('save-temp-audio', audioBase64, contentType),
  onPiperDownloadProgress: (cb) => { ipcRenderer.on('piper-download-progress', (_, d) => cb(d)); },

  // Direct chat completion via Groq/Gemini/OpenAI
  chatCompletion: (message, conversationHistory, activeProvider, apiKeys) => ipcRenderer.invoke('chat-completion', message, conversationHistory, activeProvider, apiKeys),

  // ─── Terminal ───
  terminalExecute: (command, cwd) => ipcRenderer.invoke('terminal-execute', command, cwd),
  terminalCreateSession: () => ipcRenderer.invoke('terminal-create-session'),
  terminalWrite: (sessionId, input) => ipcRenderer.invoke('terminal-write', sessionId, input),
  terminalKill: (sessionId) => ipcRenderer.invoke('terminal-kill', sessionId),
  onTerminalOutput: (cb) => { ipcRenderer.on('terminal-output', (_, d) => cb(d)); },

  // ─── Mouse & Keyboard Control ───
  mouseMove: (x, y) => ipcRenderer.invoke('mouse-move', x, y),
  mouseClick: (x, y, button, clicks) => ipcRenderer.invoke('mouse-click', x, y, button, clicks),
  keyboardType: (text) => ipcRenderer.invoke('keyboard-type', text),
  keyboardPress: (key) => ipcRenderer.invoke('keyboard-press', key),
  keyboardHotkey: (keys) => ipcRenderer.invoke('keyboard-hotkey', keys),

  // ─── Screen Analysis ───
  screenCapture: () => ipcRenderer.invoke('screen-capture'),
  screenAnalyze: (question, apiKeys) => ipcRenderer.invoke('screen-analyze', question, apiKeys),

  // ─── Multiple API Keys ───
  getMultiKeys: () => ipcRenderer.invoke('get-multi-keys'),
  setMultiKeys: (keys) => ipcRenderer.invoke('set-multi-keys', keys),
  addApiKey: (provider, key) => ipcRenderer.invoke('add-api-key', provider, key),
  removeApiKey: (provider, index) => ipcRenderer.invoke('remove-api-key', provider, index),
  getActiveKey: (provider) => ipcRenderer.invoke('get-active-key', provider),

  // ─── CRM / Business Agent IPC ───
  crmGetAll: () => ipcRenderer.invoke('crm-get-all'),
  crmAddLead: (lead) => ipcRenderer.invoke('crm-add-lead', lead),
  crmUpdateLead: (id, updates) => ipcRenderer.invoke('crm-update-lead', id, updates),
  crmAddProposal: (proposal) => ipcRenderer.invoke('crm-add-proposal', proposal),
  crmUpdateProposal: (id, updates) => ipcRenderer.invoke('crm-update-proposal', id, updates),
  crmAddActivity: (activity) => ipcRenderer.invoke('crm-add-activity', activity),
  crmGenerateProposal: (jobDescription, serviceType, clientName, apiKeys) => ipcRenderer.invoke('crm-generate-proposal', jobDescription, serviceType, clientName, apiKeys),
  crmScoreLead: (leadData, apiKeys) => ipcRenderer.invoke('crm-score-lead', leadData, apiKeys),
  crmCalculatePricing: (serviceType, complexity, apiKeys) => ipcRenderer.invoke('crm-calculate-pricing', serviceType, complexity, apiKeys),

  // Dev tools
  toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),
  checkWebVersion: () => ipcRenderer.invoke('check-web-version'),

  // Platform (sync)
  platform: process.platform,
});
