import { useEffect, useState, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { apiClient, type ApiKeys } from '../services/apiClient';

type Provider = 'groq' | 'gemini' | 'openai';
type KeyId = Provider | 'elevenlabs' | 'sarvam';
type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error' | 'dev-mode';

interface UpdateDiagnostics {
  currentVersion: string;
  latestVersion: string | null;
  status: UpdateStatus;
  lastChecked: string | null;
  downloadProgress: { percent: number; bytesPerSecond: number; transferred: number; total: number; speed: string } | null;
  ghTokenLoaded: boolean;
  feedUrlConfigured: boolean;
  lastError: string | null;
  logPath: string;
  appPackaged: boolean;
  platform: string;
  arch: string;
}

const providers: Array<{ id: Provider; label: string; hint: string }> = [
  { id: 'groq', label: 'Groq', hint: 'gsk_...' },
  { id: 'gemini', label: 'Gemini', hint: 'AIza...' },
  { id: 'openai', label: 'OpenAI', hint: 'sk-...' },
];

const voiceProviders: Array<{ id: KeyId; label: string; hint: string }> = [
  { id: 'elevenlabs', label: 'ElevenLabs voice', hint: 'sk_...' },
  { id: 'sarvam', label: 'Sarvam voice fallback', hint: 'sb-...' },
];

const statusLabels: Record<UpdateStatus, { text: string; color: string }> = {
  idle: { text: 'Idle', color: 'text-slate-400' },
  checking: { text: 'Checking for updates...', color: 'text-blue-400' },
  available: { text: 'Update available!', color: 'text-yellow-400' },
  downloading: { text: 'Downloading update...', color: 'text-cyan-400' },
  downloaded: { text: 'Update ready to install', color: 'text-green-400' },
  'up-to-date': { text: 'Up to date', color: 'text-green-400' },
  error: { text: 'Update error', color: 'text-red-400' },
  'dev-mode': { text: 'Dev mode (updates disabled)', color: 'text-slate-500' },
};

export default function SettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({});
  const [activeProvider, setActiveProvider] = useState<Provider>('groq');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState('');
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({});

  // Update state
  const [updateDiagnostics, setUpdateDiagnostics] = useState<UpdateDiagnostics | null>(null);
  const [updateLog, setUpdateLog] = useState<string>('');
  const [showLog, setShowLog] = useState(false);
  const [updatePercent, setUpdatePercent] = useState(0);
  const [updateSpeed, setUpdateSpeed] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState('...');

  const getElectronAPI = useCallback(() => (window as any).electronAPI, []);

  // Load update diagnostics
  const refreshDiagnostics = useCallback(async () => {
    const api = getElectronAPI();
    if (api?.getUpdateDiagnostics) {
      try {
        const diag = await api.getUpdateDiagnostics();
        setUpdateDiagnostics(diag);
        setUpdateStatus(diag.status);
        setLatestVersion(diag.latestVersion);
        setCurrentVersion(diag.currentVersion);
      } catch {}
    }
  }, [getElectronAPI]);

  useEffect(() => {
    setApiKeys(storageService.getApiKeys());
    setActiveProvider(storageService.getActiveProvider());
    const electronAPI = getElectronAPI();
    if (electronAPI?.getApiKeyStatus) {
      electronAPI.getApiKeyStatus().then((s: Record<string, boolean>) => setKeyStatus(s)).catch(() => {});
    }
    if (electronAPI?.getAppVersion) {
      electronAPI.getAppVersion().then((v: string) => setCurrentVersion(v)).catch(() => {});
    }

    // Listen for update status events
    if (electronAPI?.onUpdateStatus) {
      electronAPI.onUpdateStatus((data: any) => {
        setUpdateStatus(data.status || 'idle');
        if (data.version) setLatestVersion(data.version);
        if (data.percent) setUpdatePercent(data.percent);
        if (data.speed) setUpdateSpeed(data.speed);
        if (data.currentVersion) setCurrentVersion(data.currentVersion);
        // Refresh full diagnostics on any status change
        refreshDiagnostics();
      });
    }

    // Initial diagnostics load
    refreshDiagnostics();
  }, [getElectronAPI, refreshDiagnostics]);

  const updateKey = (provider: KeyId, value: string) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
    setSaved(false);
  };

  const save = async () => {
    storageService.setApiKeys(apiKeys);
    storageService.setActiveProvider(activeProvider);
    try {
      const electronAPI = getElectronAPI();
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

  const handleCheckForUpdates = () => {
    const api = getElectronAPI();
    if (api?.checkForUpdates) {
      api.checkForUpdates();
      setUpdateStatus('checking');
    }
  };

  const handleInstallUpdate = () => {
    const api = getElectronAPI();
    if (api?.installUpdateNow) {
      api.installUpdateNow();
    }
  };

  const handleViewLog = async () => {
    const api = getElectronAPI();
    if (api?.getUpdateLog) {
      try {
        const log = await api.getUpdateLog();
        setUpdateLog(log || 'No updater log entries yet.');
        setShowLog(!showLog);
      } catch {
        setUpdateLog('Failed to read update log.');
        setShowLog(true);
      }
    }
  };

  const statusInfo = statusLabels[updateStatus] || statusLabels.idle;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Manage model provider, API keys, and updates for the desktop app.</p>
        </div>

        {/* ─── Update Section ─── */}
        <section className="bg-slate-900 border border-purple-500/30 rounded-lg p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center text-purple-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-6.219-8.56"/><polyline points="21 3 21 9 15 9"/></svg>
            </div>
            <h2 className="text-xl font-semibold text-white">Auto Update</h2>
          </div>

          {/* Version Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950 rounded-lg p-3 border border-slate-700">
              <p className="text-xs text-slate-500 mb-1">Current Version</p>
              <p className="text-lg font-mono font-bold text-white">v{currentVersion}</p>
            </div>
            <div className="bg-slate-950 rounded-lg p-3 border border-slate-700">
              <p className="text-xs text-slate-500 mb-1">Latest Version</p>
              <p className="text-lg font-mono font-bold text-white">{latestVersion ? `v${latestVersion}` : '—'}</p>
            </div>
          </div>

          {/* Update Status */}
          <div className="bg-slate-950 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">Update Status</span>
              <span className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.text}</span>
            </div>

            {/* Progress bar for downloading */}
            {(updateStatus === 'downloading') && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Downloading...</span>
                  <span>{updatePercent}% {updateSpeed && `(${updateSpeed})`}</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full transition-all duration-300"
                    style={{ width: `${updatePercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Last checked */}
            {updateDiagnostics?.lastChecked && (
              <p className="text-xs text-slate-500 mt-2">
                Last checked: {new Date(updateDiagnostics.lastChecked).toLocaleString()}
              </p>
            )}

            {/* Error message */}
            {updateDiagnostics?.lastError && (
              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                {updateDiagnostics.lastError}
              </div>
            )}

            {/* Update available banner */}
            {updateStatus === 'available' && latestVersion && (
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-400 font-medium">
                  New version v{latestVersion} is available! It will be downloaded automatically.
                </p>
              </div>
            )}

            {/* Update downloaded - install button */}
            {updateStatus === 'downloaded' && latestVersion && (
              <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-400 font-medium mb-2">
                  v{latestVersion} has been downloaded and is ready to install!
                </p>
                <button
                  onClick={handleInstallUpdate}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors"
                >
                  Restart & Install Update
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleCheckForUpdates}
              disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                updateStatus === 'checking' || updateStatus === 'downloading'
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700 text-white'
              }`}
            >
              {updateStatus === 'checking' ? 'Checking...' : 'Check for Updates'}
            </button>
            <button
              onClick={handleViewLog}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm"
            >
              {showLog ? 'Hide Log' : 'View Update Log'}
            </button>
          </div>

          {/* Update Log */}
          {showLog && (
            <div className="bg-slate-950 rounded-lg p-3 border border-slate-700 max-h-60 overflow-y-auto">
              <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">{updateLog}</pre>
            </div>
          )}

          {/* Diagnostics */}
          {updateDiagnostics && (
            <details className="group">
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 transition-colors">
                Show Diagnostics
              </summary>
              <div className="mt-2 bg-slate-950 rounded-lg p-3 border border-slate-700 text-xs font-mono text-slate-400 space-y-1">
                <div className="flex justify-between"><span>App Packaged:</span><span className={updateDiagnostics.appPackaged ? 'text-green-400' : 'text-red-400'}>{updateDiagnostics.appPackaged ? 'Yes' : 'No (dev mode)'}</span></div>
                <div className="flex justify-between"><span>Feed URL Configured:</span><span className={updateDiagnostics.feedUrlConfigured ? 'text-green-400' : 'text-red-400'}>{updateDiagnostics.feedUrlConfigured ? 'Yes' : 'No'}</span></div>
                <div className="flex justify-between"><span>GH Token:</span><span className={updateDiagnostics.ghTokenLoaded ? 'text-green-400' : 'text-yellow-400'}>{updateDiagnostics.ghTokenLoaded ? 'Loaded' : 'Not Loaded'}</span></div>
                <div className="flex justify-between"><span>Platform:</span><span>{updateDiagnostics.platform} {updateDiagnostics.arch}</span></div>
                <div className="flex justify-between"><span>Log Path:</span><span className="text-slate-300 truncate ml-4">{updateDiagnostics.logPath}</span></div>
                {updateDiagnostics.downloadProgress && (
                  <div className="flex justify-between"><span>Download:</span><span>{updateDiagnostics.downloadProgress.percent}% at {updateDiagnostics.downloadProgress.speed}</span></div>
                )}
              </div>
            </details>
          )}
        </section>

        {/* ─── API Keys Section ─── */}
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
      </div>
    </div>
  );
}
