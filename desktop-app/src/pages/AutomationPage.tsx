import { useState, useEffect } from 'react';

interface Task {
  id: string;
  action: string;
  status: 'running' | 'completed' | 'failed';
  progress?: number;
  startTime: number;
  endTime?: number;
}

export default function AutomationPage() {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: '1',
      action: 'اسکرین شاٹ لینا',
      status: 'completed',
      startTime: Date.now() - 60000,
      endTime: Date.now() - 59000,
    },
    {
      id: '2',
      action: 'گوگل پر تلاش',
      status: 'completed',
      startTime: Date.now() - 30000,
      endTime: Date.now() - 28000,
    },
  ]);

  const [logs, setLogs] = useState<string[]>([
    '[14:30:01] ✅ اسکرین شاٹ محفوظ ہو گئی',
    '[14:29:45] 🔄 ٹاسک شروع: اسکرین شاٹ',
    '[14:28:30] ✅ گوگل تلاش مکمل',
  ]);

  const stopTask = (taskId: string) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId ? { ...t, status: 'failed' as const, endTime: Date.now() } : t
      )
    );
  };

  const clearCompleted = () => {
    setTasks(prev => prev.filter(t => t.status === 'running'));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">🤖 آٹومیشن پینل</h1>
          <p className="text-slate-400">چل رہے ٹاسک اور ہسٹری</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'چل رہے', value: tasks.filter(t => t.status === 'running').length },
            { label: 'مکمل', value: tasks.filter(t => t.status === 'completed').length },
            { label: 'ناکام', value: tasks.filter(t => t.status === 'failed').length },
          ].map((stat, i) => (
            <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-400">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Running Tasks */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">🔄 ٹاسک</h2>
            <button
              onClick={clearCompleted}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              🗑️ صاف کریں
            </button>
          </div>

          {tasks.length === 0 ? (
            <p className="text-slate-400 text-center py-8">کوئی ٹاسک نہیں ہے۔</p>
          ) : (
            <div className="space-y-2">
              {tasks.map(task => (
                <div key={task.id} className="bg-slate-900/50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${
                      task.status === 'running' ? 'bg-green-500 animate-pulse' :
                      task.status === 'completed' ? 'bg-blue-500' : 'bg-red-500'
                    }`}></span>
                    <div>
                      <p className="text-white text-sm">{task.action}</p>
                      <p className="text-slate-400 text-xs">
                        {task.status === 'running' ? 'جاری ہے...' : task.status === 'completed' ? '✅ مکمل' : '❌ ناکام'}
                      </p>
                    </div>
                  </div>
                  {task.status === 'running' && (
                    <button
                      onClick={() => stopTask(task.id)}
                      className="px-3 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-sm transition-colors"
                    >
                      ⏹️ روکیں
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">📋 لاگز</h2>
          <div className="bg-slate-900/50 rounded-lg p-4 font-mono text-xs max-h-64 overflow-y-auto space-y-1">
            {logs.map((log, i) => (
              <p key={i} className="text-slate-300">{log}</p>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-bold text-white mb-4">⚡ فوری ایکشنز</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { icon: '📸', label: 'اسکرین شاٹ' },
              { icon: '🌐', label: 'گوگل تلاش' },
              { icon: '📁', label: 'فائل کھولیں' },
              { icon: '📝', label: 'نوٹ پیڈ' },
            ].map((action, i) => (
              <button
                key={i}
                className="flex items-center gap-2 justify-center px-4 py-3 bg-slate-900/50 hover:bg-slate-900/80 border border-slate-700 rounded-lg text-white text-sm transition-colors"
              >
                <span>{action.icon}</span>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
