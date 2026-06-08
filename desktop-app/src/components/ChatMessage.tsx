interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  emotion?: string;
  timestamp: number;
}

interface ChatMessageProps {
  message: Message;
}

function renderText(content: string) {
  return content.split('\n').map((line, index) => {
    if (line.startsWith('### ')) return <h3 key={index} className="font-bold mt-3 mb-1">{line.slice(4)}</h3>;
    if (line.startsWith('## ')) return <h2 key={index} className="font-bold mt-3 mb-1">{line.slice(3)}</h2>;
    if (line.startsWith('# ')) return <h1 key={index} className="font-bold mt-3 mb-1">{line.slice(2)}</h1>;
    if (line.startsWith('- ')) return <p key={index} className="ml-3">• {line.slice(2)}</p>;
    if (!line.trim()) return <div key={index} className="h-2" />;
    return <p key={index}>{line}</p>;
  });
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 text-sm text-white">
          AI
        </div>
      )}

      <div className={`max-w-2xl rounded-lg p-4 ${isUser ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-100'}`}>
        <div className="text-sm leading-relaxed space-y-1">{renderText(message.content)}</div>
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 text-sm text-white">
          You
        </div>
      )}
    </div>
  );
}
