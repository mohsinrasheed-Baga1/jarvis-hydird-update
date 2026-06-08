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

  useEffect(() => {
    setApiKeys(storageService.getApiKeys());
    setActiveProvider(storageService.getActiveProvider());
    // Check which keys are available in the main process
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.getApiKeyStatus) {
      electronAPI.getApiKeyStatus().then((s: Record<string, boolean>) => setKeyStatus(s)).catch(() => {});
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

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-slate-400">Manage model provider and API keys for the desktop app.</p>
        </div>

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
