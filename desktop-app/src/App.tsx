import { useEffect, useState } from 'react';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import FilesPage from './pages/FilesPage';
import AutomationPage from './pages/AutomationPage';
import DashboardPage from './pages/DashboardPage';
import TerminalPage from './pages/TerminalPage';
import { apiClient, type BackendState } from './services/apiClient';

type Page = 'main' | 'settings';
type MainTab = 'chat' | 'dashboard' | 'terminal' | 'files' | 'automation';

interface NavItem {
  id: MainTab;
  icon: string;
  label: string;
  labelUr: string;
}

const mainTabs: NavItem[] = [
  { id: 'chat', icon: '💬', label: 'Chat', labelUr: 'چیٹ' },
  { id: 'dashboard', icon: '⚡', label: 'Dashboard', labelUr: 'ڈیش بورڈ' },
  { id: 'terminal', icon: '⬛', label: 'Terminal', labelUr: 'ٹرمینل' },
  { id: 'files', icon: '📁', label: 'Files', labelUr: 'فائلز' },
  { id: 'automation', icon: '🤖', label: 'Agents', labelUr: 'ایجنٹس' },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('main');
  const [activeTab, setActiveTab] = useState<MainTab>('chat');
  const [version, setVersion] = useState('...');
  const [backend, setBackend] = useState<BackendState>({ connected: false, label: 'Checking' });
  const [updateBanner, setUpdateBanner] = useState<{status: string; version?: string; percent?: number; speed?: string} | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    api?.getAppVersion?.().then((v: string) => setVersion(v));

    if (api?.onUpdateStatus) {
      api.onUpdateStatus((data: any) => {
        setUpdateBanner(data);
        if (data.status === 'up-to-date' || data.status === 'dev-mode') {
          setTimeout(() => setUpdateBanner(null), 3000);
        }
      });
    }

    let cancelled = false;
    const check = async () => {
      const state = await apiClient.getBackendState();
      if (!cancelled) setBackend(state);
    };
    check();
    const interval = window.setInterval(check, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const renderMainContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatPage backend={backend} />;
      case 'dashboard':
        return <DashboardPage />;
      case 'terminal':
        return <TerminalPage />;
      case 'files':
        return <FilesPage backendConnected={backend.connected} />;
      case 'automation':
        return <AutomationPage />;
      default:
        return <ChatPage backend={backend} />;
    }
  };

  // Settings overlay
  if (showSettings) {
    return (
      <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col">
        <div className="h-14 shrink-0 border-b border-slate-800 bg-slate-950/95 px-6 flex items-center justify-between" style={{ paddingRight: '146px' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold text-sm">J</div>
            <h1 className="text-base font-semibold text-white">Settings</h1>
            <button
              onClick={() => setShowSettings(false)}
              className="ml-3 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-all"
            >
              ← Back to JARVIS
            </button>
          </div>
          <div></div>
        </div>
        <div className="flex-1 overflow-auto">
          <SettingsPage />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="h-14 shrink-0 border-b border-slate-800 bg-slate-950/95 backdrop-blur px-4 flex items-center justify-between z-50" style={{ paddingRight: '146px' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-cyan-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-600/20">
            J
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white leading-tight">JARVIS Hybrid</h1>
            <p className="text-[10px] text-slate-500">Business Agent v3.1.1</p>
          </div>
          {/* Settings button - moved to left side to avoid overlap with window controls */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all ml-1"
            title="Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <div className={`px-2.5 py-1 rounded-full text-[10px] font-medium border flex items-center gap-1.5 ${
            backend.connected
              ? 'bg-green-500/10 text-green-300 border-green-500/20'
              : 'bg-red-500/10 text-red-300 border-red-500/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${backend.connected ? 'bg-green-400' : 'bg-red-400'}`} />
            {backend.connected ? 'Online' : 'Offline'}
          </div>
        </div>

        {/* Center Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/80 rounded-xl p-1 border border-slate-800/50">
          {mainTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-600/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span className="text-sm">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Right side - empty space reserved for window controls (close/minimize/maximize) */}
        <div className="flex items-center gap-2 min-w-[120px]">
        </div>
      </header>

      {/* Update Banner */}
      {updateBanner && updateBanner.status !== 'up-to-date' && updateBanner.status !== 'dev-mode' && updateBanner.status !== 'idle' && (
        <div className={`px-6 py-2 text-sm flex items-center gap-3 ${
          updateBanner.status === 'downloaded' ? 'bg-green-500/20 text-green-300 border-b border-green-500/30' :
          updateBanner.status === 'downloading' ? 'bg-blue-500/20 text-blue-300 border-b border-blue-500/30' :
          updateBanner.status === 'available' ? 'bg-yellow-500/20 text-yellow-300 border-b border-yellow-500/30' :
          updateBanner.status === 'checking' ? 'bg-slate-800 text-slate-300 border-b border-slate-700' :
          updateBanner.status === 'error' ? 'bg-red-500/20 text-red-300 border-b border-red-500/30' :
          'bg-slate-800 text-slate-300 border-b border-slate-700'
        }`}>
          {updateBanner.status === 'checking' && 'Checking for updates...'}
          {updateBanner.status === 'available' && `Update v${updateBanner.version} available!`}
          {updateBanner.status === 'downloading' && `Downloading v${updateBanner.version}... ${updateBanner.percent || 0}%`}
          {updateBanner.status === 'downloaded' && (
            <>
              Update v{updateBanner.version} ready!
              <button
                onClick={() => (window as any).electronAPI?.installUpdateNow?.()}
                className="ml-2 px-3 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium"
              >
                Restart & Install
              </button>
            </>
          )}
          {updateBanner.status === 'error' && `Update error: ${updateBanner.version || 'unknown'}`}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-hidden">
        {renderMainContent()}
      </main>
    </div>
  );
}
