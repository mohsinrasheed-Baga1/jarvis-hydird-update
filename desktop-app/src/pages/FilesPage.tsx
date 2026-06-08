import { useState } from 'react';
import { fileService } from '../services/fileService';
import { storageService } from '../services/storageService';

interface UploadItem {
  file: File;
  status: 'queued' | 'uploading' | 'done' | 'failed';
  progress: number;
  message?: string;
}

interface FilesPageProps {
  backendConnected?: boolean;
}

export default function FilesPage({ backendConnected = false }: FilesPageProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const addFiles = (files: File[]) => {
    setItems(prev => [...prev, ...files.map(file => ({ file, status: 'queued' as const, progress: 0 }))]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    addFiles(Array.from(e.dataTransfer.files));
  };

  const uploadOne = async (index: number) => {
    const item = items[index];
    if (!item) return;
    setItems(prev => prev.map((entry, i) => i === index ? { ...entry, status: 'uploading', progress: 0 } : entry));
    try {
      const result = await fileService.uploadFile(
        item.file,
        storageService.getAppState().userId,
        storageService.getApiKeys(),
        {
          onProgress: progress => setItems(prev => prev.map((entry, i) => i === index ? { ...entry, progress } : entry)),
        }
      );
      setItems(prev => prev.map((entry, i) => i === index
        ? { ...entry, status: 'done', progress: 100, message: result.message || 'Uploaded and analyzed' }
        : entry
      ));
    } catch (error) {
      setItems(prev => prev.map((entry, i) => i === index
        ? { ...entry, status: 'failed', message: error instanceof Error ? error.message : 'Upload failed' }
        : entry
      ));
    }
  };

  const uploadAll = () => {
    items.forEach((item, index) => {
      if (item.status === 'queued' || item.status === 'failed') void uploadOne(index);
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Files</h1>
          <p className="text-slate-400">Upload images, PDFs, markdown, and text files to the existing chat backend.</p>
        </div>

        {!backendConnected && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Uploads need the local backend. Electron will keep checking while it starts.
          </div>
        )}

        <div
          onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${
            dragActive ? 'border-purple-500 bg-purple-500/10' : 'border-slate-700 bg-slate-900'
          }`}
        >
          <p className="text-white font-medium mb-4">Drop files here</p>
          <label className="inline-block px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg cursor-pointer">
            Select files
            <input
              type="file"
              multiple
              onChange={(e) => addFiles(Array.from(e.target.files || []))}
              accept="image/*,.pdf,.txt,.csv,.json,.md,.py,.js,.ts,.html,.css"
              className="hidden"
            />
          </label>
        </div>

        {items.length > 0 && (
          <section className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Selected files ({items.length})</h2>
              <button onClick={uploadAll} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
                Upload all
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={`${item.file.name}_${index}`} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">{fileService.getFileIcon(item.file)} {item.file.name}</p>
                      <p className="text-slate-500 text-xs">{fileService.formatFileSize(item.file.size)} · {item.status}</p>
                    </div>
                    <button
                      onClick={() => uploadOne(index)}
                      disabled={item.status === 'uploading' || item.status === 'done'}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded text-sm"
                    >
                      Upload
                    </button>
                  </div>
                  {item.status === 'uploading' && (
                    <div className="mt-3 h-2 bg-slate-800 rounded">
                      <div className="h-2 bg-purple-500 rounded" style={{ width: `${item.progress}%` }} />
                    </div>
                  )}
                  {item.message && <p className="text-xs text-slate-400 mt-2">{item.message}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
