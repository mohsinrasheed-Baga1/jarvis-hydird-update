interface ModelSelectorProps {
  value: 'groq' | 'gemini' | 'openai';
  onChange: (model: 'groq' | 'gemini' | 'openai') => void;
}

const models = [
  { id: 'groq', name: 'Groq' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'openai', name: 'OpenAI' },
] as const;

export default function ModelSelector({ value, onChange }: ModelSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as 'groq' | 'gemini' | 'openai')}
      className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
      title="Model provider"
    >
      {models.map(model => (
        <option key={model.id} value={model.id}>{model.name}</option>
      ))}
    </select>
  );
}
