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
  const [edgeTTSInstalling, setEdgeTTSInstalling] = useState(false);
  const [piperBinaryDownloading, setPiperBinaryDownloading] = useState(false);
  const [testTTSStatus, setTestTTSStatus] = useState('');

  // Multiple API Keys state
  const [multiKeys, setMultiKeys] = useState<Record<string, string[]>>({});
  const [newKeyInput, setNewKeyInput] = useState('');
  const [selectedKeyProvider, setSelectedKeyProvider] = useState<string>('groq');

  useEffect(() => {
    // Load multi keys from IPC
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.getMultiKeys) {
      electronAPI.getMultiKeys().then((result: any) => {
        if (result.success) setMultiKeys(result.keys);
      }).catch(() => {});
    }
  }, []);

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

  const installEdgeTTS = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.installEdgeTTS) return;
    setEdgeTTSInstalling(true);
    try {
      const result = await electronAPI.installEdgeTTS();
      if (result.success) {
        // Refresh piper status to show edge-tts available
        electronAPI.getPiperModelStatus?.().then((s: any) => setPiperStatus(s)).catch(() => {});
      } else {
        alert('Edge TTS install failed: ' + result.error);
      }
    } catch {
      alert('Edge TTS install failed');
    }
    setEdgeTTSInstalling(false);
  };

  const downloadPiperBinary = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.downloadPiperBinary) return;
    setPiperBinaryDownloading(true);
    try {
      const result = await electronAPI.downloadPiperBinary();
      if (!result.success) {
        alert('Piper binary download failed: ' + result.error);
      } else {
        // Refresh status
        electronAPI.getPiperModelStatus?.().then((s: any) => setPiperStatus(s)).catch(() => {});
      }
    } catch {
      alert('Piper binary download failed');
    }
    setPiperBinaryDownloading(false);
  };

  const testVoice = async (lang: string) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.testTTS) return;
    setTestTTSStatus('Testing voice...');
    try {
      const result = await electronAPI.testTTS(lang);
      if (result.success && result.audioBase64) {
        // Play the test audio
        const binaryString = atob(result.audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const blob = new Blob([bytes], { type: result.contentType || 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); setTestTTSStatus('Test complete! ✅'); setTimeout(() => setTestTTSStatus(''), 3000); };
        audio.onerror = () => { URL.revokeObjectURL(url); setTestTTSStatus('Test failed ❌'); setTimeout(() => setTestTTSStatus(''), 3000); };
        await audio.play();
      } else {
        setTestTTSStatus('Test failed: ' + (result.error || 'No audio generated') + ' ❌');
        setTimeout(() => setTestTTSStatus(''), 5000);
      }
    } catch {
      setTestTTSStatus('Test error ❌');
      setTimeout(() => setTestTTSStatus(''), 3000);
    }
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
              <p className="text-xl font-bold text-white">v3.1.0</p>
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

        {/* ─── Multiple API Keys Manager ─── */}
        <section className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-5">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <div>
              <h2 className="text-lg font-semibold text-white">Multiple API Keys</h2>
              <p className="text-xs text-slate-500">Add multiple keys per provider — auto-rotates on rate limits</p>
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={selectedKeyProvider}
              onChange={(e) => setSelectedKeyProvider(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            >
              {['groq', 'gemini', 'openai', 'elevenlabs', 'sarvam'].map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
            <input
              type="text"
              value={newKeyInput}
              onChange={(e) => setNewKeyInput(e.target.value)}
              placeholder="Enter API key to add..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={async () => {
                if (!newKeyInput.trim()) return;
                const electronAPI = (window as any).electronAPI;
                if (electronAPI?.addApiKey) {
                  const result = await electronAPI.addApiKey(selectedKeyProvider, newKeyInput.trim());
                  if (result.success) {
                    setMultiKeys(result.keys);
                    setNewKeyInput('');
                  }
                }
              }}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium text-sm"
            >
              Add
            </button>
          </div>

          <div className="space-y-3">
            {['groq', 'gemini', 'openai', 'elevenlabs', 'sarvam'].map(provider => {
              const keys = multiKeys[provider] || [];
              if (keys.length === 0) return null;
              return (
                <div key={provider} className="bg-slate-800 rounded-lg p-3">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">
                    {provider.charAt(0).toUpperCase() + provider.slice(1)} 
                    <span className="text-slate-500 ml-2">({keys.length} key{keys.length > 1 ? 's' : ''})</span>
                  </h3>
                  <div className="space-y-1">
                    {keys.map((key, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">{idx + 1}.</span>
                        <code className="text-cyan-300 flex-1 truncate">{key.substring(0, 8)}...{key.substring(key.length - 4)}</code>
                        <button
                          onClick={async () => {
                            const electronAPI = (window as any).electronAPI;
                            if (electronAPI?.removeApiKey) {
                              const result = await electronAPI.removeApiKey(provider, idx);
                              if (result.success) setMultiKeys(result.keys);
                            }
                          }}
                          className="text-red-400 hover:text-red-300 shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {Object.keys(multiKeys).every(k => !(multiKeys[k] || []).length) && (
            <p className="text-sm text-slate-500 text-center py-4">
              No additional keys added yet. Add multiple keys per provider for auto-rotation.
            </p>
          )}
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
            TTS priority: Edge TTS (free, best) → ElevenLabs → OpenAI → Sarvam → Piper (offline). 
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

          {/* Edge TTS (Free, High Quality) */}
          <div className="bg-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-300">Edge TTS — Free, High Quality Urdu</h3>
              <span className={`text-xs ${piperStatus?.edgeTTS?.available ? 'text-green-400' : 'text-slate-500'}`}>
                {piperStatus?.edgeTTS?.available ? 'Installed ✅' : 'Not installed'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Microsoft Edge TTS is completely FREE with no API key needed. It has excellent natural Urdu voices 
              (Uzma, Asad). Requires internet connection. Best quality-to-cost ratio.
            </p>
            {!piperStatus?.edgeTTS?.available && (
              <button
                onClick={installEdgeTTS}
                disabled={edgeTTSInstalling}
                className="w-full px-3 py-2 text-xs bg-green-600 hover:bg-green-700 disabled:bg-slate-700 text-white rounded-lg"
              >
                {edgeTTSInstalling ? 'Installing...' : 'Install Edge TTS (pip install edge-tts)'}
              </button>
            )}
            {piperStatus?.edgeTTS?.available && (
              <div className="text-xs text-green-400">
                ✅ Urdu voices: Uzma (female), Asad (male) — Free, no API key needed
              </div>
            )}
          </div>

          {/* Piper Offline TTS */}
          <div className="bg-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-slate-300">Offline TTS (Piper) — No internet needed</h3>
            <p className="text-xs text-slate-500">
              Piper TTS works completely offline with no API keys. Models are ~30-60MB. 
              Urdu voice quality is acceptable but less natural than Edge TTS or ElevenLabs.
              Best for 8GB RAM systems.
            </p>

            {/* Piper Binary Status */}
            <div className="bg-slate-900 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">Piper Engine</span>
                {piperStatus?.binary?.ready ? (
                  <span className="text-xs text-green-400">Installed ✅</span>
                ) : (
                  <span className="text-xs text-slate-500">Not installed</span>
                )}
              </div>
              {!piperStatus?.binary?.ready && (
                <button
                  onClick={downloadPiperBinary}
                  disabled={piperBinaryDownloading}
                  className="w-full px-3 py-2 text-xs bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 text-white rounded-lg"
                >
                  {piperBinaryDownloading ? 'Downloading...' : 'Auto-Download Piper Engine (~15MB)'}
                </button>
              )}
            </div>

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
              Note: Piper binary auto-downloads on first use. You can also manually download from: github.com/rhasspy/piper/releases
            </p>
          </div>

          {/* Voice Test */}
          <div className="bg-slate-800 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-medium text-slate-300">Voice Test</h3>
            <p className="text-xs text-slate-500">Test your TTS setup by generating a short audio clip.</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => testVoice('ur')}
                disabled={!!testTTSStatus}
                className="px-4 py-2 text-xs bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 text-white rounded-lg"
              >
                🔊 Test Urdu Voice
              </button>
              <button
                onClick={() => testVoice('en')}
                disabled={!!testTTSStatus}
                className="px-4 py-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white rounded-lg"
              >
                🔊 Test English Voice
              </button>
            </div>
            {testTTSStatus && (
              <p className="text-xs text-slate-300">{testTTSStatus}</p>
            )}
          </div>
        </section>

        {/* ─── About Section ─── */}
        <section className="bg-slate-900 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-3">About</h2>
          <div className="space-y-2 text-sm text-slate-400">
            <p>JARVIS Hybrid v3.0.3</p>
            <p>AI-Powered Desktop Assistant with Voice & Automation</p>
            <p className="text-xs text-slate-600">
              Voice: ElevenLabs + Edge TTS (free) + OpenAI + Sarvam + Piper (offline)
              {' | '}STT: Groq Whisper + OpenAI Whisper
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
