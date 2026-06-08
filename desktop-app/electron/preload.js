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

  // Voice IPC — Direct STT & TTS through main process (reliable in Electron)
  transcribeAudioBase64: (base64Audio, language, apiKeys) => ipcRenderer.invoke('transcribe-audio-base64', base64Audio, language, apiKeys),
  generateTTS: (text, lang, emotion, apiKeys) => ipcRenderer.invoke('tts-generate', text, lang, emotion, apiKeys),

  // Record voice via MediaRecorder in preload context (has proper mic permissions)
  // Returns { success: true, text: "transcribed text" } or { success: false, error: "..." }
  recordAndTranscribe: async (language = 'ur', apiKeys = {}) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return new Promise((resolve) => {
        const recorder = new MediaRecorder(stream);
        const chunks = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunks, { type: 'audio/webm' });
          if (blob.size < 500) {
            resolve({ success: false, error: 'No voice detected. Try again and speak louder.' });
            return;
          }
          try {
            const reader = new FileReader();
            reader.onload = async () => {
              const base64 = reader.result.split(',')[1];
              const result = await ipcRenderer.invoke('transcribe-audio-base64', base64, language, apiKeys);
              resolve(result);
            };
            reader.onerror = () => resolve({ success: false, error: 'Failed to read audio data' });
            reader.readAsDataURL(blob);
          } catch (err) {
            resolve({ success: false, error: err.message || 'Audio processing failed' });
          }
        };
        recorder.onerror = () => {
          stream.getTracks().forEach(t => t.stop());
          resolve({ success: false, error: 'Recording failed' });
        };
        recorder.start();
        // Auto-stop after 8 seconds
        setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 8000);
      });
    } catch (err) {
      return { success: false, error: err.message || 'Microphone access denied or unavailable' };
    }
  },

  // Dev tools
  toggleDevTools: () => ipcRenderer.invoke('toggle-devtools'),
  checkWebVersion: () => ipcRenderer.invoke('check-web-version'),

  // Platform (sync)
  platform: process.platform,
});
