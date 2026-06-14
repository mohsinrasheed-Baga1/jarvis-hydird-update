import { useEffect, useRef, useState } from 'react';

export default function TerminalPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<Array<{type: 'input' | 'output' | 'error' | 'info'; text: string}>>([
    { type: 'info', text: 'JARVIS Terminal v3.1.1 — Type commands and press Enter' },
    { type: 'info', text: 'Supports: Windows CMD / PowerShell commands, Python, pip, etc.' },
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Listen for terminal output from IPC
    const api = (window as any).electronAPI;
    if (api?.onTerminalOutput) {
      api.onTerminalOutput((data: any) => {
        if (data.sessionId === sessionId) {
          setOutput(prev => [...prev, { type: data.stream === 'stderr' ? 'error' : 'output', text: data.data }]);
        }
      });
    }
  }, [sessionId]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    const api = (window as any).electronAPI;
    if (!api?.terminalExecute) {
      setOutput(prev => [...prev, { type: 'error', text: 'Terminal not available in browser mode' }]);
      return;
    }

    setOutput(prev => [...prev, { type: 'input', text: `> ${cmd}` }]);
    setHistory(prev => [cmd, ...prev].slice(0, 50));
    setHistoryIndex(-1);
    setIsRunning(true);
    setInput('');

    try {
      const result = await api.terminalExecute(cmd);
      if (result.stdout) {
        setOutput(prev => [...prev, { type: 'output', text: result.stdout }]);
      }
      if (result.stderr) {
        setOutput(prev => [...prev, { type: 'error', text: result.stderr }]);
      }
      if (result.error && !result.stderr) {
        setOutput(prev => [...prev, { type: 'error', text: result.error }]);
      }
      if (!result.stdout && !result.stderr && !result.error) {
        setOutput(prev => [...prev, { type: 'output', text: '(command completed with no output)' }]);
      }
    } catch (err: any) {
      setOutput(prev => [...prev, { type: 'error', text: `Error: ${err.message}` }]);
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setOutput([]);
    }
  };

  const clearOutput = () => setOutput([]);

  const quickCommands = [
    { label: 'pip install edge-tts', cmd: 'pip install edge-tts' },
    { label: 'python --version', cmd: 'python --version' },
    { label: 'dir', cmd: 'dir' },
    { label: 'ipconfig', cmd: 'ipconfig' },
    { label: 'tasklist', cmd: 'tasklist' },
    { label: 'systeminfo', cmd: 'systeminfo' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a12]">
      {/* Terminal Header */}
      <div className="shrink-0 px-4 py-2.5 border-b border-slate-800/50 flex items-center justify-between bg-[#0c0c18]">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <span className="text-xs text-slate-500 ml-2">JARVIS Terminal</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearOutput}
            className="px-2.5 py-1 text-[10px] rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          >
            Clear
          </button>
          {isRunning && (
            <span className="text-[10px] text-cyan-400 animate-pulse">Running...</span>
          )}
        </div>
      </div>

      {/* Quick Commands */}
      <div className="shrink-0 px-4 py-1.5 border-b border-slate-800/30 bg-[#0b0b15] flex items-center gap-1.5 overflow-x-auto">
        <span className="text-[10px] text-slate-600 shrink-0">Quick:</span>
        {quickCommands.map(qc => (
          <button
            key={qc.cmd}
            onClick={() => executeCommand(qc.cmd)}
            disabled={isRunning}
            className="shrink-0 px-2 py-0.5 text-[10px] rounded-md bg-slate-800/50 hover:bg-slate-700 text-slate-500 hover:text-slate-200 transition-all disabled:opacity-40"
          >
            {qc.label}
          </button>
        ))}
      </div>

      {/* Output Area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-auto px-4 py-3 font-mono text-sm space-y-0.5"
        onClick={() => inputRef.current?.focus()}
      >
        {output.map((line, i) => (
          <div
            key={i}
            className={`whitespace-pre-wrap break-all leading-relaxed ${
              line.type === 'input' ? 'text-cyan-400' :
              line.type === 'error' ? 'text-red-400' :
              line.type === 'info' ? 'text-slate-500 italic' :
              'text-slate-200'
            }`}
          >
            {line.text}
          </div>
        ))}
        {isRunning && (
          <div className="text-cyan-400 animate-pulse">▌</div>
        )}
      </div>

      {/* Input Area */}
      <div className="shrink-0 px-4 py-3 border-t border-slate-800/50 bg-[#0c0c18]">
        <div className="flex items-center gap-2 rounded-lg bg-[#12122a] border border-slate-700/50 px-3 py-2">
          <span className="text-cyan-400 text-sm font-mono shrink-0">❯</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm font-mono text-slate-100 placeholder-slate-600 outline-none disabled:opacity-40"
            autoFocus
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-slate-600">↑↓ History • Ctrl+L Clear • Enter Execute</span>
          <span className="text-[10px] text-slate-600">v3.1.1</span>
        </div>
      </div>
    </div>
  );
}
