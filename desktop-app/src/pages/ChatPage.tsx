import { useEffect, useRef, useState } from 'react';
import ChatMessage from '../components/ChatMessage';
import MessageInput from '../components/MessageInput';
import ModelSelector from '../components/ModelSelector';
import { apiClient, type BackendState } from '../services/apiClient';
import { storageService, type StoredChatMessage } from '../services/storageService';

type Provider = 'groq' | 'gemini' | 'openai';
type LocalAutomationCommand = {
  localAction: { type: 'windows' | 'browser' | 'search'; action: string; params: Record<string, unknown> };
  desktopAction: Record<string, unknown>;
  confirmation: string;
};

const welcomeMessage: StoredChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'JARVIS Hybrid desktop is ready. Add an API key in Settings, choose a model, and start chatting.',
  timestamp: Date.now(),
};

interface ChatPageProps {
  backend?: BackendState;
}

export default function ChatPage({ backend }: ChatPageProps) {
  const [messages, setMessages] = useState<StoredChatMessage[]>(() => {
    const stored = storageService.getChatHistory();
    return stored.length > 0 ? stored : [welcomeMessage];
  });
  const [selectedModel, setSelectedModel] = useState<Provider>(() => storageService.getActiveProvider());
  const [voiceRepliesEnabled, setVoiceRepliesEnabled] = useState(() => storageService.getPreferences().voiceEnabled);
  const [speechStatus, setSpeechStatus] = useState('');
  const [automationStatus, setAutomationStatus] = useState('');
  const [automationConnected, setAutomationConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    storageService.setChatHistory(messages);
  }, [messages]);

  useEffect(() => {
    let active = true;
    const refreshAutomationStatus = async () => {
      try {
        const status = await (window as any).electronAPI?.getStatus?.();
        if (active) setAutomationConnected(Boolean(status?.pythonReady));
      } catch {
        if (active) setAutomationConnected(false);
      }
    };
    refreshAutomationStatus();
    const timer = window.setInterval(refreshAutomationStatus, 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const changeModel = (provider: Provider) => {
    setSelectedModel(provider);
    storageService.setActiveProvider(provider);
  };

  const changeVoiceReplies = (enabled: boolean) => {
    setVoiceRepliesEnabled(enabled);
    storageService.setPreferences({ voiceEnabled: enabled });
    storageService.setAppState({ voiceEnabled: enabled });
    if (!enabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeechStatus('');
    }
  };

  const chooseVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    return voices.find(voice => voice.lang?.toLowerCase().startsWith('ur'))
      || voices.find(voice => ['hi-in', 'en-in'].includes(voice.lang?.toLowerCase()))
      || voices.find(voice => voice.lang?.toLowerCase().startsWith('en'))
      || voices[0];
  };

  const fallbackSpeakAssistantResponse = (text: string) => {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setSpeechStatus('Voice unavailable');
      window.setTimeout(() => setSpeechStatus(''), 3500);
      return;
    }

    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = chooseVoice();
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || 'en-IN';
      utterance.rate = 0.95;
      utterance.pitch = 1;
      utterance.onstart = () => setSpeechStatus('Speaking with browser voice...');
      utterance.onend = () => setSpeechStatus('');
      utterance.onerror = () => {
        setSpeechStatus('Voice unavailable');
        window.setTimeout(() => setSpeechStatus(''), 3500);
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = speak;
      window.setTimeout(speak, 500);
    } else {
      speak();
    }
  };

  const speakAssistantResponse = async (text: string, emotion: string = 'normal') => {
    if (!voiceRepliesEnabled || !text.trim()) return;

    try {
      setSpeechStatus('Creating natural voice...');
      const prefs = storageService.getPreferences();
      const blob = await apiClient.textToSpeech(text, storageService.getApiKeys(), prefs.language === 'en' ? 'en' : 'ur', emotion);
      const url = URL.createObjectURL(blob);
      audioRef.current?.pause();
      audioRef.current = new Audio(url);
      audioRef.current.onplay = () => setSpeechStatus('Speaking...');
      audioRef.current.onended = () => {
        setSpeechStatus('');
        URL.revokeObjectURL(url);
      };
      audioRef.current.onerror = () => {
        URL.revokeObjectURL(url);
        fallbackSpeakAssistantResponse(text);
      };
      await audioRef.current.play();
    } catch {
      fallbackSpeakAssistantResponse(text);
    }
  };

  const detectLocalAutomation = (raw: string): LocalAutomationCommand | null => {
    const text = raw.toLowerCase().trim();
    const normalized = text.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ');

    if (/(volume|awaz|awaaz|آواز|والیوم).*(up|increase|زیادہ|اوپر|بڑھا)|^(volume up|increase volume)$/i.test(normalized)) {
      return {
        localAction: { type: 'windows', action: 'volume_up', params: { steps: 5 } },
        desktopAction: { type: 'volume-up', steps: 5 },
        confirmation: 'Done, volume increased',
      };
    }
    if (/(volume|awaz|awaaz|آواز|والیوم).*(down|decrease|کم|نیچے)|^(volume down|decrease volume)$/i.test(normalized)) {
      return {
        localAction: { type: 'windows', action: 'volume_down', params: { steps: 5 } },
        desktopAction: { type: 'volume-down', steps: 5 },
        confirmation: 'Done, volume decreased',
      };
    }
    if (/\b(mute|unmute)\b|میوٹ/i.test(normalized)) {
      return {
        localAction: { type: 'windows', action: 'mute_toggle', params: {} },
        desktopAction: { type: 'mute-toggle' },
        confirmation: normalized.includes('unmute') ? 'Done, audio unmuted' : 'Done, audio muted',
      };
    }
    if (/(take|capture).*(screenshot)|سکرین شاٹ|screenshot/i.test(normalized)) {
      return {
        localAction: { type: 'windows', action: 'screenshot', params: {} },
        desktopAction: { type: 'screenshot' },
        confirmation: 'Done, screenshot created',
      };
    }

    const appMatch = normalized.match(/\bopen\s+(notepad|chrome|calculator|calc|paint|cmd|powershell)\b/);
    if (appMatch) {
      const app = appMatch[1] === 'calc' ? 'calculator' : appMatch[1];
      const label = app === 'chrome' ? 'Chrome' : app.charAt(0).toUpperCase() + app.slice(1);
      return {
        localAction: { type: 'windows', action: 'open_app', params: { name: app } },
        desktopAction: { type: 'open-app', app },
        confirmation: `Done, ${label} opened`,
      };
    }
    if (/\bopen\s+youtube\b|یوٹیوب.*(کھول|open)/i.test(normalized)) {
      return {
        localAction: { type: 'search', action: 'youtube', params: { query: '' } },
        desktopAction: { type: 'open-youtube', query: '' },
        confirmation: 'Done, YouTube opened',
      };
    }
    const googleMatch = normalized.match(/\bsearch\s+google(?:\s+for)?\s*(.*)$/) || normalized.match(/\bgoogle\s+search\s*(.*)$/);
    if (googleMatch) {
      const query = (googleMatch[1] || '').trim();
      return {
        localAction: { type: 'search', action: query ? 'google' : 'open_url', params: query ? { query } : { url: 'https://www.google.com' } },
        desktopAction: query ? { type: 'search-google', query } : { type: 'open-url', url: 'https://www.google.com' },
        confirmation: query ? 'Done, Google search opened' : 'Done, Google opened',
      };
    }
    if (/\bopen\s+google\b|گوگل.*(کھول|open)/i.test(normalized)) {
      return {
        localAction: { type: 'browser', action: 'open_url', params: { url: 'https://www.google.com' } },
        desktopAction: { type: 'open-url', url: 'https://www.google.com' },
        confirmation: 'Done, Google opened',
      };
    }
    return null;
  };

  const waitForTaskResult = async (taskId: string, userId: string) => {
    for (let i = 0; i < 12; i++) {
      await new Promise(resolve => window.setTimeout(resolve, 500));
      const result = await apiClient.getTaskResult(userId, taskId).catch(() => null);
      if (result?.completed) return result.result;
    }
    return null;
  };

  const executeAutomation = async (command: LocalAutomationCommand) => {
    const userId = storageService.getAppState().userId;
    setAutomationStatus('Automation running...');
    try {
      if (backend?.connected && automationConnected) {
        const queued = await apiClient.queueLocalAction(userId, command.localAction);
        const result = queued?.taskId ? await waitForTaskResult(queued.taskId, userId) : null;
        if (result?.success) return result;
      }
      const electronResult = await (window as any).electronAPI?.desktopAction?.(command.desktopAction);
      if (electronResult?.success) return electronResult;
      throw new Error(electronResult?.message || electronResult?.error || 'Automation did not complete');
    } finally {
      window.setTimeout(() => setAutomationStatus(automationConnected ? 'Automation Connected' : 'Automation Offline'), 1200);
    }
  };

  const handleSendMessage = async (text: string, file?: File | null) => {
    const messageText = text.trim();
    const displayText = file
      ? `${messageText || 'Please analyze this file.'}\n\nAttached: ${file.name}`
      : messageText;

    const userMessage: StoredChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: displayText,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const automation = !file ? detectLocalAutomation(messageText) : null;
      if (automation) {
        await executeAutomation(automation);
        const assistantMessage: StoredChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: automation.confirmation,
          emotion: 'normal',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        speakAssistantResponse(assistantMessage.content, 'normal');
        return;
      }

      const userId = storageService.getAppState().userId;
      const apiKeys = storageService.getApiKeys();
      const response = file
        ? await apiClient.uploadFile(
            userId,
            file,
            apiKeys,
            messageText || 'Please analyze this file.',
            selectedModel,
          )
        : await apiClient.sendMessage({
            message: messageText,
            userId,
            stream: false,
            activeProvider: selectedModel,
            apiKeys,
          });

      if (response.requiresLocalAction && response.localAction) {
        await apiClient.queueLocalAction(storageService.getAppState().userId, response.localAction).catch(() => undefined);
      }

      const assistantMessage: StoredChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: response.message || 'No response returned.',
        emotion: response.emotion,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      speakAssistantResponse(assistantMessage.content, response.emotion);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Could not reach the local backend.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    storageService.clearConversationHistory();
    setMessages([welcomeMessage]);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="bg-slate-950/70 border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">AI Chat</h1>
            <p className="text-xs text-slate-500">Local desktop assistant with cloud model routing</p>
          </div>
          <div className="flex items-center gap-3">
            <ModelSelector value={selectedModel} onChange={changeModel} />
            <button
              onClick={handleNewChat}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium"
            >
              New chat
            </button>
          </div>
        </div>
      </div>

      {!backend?.connected && (
        <div className="mx-auto mt-4 max-w-5xl w-full px-6">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <div className="font-medium">Local backend is not ready.</div>
            <div className="mt-1 text-amber-100/80">{backend?.error || backend?.label || 'Waiting for /api/health on port 3000.'}</div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto max-w-5xl mx-auto w-full px-6 py-8 space-y-6">
        {messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
        {isLoading && (
          <div className="bg-slate-800 rounded-lg p-4 text-slate-400 text-sm w-fit">
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-slate-950/85 border-t border-slate-800">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <MessageInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading || !backend?.connected}
            voiceRepliesEnabled={voiceRepliesEnabled}
            onVoiceRepliesChange={changeVoiceReplies}
            speechStatus={speechStatus}
            automationStatus={automationStatus || (automationConnected ? 'Automation Connected' : 'Automation Offline')}
          />
        </div>
      </div>
    </div>
  );
}
