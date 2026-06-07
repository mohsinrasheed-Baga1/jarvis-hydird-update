import { useState } from 'react';

interface Memory {
  id: string;
  title: string;
  content: string;
  category: string;
  date: string;
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([
    {
      id: '1',
      title: 'صارف کی ترجیحات',
      content: 'صارف کو اردو میں جواب دینا پسند ہے۔',
      category: 'ترجیحات',
      date: '2026-06-05',
    },
    {
      id: '2',
      title: 'کام کی تفصیلات',
      content: 'صارف ایک سافٹویئر ڈیولپر ہے۔',
      category: 'پروفائل',
      date: '2026-06-04',
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const filteredMemories = memories.filter(m =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const handleExport = () => {
    const data = JSON.stringify(memories, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jarvis-memories.json';
    a.click();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">💾 یادیں</h1>
          <p className="text-slate-400">AI کو یاد رکھنے والی معلومات</p>
        </div>

        {/* Search & Actions */}
        <div className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="یادوں میں تلاش کریں..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            💾 ڈاؤن لوڈ کریں
          </button>
        </div>

        {/* Memories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMemories.map(memory => (
            <div key={memory.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-medium">{memory.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{memory.category}</p>
                </div>
                <button
                  onClick={() => handleDelete(memory.id)}
                  className="text-slate-400 hover:text-red-400 transition-colors"
                >
                  ✕
                </button>
              </div>
              <p className="text-slate-300 text-sm mb-3">{memory.content}</p>
              <p className="text-xs text-slate-500">📅 {memory.date}</p>
            </div>
          ))}
        </div>

        {filteredMemories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-400">کوئی یاد نہیں ملی۔</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'کل یادیں', value: memories.length },
            { label: 'زمرہ جات', value: new Set(memories.map(m => m.category)).size },
            { label: 'تازہ ترین', value: memories.length > 0 ? '24 گھنٹے' : '-' },
          ].map((stat, i) => (
            <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-purple-400">{stat.value}</p>
              <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
