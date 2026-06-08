interface CodeBlockProps {
  code: string;
  language: string;
}

export default function CodeBlock({ code, language }: CodeBlockProps) {
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      alert('کوپی ہو گیا! ✅');
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-700 my-2 overflow-hidden">
      <div className="flex items-center justify-between bg-slate-800 px-4 py-2">
        <span className="text-xs font-mono text-slate-400">{language || 'code'}</span>
        <button
          onClick={copyToClipboard}
          className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
        >
          📋 کاپی کریں
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className={`font-mono text-sm text-slate-300 language-${language}`}>
          {code}
        </code>
      </pre>
    </div>
  );
}
