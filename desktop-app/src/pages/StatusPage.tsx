import { useState, useEffect } from 'react';
import { apiClient } from '../services/apiClient';

interface SystemStatus {
  cpu: number;
  ram: number;
  internet: boolean;
  cloud: boolean;
  desktop: boolean;
  api: Record<string, boolean>;
}

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatus>({
    cpu: 45,
    ram: 62,
    internet: true,
    cloud: true,
    desktop: true,
    api: {
      groq: true,
      gemini: false,
      openai: true,
      zai: false,
    },
  });

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const backend = await apiClient.getBackendState().catch(() => null);
      const electron = await ((window as any).electronAPI?.getStatus?.() || Promise.resolve(null)).catch(() => null);
      if (!active) return;
      setStatus(prev => ({
        ...prev,
        internet: navigator.onLine,
        cloud: Boolean(backend?.connected),
        desktop: Boolean(electron?.pythonReady),
      }));
    };
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">📊 سسٹم اسٹیٹس</h1>
          <p className="text-slate-400">کارکردگی اور کنکشن کی معلومات</p>
        </div>

        {/* CPU & RAM */}
        <div className="grid grid-cols-2 gap-4">
          {/* CPU */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-medium">💻 CPU</span>
              <span className="text-purple-400 text-xl font-bold">{status.cpu}%</span>
            </div>
            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-600 to-blue-600 transition-all duration-500"
                style={{ width: `${status.cpu}%` }}
              ></div>
            </div>
          </div>

          {/* RAM */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-medium">🧠 RAM</span>
              <span className="text-blue-400 text-xl font-bold">{status.ram}%</span>
            </div>
            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-cyan-600 transition-all duration-500"
                style={{ width: `${status.ram}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">🔌 کنکشنز</h2>
          <div className="space-y-3">
            {[
              { label: 'انٹرنیٹ', status: status.internet, icon: '🌐' },
              { label: 'کلاؤڈ سرور', status: status.cloud, icon: '☁️' },
              { label: 'ڈیسک ٹاپ ایجنٹ', status: status.desktop, icon: '🖥️' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-900/50 rounded">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-white">{item.label}</span>
                </div>
                <span className={`px-3 py-1 rounded text-sm font-medium ${
                  item.status
                    ? 'bg-green-600/20 text-green-400'
                    : 'bg-red-600/20 text-red-400'
                }`}>
                  {item.status ? '✅ جڑا ہوا' : '❌ منقطع'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* API Status */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">🔑 API اسٹیٹس</h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(status.api).map(([provider, connected]) => (
              <div key={provider} className="flex items-center justify-between p-3 bg-slate-900/50 rounded">
                <span className="text-white capitalize">{provider}</span>
                <span className={connected ? 'text-green-400' : 'text-slate-500'}>
                  {connected ? '✅' : '⚪'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">ℹ️ سسٹم معلومات</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between p-2 bg-slate-900/50 rounded">
              <span className="text-slate-400">OS</span>
              <span className="text-white">Windows 10</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-900/50 rounded">
              <span className="text-slate-400">ورژن</span>
              <span className="text-white">2.0.0</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-900/50 rounded">
              <span className="text-slate-400">Node.js</span>
              <span className="text-white">v18.x</span>
            </div>
            <div className="flex justify-between p-2 bg-slate-900/50 rounded">
              <span className="text-slate-400">Python</span>
              <span className="text-white">3.11+</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
