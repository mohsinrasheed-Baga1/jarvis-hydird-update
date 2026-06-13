import { useEffect, useState } from 'react';
import { storageService } from '../services/storageService';
import { apiClient, type ApiKeys } from '../services/apiClient';

type Provider = 'groq' | 'gemini' | 'openai';
type KeyId = Provider | 'elevenlabs' | 'sarvam';

const providers: Array<{ id: Provider; label: string; hint: string }> = [
  { id: 'groq', label: 'Groq', hint: 'gsk_...' },
  { id: 'gemini', label: 'Gemini', hint: 'AIza...' },
  { id: 'openai', label: 'OpenAI', hint: 'sk-...' },
];

const voiceProviders: Array<{ id: KeyId; label: string; hint: string }> = [
  { id: 'elevenlabs', label: 'ElevenLabs voice', hint: 'sk_...' },
  { id: 'sarvam', label: 'Sarvam voice fallback', hint: 'sb-...' },
];

export default function SettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [activeProvider, setActiveProvider] = useState<Provider>('groq');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState('');
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({});

  // Auto Update state
  const [updateStatus, setUpdateStatus] = useState<any>(null);
  const [updateLog, setUpdateLog] = useState<string[]>([]);
  const [showUpdateLog, setShowUpdateLog] = useState(false);

  // Voice settings
  const [elevenlabsVoices, setElevenlabsVoices] = useState<any[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [piperStatus, setPiperStatus] = useState<any>(null);
  const [piperDownloading, setPiperDownloading] = useState<string | null>(null);
  const [piperProgress, setPiperProgress] = useState<any>(null);

  useEffect(() => {
    setApiKeys(storageService.getApiKeys());
    setActiveProvider(storageService.getActiveProvider());
    // Check which keys are available in the main process
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.getApiKeyStatus) {
      electronAPI.getApiKeyStatus().then((s: Record<string, boolean>) => setKeyStatus(s)).catch(() => {});
    }

    // Listen for update status
    if (electronAPI?.onUpdateStatus) {
      electronAPI.onUpdateStatus((data: any) => {
        setUpdateStatus(data);
        const logLine = `[${new Date().toLocaleTimeString()}] ${data.status}${data.version ? ` v${data.version}` : ''}${data.message ? ` - ${data.message}` : ''}${data.percent ? ` (${data.percent}%)` : ''}`;
        setUpdateLog(prev => [...prev.slice(-20), logLine]);
      });
    }

    // Load Piper model status
    if (electronAPI?.getPiperModelStatus) {
      electronAPI.getPiperModelStatus().then((s: any) => setPiperStatus(s)).catch(() => {});
    }

    // Listen for Piper download progress
    if (electronAPI?.onPiperDownloadProgress) {
      electronAPI.onPiperDownloadProgress((data: any) => {
        setPiperProgress(data);
        if (data.status === 'complete') {
          setPiperDownloading(null);
          // Refresh model status
          electronAPI.getPiperModelStatus?.().then((s: any) => setPiperStatus(s)).catch(() => {});
        }
      });
    }
  }, []);

  const updateKey = (provider: KeyId, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
    setSaved(false);
  };

  const save = async () => {
    storageService.setApiKeys(apiKeys);
    storageService.setActiveProvider(activeProvider);
    // Also save to .env file via IPC so main process can use them for STT/TTS
    try {
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.saveApiKeys) {
        await electronAPI.saveApiKeys(apiKeys);
      }
    } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const testBackend = async () => {
    setStatus('Checking backend...');
    const state = await apiClient.getBackendState();
    setStatus(state.connected ? state.label : state.error || state.label);
  };

  const checkForUpdates = () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.checkForUpdates) {
      electronAPI.checkForUpdates();
      setUpdateStatus({ status: 'checking' });
    }
  };

  const installUpdate = () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.installUpdate) {
      electronAPI.installUpdate();
    }
  };

  const discoverVoices = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.getElevenLabsVoices) return;
    setVoiceLoading(true);
    try {
      const result = await electronAPI.getElevenLabsVoices(apiKeys);
      if (result.success) {
        setElevenlabsVoices(result.voices);
      }
    } catch {}
    setVoiceLoading(false);
  };

  const downloadPiperModel = async (lang: string) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.downloadPiperModel) return;
    setPiperDownloading(lang);
    try {
      const result = await electronAPI.downloadPiperModel(lang);
      if (!result.success) {
        alert('Download failed: ' + result.error);
        setPiperDownloading(null);
      }
    } catch {
      setPiperDownloading(null);
    }
  };

  const getUpdateStatusLabel = () => {
    if (!updateStatus) return 'Not checked yet';
    switch (updateStatus.status) {
      case 'checking': return 'Checking for updates...';
      case 'available': return `Update v${updateStatus.version} available`;
      case 'downloading': return `Downloading update... ${updateStatus.percent}% ${updateStatus.speed || ''}`;
      case 'downloaded': return `Update v${updateStatus.version} ready to install`;
      case 'up-to-date': return `Up to date (v${updateStatus.version})`;
      case 'error': return `Update error: ${updateStatus.message}`;
      case 'dev-mode': return 'Update check disabled (dev mode)';
      case 'not-available': return 'Auto-updater not available';
      default: return updateStatus.status;
    }
  };

  const getUpdateStatusColor = () => {
    if (!updateStatus) return 'text-slate-400';
    switch (updateStatus.status) {
      case 'available':
      case 'downloaded': return 'text-green-400';
      case 'downloading': return 'text-blue-400';
      case 'up-to-date': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">SETTINGS</h1>
          <p className="text-slate-400">Settings</p>
          <p className="text-sm text-slate-500 mt-1">Manage model provider, API keys, voice, and updates for the desktop app.</p>
        </div>

        {/* ─── Auto Update Section ─── */}
        <section className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <h2 className="text-lg font-semibold text-white">Auto Update</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">Current Version</p>
              <p className="text-xl font-bold text-white">v3.0.1</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">Latest Version</p>
              <p className="text-xl font-bold text-white">
                {updateStatus?.version ? `v${updateStatus.version}` : '-'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm mb-1">
              <span className="text-slate-400">Update Status: </span>
              <span className={getUpdateStatusColor()}>{getUpdateStatusLabel()}</span>
            </p>
            {updateStatus?.status === 'downloading' && (
              <div className="mt-2 w-full bg-slate-800 rounded-full h-2">
                <div
                  className="bg-purple-500 rounded-full h-2 transition-all"
                  style={{ width: `${updateStatus.percent || 0}%` }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={checkForUpdates}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
            >
              Check for Updates
            </button>
            {updateStatus?.status === 'downloaded' && (
              <button
                onClick={installUpdate}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
              >
                Install & Restart
              </button>
            )}
            <button
              onClick={() => setShowUpdateLog(!showUpdateLog)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
            >
              {showUpdateLog ? 'Hide' : 'View'} Update Log
            </button>
          </div>

          {showUpdateLog && updateLog.length > 0 && (
            <div className="bg-slate-950 rounded-lg p-3 max-h-48 overflow-y-auto">
              <pre className="text-xs text-slate-400 whitespace-pre-wrap">
                {updateLog.join('\n')}
              </pre>
            </div>
          )}
        </section>

        {/* ─── Model & API Keys Section ─── */}
        <section className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Active model</label>
            <select
              value={activeProvider}
              onChange={(e) => {
                setActiveProvider(e.target.value as Provider);
                setSaved(false);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
            >
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>{provider.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-4">
            {[...providers, ...voiceProviders].map(provider => (
              <div key={provider.id}>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {provider.label} API key
                  {keyStatus[provider.id] && (
                    <span className="ml-2 text-green-400 text-xs">(Active in system)</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    type={showKeys[provider.id] ? 'text' : 'password'}
                    value={apiKeys[provider.id] || ''}
                    onChange={(e) => updateKey(provider.id, e.target.value)}
                    placeholder={provider.hint}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={() => setShowKeys(prev => ({ ...prev, [provider.id]: !prev[provider.id] }))}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
                  >
                    {showKeys[provider.id] ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
            >
              Save
            </button>
            <button
              onClick={testBackend}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
            >
              Test backend
            </button>
            {saved && <span className="text-green-400 text-sm">Saved</span>}
            {status && <span className="text-slate-400 text-sm">{status}</span>}
          </div>
        </section>

        {/* ─── Voice Settings Section ─── */}
        <section className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-5">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <h2 className="text-lg font-semibold text-white">Voice Settings</h2>
          </div>

          <p className="text-sm text-slate-400">
            TTS priority: ElevenLabs → OpenAI → Sarvam → Piper (offline). 
            STT uses Groq Whisper (fastest) then OpenAI Whisper (better quality).
          </p>

          {/* ElevenLabs Voice Discovery */}
          <div className="bg-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-300">ElevenLabs Voices</h3>
              <button
                onClick={discoverVoices}
                disabled={voiceLoading || !apiKeys.elevenlabs}
                className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg"
              >
                {voiceLoading ? 'Loading...' : 'Discover Voices'}
              </button>
            </div>
            {!apiKeys.elevenlabs && (
              <p className="text-xs text-yellow-400">Add ElevenLabs API key above to discover voices</p>
            )}
            {elevenlabsVoices.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {elevenlabsVoices.map((voice: any) => (
                  <div key={voice.id} className="flex items-center justify-between px-3 py-2 bg-slate-900 rounded-lg">
                    <div>
                      <span className="text-sm text-white">{voice.name}</span>
                      {voice.category === 'cloned' && (
                        <span className="ml-2 text-xs bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">Cloned</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {voice.labels?.language || voice.labels?.accent || 'Unknown'}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {keyStatus.elevenlabs && (
              <p className="text-xs text-green-400">ElevenLabs key active - voice replies will use ElevenLabs</p>
            )}
          </div>

          {/* Piper Offline TTS */}
          <div className="bg-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-slate-300">Offline TTS (Piper) — No API needed</h3>
            <p className="text-xs text-slate-500">
              Piper TTS works offline with no API keys. Models are ~30-60MB. Good for 8GB RAM systems.
              Urdu voice quality is acceptable but less natural than ElevenLabs.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* Urdu Model */}
              <div className="bg-slate-900 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">Urdu Model</span>
                  {piperStatus?.urdu?.ready ? (
                    <span className="text-xs text-green-400">Downloaded</span>
                  ) : (
                    <span className="text-xs text-slate-500">Not downloaded</span>
                  )}
                </div>
                {!piperStatus?.urdu?.ready && (
                  <button
                    onClick={() => downloadPiperModel('ur')}
                    disabled={piperDownloading === 'ur'}
                    className="w-full px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg"
                  >
                    {piperDownloading === 'ur' 
                      ? `Downloading ${piperProgress?.percent || 0}%` 
                      : 'Download Urdu Model (~30MB)'}
                  </button>
                )}
                {piperDownloading === 'ur' && piperProgress && (
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 rounded-full h-1.5 transition-all"
                      style={{ width: `${piperProgress.percent || 0}%` }}
                    />
                  </div>
                )}
              </div>

              {/* English Model */}
              <div className="bg-slate-900 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">English Model</span>
                  {piperStatus?.english?.ready ? (
                    <span className="text-xs text-green-400">Downloaded</span>
                  ) : (
                    <span className="text-xs text-slate-500">Not downloaded</span>
                  )}
                </div>
                {!piperStatus?.english?.ready && (
                  <button
                    onClick={() => downloadPiperModel('en')}
                    disabled={piperDownloading === 'en'}
                    className="w-full px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg"
                  >
                    {piperDownloading === 'en' 
                      ? `Downloading ${piperProgress?.percent || 0}%` 
                      : 'Download English Model (~60MB)'}
                  </button>
                )}
                {piperDownloading === 'en' && piperProgress && (
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 rounded-full h-1.5 transition-all"
                      style={{ width: `${piperProgress.percent || 0}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Note: Piper binary must also be installed separately. 
              Download from: github.com/rhasspy/piper/releases
            </p>
          </div>
        </section>

        {/* ─── About Section ─── */}
        <section className="bg-slate-900 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-3">About</h2>
          <div className="space-y-2 text-sm text-slate-400">
            <p>JARVIS Hybrid v3.0.1</p>
            <p>AI-Powered Desktop Assistant with Voice & Automation</p>
            <p className="text-xs text-slate-600">
              Voice: ElevenLabs + OpenAI + Sarvam + Piper (offline)
              {' | '}STT: Groq Whisper + OpenAI Whisper
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
