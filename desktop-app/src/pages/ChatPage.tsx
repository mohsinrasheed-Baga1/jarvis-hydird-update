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
      const apiKeys = storageService.getApiKeys();
      const lang = prefs.language === 'en' ? 'en' : 'ur';

      // In Electron: Try IPC-based TTS first (most reliable)
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.generateTTS) {
        try {
          const ttsResult = await electronAPI.generateTTS(text, lang, emotion, apiKeys);
          if (ttsResult.success && ttsResult.audioBase64) {
            const audioUrl = `data:${ttsResult.contentType};base64,${ttsResult.audioBase64}`;
            audioRef.current?.pause();
            audioRef.current = new Audio(audioUrl);
            audioRef.current.onplay = () => setSpeechStatus('Speaking...');
            audioRef.current.onended = () => setSpeechStatus('');
            audioRef.current.onerror = () => {
              // IPC TTS failed to play, try backend API
              apiClient.textToSpeech(text, apiKeys, lang, emotion).then(blob => {
                const url = URL.createObjectURL(blob);
                audioRef.current = new Audio(url);
                audioRef.current.onplay = () => setSpeechStatus('Speaking...');
                audioRef.current.onended = () => { setSpeechStatus(''); URL.revokeObjectURL(url); };
                audioRef.current.onerror = () => { URL.revokeObjectURL(url); fallbackSpeakAssistantResponse(text); };
                audioRef.current.play().catch(() => fallbackSpeakAssistantResponse(text));
              }).catch(() => fallbackSpeakAssistantResponse(text));
            };
            await audioRef.current.play();
            return;
          }
        } catch (ipcErr) {
          // IPC TTS failed, fall through to backend API
          console.warn('IPC TTS failed, trying backend:', ipcErr);
        }
      }

      // Backend API TTS
      const blob = await apiClient.textToSpeech(text, apiKeys, lang, emotion);
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

  // Parse [ACTION:json] blocks from AI response text
  const parseActionFromResponse = (text: string): { cleanText: string; actions: Record<string, unknown>[] } => {
    const actions: Record<string, unknown>[] = [];
    const actionRegex = /\[ACTION:(\{[^}]+\})\]/g;
    let match;
    let cleanText = text;

    while ((match = actionRegex.exec(text)) !== null) {
      try {
        const actionJson = JSON.parse(match[1]);
        actions.push(actionJson);
      } catch {
        // Skip malformed action blocks
      }
    }

    // Remove action blocks from display text
    cleanText = text.replace(actionRegex, '').trim();

    return { cleanText, actions };
  };

  // Execute parsed actions via Electron IPC
  const executeParsedActions = async (actions: Record<string, unknown>[]): Promise<boolean> => {
    let allSuccess = true;
    for (const action of actions) {
      try {
        const electronResult = await (window as any).electronAPI?.desktopAction?.(action);
        if (!electronResult?.success) {
          allSuccess = false;
        }
      } catch {
        allSuccess = false;
      }
    }
    return allSuccess;
  };

  const detectLocalAutomation = (raw: string): LocalAutomationCommand | null => {
    const text = raw.toLowerCase().trim();
    const normalized = text.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ');

    if (/(volume|awaz|awaaz|آواز|والیوم).*(up|increase|زیادہ|اوپر|بڑھا)|^(volume up|increase volume)$/i.test(normalized)) {
      return {
        localAction: { type: 'windows', action: 'volume_up', params: { steps: 5 } },
        desktopAction: { type: 'volume-up', steps: 5 },
        confirmation: 'ہو گیا! والیوم بڑھا دیا 🔊',
      };
    }
    if (/(volume|awaz|awaaz|آواز|والیوم).*(down|decrease|کم|نیچے)|^(volume down|decrease volume)$/i.test(normalized)) {
      return {
        localAction: { type: 'windows', action: 'volume_down', params: { steps: 5 } },
        desktopAction: { type: 'volume-down', steps: 5 },
        confirmation: 'ہو گیا! والیوم کم کر دیا 🔉',
      };
    }
    if (/\b(mute|unmute)\b|میوٹ/i.test(normalized)) {
      return {
        localAction: { type: 'windows', action: 'mute_toggle', params: {} },
        desktopAction: { type: 'mute-toggle' },
        confirmation: normalized.includes('unmute') ? 'ہو گیا! آواز آن کر دی 🔊' : 'ہو گیا! میوٹ کر دیا 🔇',
      };
    }
    if (/(take|capture).*(screenshot)|سکرین شاٹ|screenshot/i.test(normalized)) {
      return {
        localAction: { type: 'windows', action: 'screenshot', params: {} },
        desktopAction: { type: 'screenshot' },
        confirmation: 'ہو گیا! سکرین شاٹ لی 📸',
      };
    }

    // YouTube with search query — most common automation request
    // Matches: "یوٹیوب پر تلاوت لگاؤ", "YouTube pe tilawat", "یوٹیوب پر نعت", "یوٹیوب پر گانا"
    const ytSearchMatch = normalized.match(/یوٹیوب\s*پر\s*(.+?)(?:\s*لگاؤ|\s*چلاؤ|\s*لگا|\s*چلا|\s*play|\s*چلائیں|\s*لگائیں|$)/)
      || normalized.match(/youtube\s*(?:pe|par|on)\s*(.+?)(?:\s*play|\s*open|\s*search|$)/i)
      || normalized.match(/(?:play|چلاؤ|لگاؤ)\s*(.+?)\s*(?:یوٹیوب|youtube)/i);
    if (ytSearchMatch) {
      const query = (ytSearchMatch[1] || '').trim();
      return {
        localAction: { type: 'search', action: 'youtube', params: { query } },
        desktopAction: { type: 'open-youtube', query },
        confirmation: query ? `یوٹیوب پر "${query}" لگا رہا ہوں! 🎬` : 'یوٹیوب کھول رہا ہوں! 🎬',
      };
    }

    // Just open YouTube without search
    if (/\bopen\s+youtube\b|یوٹیوب.*(کھول|open)/i.test(normalized)) {
      return {
        localAction: { type: 'search', action: 'youtube', params: { query: '' } },
        desktopAction: { type: 'open-youtube', query: '' },
        confirmation: 'یوٹیوب کھول رہا ہوں! 🎬',
      };
    }

    // Audio/Music/Islamic content — redirect to YouTube search
    if (/اذان\s*لگاؤ|adan|azan|اذان/i.test(normalized)) {
      return {
        localAction: { type: 'search', action: 'youtube', params: { query: 'adan azan call to prayer' } },
        desktopAction: { type: 'open-youtube', query: 'adan azan call to prayer' },
        confirmation: 'اذان لگا رہا ہوں! 🕌',
      };
    }
    if (/تلاوت|tilawat|قرآن\s*چلاؤ|quran\s*play/i.test(normalized)) {
      return {
        localAction: { type: 'search', action: 'youtube', params: { query: 'quran tilawat' } },
        desktopAction: { type: 'open-youtube', query: 'quran tilawat' },
        confirmation: 'تلاوت چلا رہا ہوں! 📖',
      };
    }
    if (/نعت|naat|نعت\s*لگاؤ/i.test(normalized)) {
      return {
        localAction: { type: 'search', action: 'youtube', params: { query: 'naat sharif' } },
        desktopAction: { type: 'open-youtube', query: 'naat sharif' },
        confirmation: 'نعت لگا رہا ہوں! 🌹',
      };
    }
    if (/گانا|song|music|موسیقی/i.test(normalized) && /چلاؤ|لگاؤ|play|بجاؤ/i.test(normalized)) {
      return {
        localAction: { type: 'search', action: 'youtube', params: { query: 'songs music' } },
        desktopAction: { type: 'open-youtube', query: 'songs music' },
        confirmation: 'گانا چلا رہا ہوں! 🎵',
      };
    }

    const appMatch = normalized.match(/\bopen\s+(notepad|chrome|calculator|calc|paint|cmd|powershell)\b/)
      || normalized.match(/(notepad|chrome|calculator|calc|paint|cmd|powershell)\s*(کھولو|کھول|chalao|open|chalao)/i);
    if (appMatch) {
      const app = appMatch[1] === 'calc' ? 'calculator' : appMatch[1];
      const label = app === 'chrome' ? 'Chrome' : app.charAt(0).toUpperCase() + app.slice(1);
      return {
        localAction: { type: 'windows', action: 'open_app', params: { name: app } },
        desktopAction: { type: 'open-app', app },
        confirmation: `ہو گیا! ${label} کھل گیا ✅`,
      };
    }

    // Open any URL
    const urlMatch = normalized.match(/(https?:\/\/[^\s]+)/i);
    if (urlMatch) {
      return {
        localAction: { type: 'browser', action: 'open_url', params: { url: urlMatch[1] } },
        desktopAction: { type: 'open-url', url: urlMatch[1] },
        confirmation: 'ویب سائٹ کھول رہا ہوں! 🌐',
      };
    }

    const googleMatch = normalized.match(/\bsearch\s+google(?:\s+for)?\s*(.*)$/) || normalized.match(/\bgoogle\s+search\s*(.*)$/)
      || normalized.match(/گوگل\s*(?:پر\s*)?search|گوگل\s*(?:سے\s*)?ڈھونڈو/i);
    if (googleMatch) {
      const query = (googleMatch[1] || '').trim();
      return {
        localAction: { type: 'search', action: query ? 'google' : 'open_url', params: query ? { query } : { url: 'https://www.google.com' } },
        desktopAction: query ? { type: 'search-google', query } : { type: 'open-url', url: 'https://www.google.com' },
        confirmation: query ? `گوگل پر "${query}" سرچ کر رہا ہوں! 🔍` : 'گوگل کھول رہا ہوں! 🔍',
      };
    }
    if (/\bopen\s+google\b|گوگل.*(کھول|open)/i.test(normalized)) {
      return {
        localAction: { type: 'browser', action: 'open_url', params: { url: 'https://www.google.com' } },
        desktopAction: { type: 'open-url', url: 'https://www.google.com' },
        confirmation: 'گوگل کھول رہا ہوں! 🔍',
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
      // ─── Step 1: Check for local automation commands ───
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
      const electronAPI = (window as any).electronAPI;
      const isElectron = !!electronAPI?.chatCompletion;

      // ─── Step 2: Try IPC-based chat first (works without backend!) ───
      if (isElectron && !file) {
        try {
          // Build conversation history from current messages
          const chatHistory = messages
            .filter(m => m.id !== 'welcome')
            .slice(-10)
            .map(m => ({ role: m.role, content: m.content }));

          const ipcResult = await electronAPI.chatCompletion(
            messageText,
            chatHistory,
            selectedModel,
            apiKeys,
          );

          if (ipcResult.success && ipcResult.message) {
            // Parse [ACTION:json] blocks and execute them
            let displayMessage = ipcResult.message;
            const { cleanText, actions } = parseActionFromResponse(displayMessage);
            if (actions.length > 0) {
              displayMessage = cleanText;
              setAutomationStatus('Executing action...');
              try {
                await executeParsedActions(actions);
                setAutomationStatus('Action completed ✅');
              } catch {
                setAutomationStatus('Action failed');
              }
              window.setTimeout(() => setAutomationStatus(automationConnected ? 'Automation Connected' : 'Automation Offline'), 3000);
            }

            const assistantMessage: StoredChatMessage = {
              id: `assistant_${Date.now()}`,
              role: 'assistant',
              content: displayMessage,
              emotion: ipcResult.emotion,
              timestamp: Date.now(),
            };
            setMessages(prev => [...prev, assistantMessage]);
            speakAssistantResponse(assistantMessage.content, ipcResult.emotion);
            return;
          }
          // IPC chat failed - fall through to backend API
        } catch (ipcErr) {
          console.warn('IPC chat failed, trying backend:', ipcErr);
        }
      }

      // ─── Step 3: Fall back to backend API chat ───
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
        // Execute local action directly via Electron IPC (most reliable)
        try {
          const electronResult = await (window as any).electronAPI?.desktopAction?.(response.localAction);
          if (electronResult?.success) {
            // Action executed successfully, modify message to confirm
            response.message = response.message || 'Action executed!';
          }
        } catch {
          // Fallback: queue via API
          await apiClient.queueLocalAction(storageService.getAppState().userId, response.localAction).catch(() => undefined);
        }
      }

      // Parse [ACTION:json] blocks from AI response and execute them
      let displayMessage = response.message || 'No response returned.';
      const { cleanText, actions } = parseActionFromResponse(displayMessage);
      if (actions.length > 0) {
        displayMessage = cleanText;
        // Execute all parsed actions via Electron IPC
        setAutomationStatus('Executing action...');
        try {
          await executeParsedActions(actions);
          setAutomationStatus('Action completed ✅');
        } catch {
          setAutomationStatus('Action failed');
        }
        window.setTimeout(() => setAutomationStatus(automationConnected ? 'Automation Connected' : 'Automation Offline'), 3000);
      }

      const assistantMessage: StoredChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: displayMessage,
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
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
            <div className="font-medium">Direct API Mode — Chat & voice working ✅</div>
            <div className="mt-1 text-cyan-100/80">You're using direct API calls. Set API keys in Settings for full functionality.</div>
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
            isLoading={isLoading}
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
