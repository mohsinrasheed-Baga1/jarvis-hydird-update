import { useEffect, useState } from 'react';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import FilesPage from './pages/FilesPage';
import AutomationPage from './pages/AutomationPage';
import { apiClient, type BackendState } from './services/apiClient';

type Page = 'chat' | 'files' | 'automation' | 'settings';

interface NavItem {
  id: Page;
  icon: string;
  label: string;
}

const navItems: NavItem[] = [
  { id: 'chat', icon: 'C', label: 'Chat' },
  { id: 'files', icon: 'F', label: 'Files' },
  { id: 'automation', icon: 'A', label: 'Automation' },
  { id: 'settings', icon: 'S', label: 'Settings' },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('chat');
  const [version, setVersion] = useState('...');
  const [backend, setBackend] = useState<BackendState>({ connected: false, label: 'Checking' });
  const [updateBanner, setUpdateBanner] = useState<{status: string; version?: string; percent?: number; speed?: string} | null>(null);

  useEffect(() => {
    const api = (window as any).electronAPI;
    api?.getAppVersion?.().then((v: string) => setVersion(v));

    // Listen for update status changes
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

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':
        return <ChatPage backend={backend} />;
      case 'settings':
        return <SettingsPage />;
      case 'files':
        return <FilesPage backendConnected={backend.connected} />;
      case 'automation':
        return <AutomationPage />;
      default:
        return <ChatPage backend={backend} />;
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex overflow-hidden">
      <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-950/95 flex flex-col">
        <div className="h-20 px-5 flex items-center gap-3 border-b border-slate-800">
          <div className="w-11 h-11 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold">
            J
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-wide text-white">JARVIS Hybrid</h1>
            <p className="text-xs text-slate-500">Desktop Assistant</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full h-11 rounded-lg px-3 flex items-center gap-3 text-left transition-colors ${
                currentPage === item.id
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-950/40'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              }`}
            >
              <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${
                currentPage === item.id ? 'bg-white/15' : 'bg-slate-900'
              }`}>
                {item.icon}
              </span>
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="glass-panel rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Backend</span>
              <span className={`inline-flex items-center gap-2 text-xs font-medium ${
                backend.connected ? 'text-green-400' : 'text-red-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${backend.connected ? 'bg-green-400' : 'bg-red-400'}`} />
                {backend.connected ? 'Connected' : 'Offline'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2 truncate">{backend.label}</p>
          </div>
          <div className="text-xs text-slate-600">v{version}</div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 shrink-0 border-b border-slate-800 bg-slate-950/70 backdrop-blur px-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{currentPage}</p>
            <h2 className="text-lg font-semibold text-white">{navItems.find(item => item.id === currentPage)?.label}</h2>
          </div>
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
            backend.connected
              ? 'bg-green-500/10 text-green-300 border-green-500/20'
              : 'bg-red-500/10 text-red-300 border-red-500/20'
          }`}>
            {backend.connected ? 'Connected' : 'Offline'}
          </div>
        </header>

        {/* Update status banner */}
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

        <section className="flex-1 min-h-0 overflow-auto">
          {renderPage()}
        </section>
      </main>
    </div>
  );
}
