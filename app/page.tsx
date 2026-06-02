"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type {
  EmotionType, JarvisMessage, APIKeys, LLMProvider,
  ResearchEntry, ResearchCategory, ResearchSource, SidebarSection,
} from "@/lib/protocol";

interface UploadedFile {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

interface BackgroundTask {
  id: string;
  description: string;
  status: "running" | "completed" | "failed";
  result?: string;
}

function formatMessage(content: string): string {
  return content
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\n/g, '<br/>');
}

// ============== MAIN APP PAGE ==============
export default function JarvisApp() {
  // === Section navigation ===
  const [activeSection, setActiveSection] = useState<SidebarSection>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // === API Keys (shared across sections) ===
  const loadApiKeys = (): APIKeys => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem("jarvis_api_keys");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  };

  const loadActiveProvider = (): LLMProvider => {
    if (typeof window === "undefined") return "groq";
    return (localStorage.getItem("jarvis_active_provider") as LLMProvider) || "groq";
  };

  const [apiKeys, setApiKeys] = useState<APIKeys>(loadApiKeys);
  const [activeProvider, setActiveProvider] = useState<LLMProvider>(loadActiveProvider);
  const hasAnyKey = Object.values(apiKeys).some((k) => k && k.trim().length > 0);

  const saveApiKeys = useCallback((keys: APIKeys) => {
    setApiKeys(keys);
    localStorage.setItem("jarvis_api_keys", JSON.stringify(keys));
  }, []);

  const saveActiveProvider = useCallback((provider: LLMProvider) => {
    setActiveProvider(provider);
    localStorage.setItem("jarvis_active_provider", provider);
  }, []);

  // === Sidebar items ===
  const sidebarItems: Array<{ id: SidebarSection; icon: string; label: string }> = [
    { id: "dashboard", icon: "🏠", label: "Dashboard" },
    { id: "chat", icon: "💬", label: "Chat" },
    { id: "recording", icon: "🎙️", label: "Recording" },
    { id: "settings", icon: "⚙️", label: "Settings" },
    { id: "research", icon: "📚", label: "Research" },
  ];

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">🧠</div>
          <div>
            <div className="sidebar-title">JARVIS</div>
            <div className="sidebar-subtitle">Hybrid AI Assistant</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              className={`sidebar-item ${activeSection === item.id ? "active" : ""}`}
              onClick={() => setActiveSection(item.id)}
              title={item.label}
            >
              <span className="sidebar-item-icon">{item.icon}</span>
              <span className="sidebar-item-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-version">v2.0.0</div>
        <div className="sidebar-toggle">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand" : "Collapse"}
          >
            {sidebarCollapsed ? "▸" : "◂"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeSection === "dashboard" && (
          <DashboardSection
            apiKeys={apiKeys}
            activeProvider={activeProvider}
            hasAnyKey={hasAnyKey}
            onNavigate={setActiveSection}
          />
        )}
        {activeSection === "chat" && (
          <ChatSection
            apiKeys={apiKeys}
            activeProvider={activeProvider}
            hasAnyKey={hasAnyKey}
            saveApiKeys={saveApiKeys}
            saveActiveProvider={saveActiveProvider}
          />
        )}
        {activeSection === "recording" && (
          <RecordingSection apiKeys={apiKeys} />
        )}
        {activeSection === "settings" && (
          <SettingsSection
            apiKeys={apiKeys}
            activeProvider={activeProvider}
            hasAnyKey={hasAnyKey}
            saveApiKeys={saveApiKeys}
            saveActiveProvider={saveActiveProvider}
          />
        )}
        {activeSection === "research" && (
          <ResearchSection apiKeys={apiKeys} />
        )}
      </main>
    </div>
  );
}

// ============== DASHBOARD SECTION ==============
function DashboardSection({
  apiKeys, activeProvider, hasAnyKey, onNavigate,
}: {
  apiKeys: APIKeys;
  activeProvider: LLMProvider;
  hasAnyKey: boolean;
  onNavigate: (s: SidebarSection) => void;
}) {
  const [connectionStatus, setConnectionStatus] = useState<"online" | "offline" | "nokey">("online");
  const [updateStatus, setUpdateStatus] = useState<{
    hasUpdate: boolean; currentVersion: string; latestVersion: string; status: string; lastChecked: number;
  }>({ hasUpdate: false, currentVersion: "2.0.0", latestVersion: "2.0.0", status: "up-to-date", lastChecked: 0 });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        await res.json();
        setConnectionStatus(hasAnyKey ? "online" : "nokey");
      } catch { setConnectionStatus("offline"); }
    };
    checkHealth();
  }, [hasAnyKey]);

  const checkForUpdates = useCallback(async () => {
    const repo = localStorage.getItem("jarvis_github_repo") || "";
    const token = localStorage.getItem("jarvis_github_token") || "";
    try {
      const res = await fetch(`/api/update?repo=${encodeURIComponent(repo)}&token=${encodeURIComponent(token)}`);
      const data = await res.json();
      setUpdateStatus({
        hasUpdate: data.hasUpdate,
        currentVersion: data.currentVersion,
        latestVersion: data.latestVersion,
        status: data.status,
        lastChecked: data.lastChecked,
      });
    } catch {
      setUpdateStatus(prev => ({ ...prev, status: "error" }));
    }
  }, []);

  useEffect(() => { checkForUpdates(); }, [checkForUpdates]);

  const configuredKeys = Object.entries(apiKeys).filter(([, v]) => v && v.trim().length > 0).length;
  const providerLabels: Record<LLMProvider, string> = {
    groq: "Groq", gemini: "Gemini", openai: "OpenAI", zai: "ZAI", xai: "xAI", anthropic: "Claude",
  };

  const agents = [
    { name: "Windows Agent", icon: "🖥️", status: "standby" as const },
    { name: "Browser Agent", icon: "🌐", status: "active" as const },
    { name: "WhatsApp Agent", icon: "📱", status: "standby" as const },
    { name: "Freelance Agent", icon: "💼", status: "active" as const },
  ];

  const conversationsCount = (() => {
    try {
      const msgs = localStorage.getItem("jarvis_conversation_count");
      return msgs ? parseInt(msgs, 10) : 0;
    } catch { return 0; }
  })();

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-title">JARVIS Dashboard</div>
        <div className="dashboard-subtitle">سسٹم کا جائزہ — ریان سر کا ذاتی ساتھی</div>
      </div>

      <div className="dashboard-grid">
        {/* System Status */}
        <div className="dash-card">
          <div className="dash-card-header">
            <span className="dash-card-title">System Status</span>
            <div className="dash-card-icon purple">⚡</div>
          </div>
          <div className={`dash-card-value ${connectionStatus === "online" ? "online" : connectionStatus === "offline" ? "offline" : "warning"}`}>
            {connectionStatus === "online" ? "Online" : connectionStatus === "offline" ? "Offline" : "No API Key"}
          </div>
          <div className="dash-card-desc">
            Active Provider: {hasAnyKey ? providerLabels[activeProvider] : "None configured"}
          </div>
          <span className={`status-badge ${connectionStatus === "online" ? "active" : "offline"}`}>
            <span className="status-badge-dot"></span>
            {connectionStatus === "online" ? "Connected" : "Disconnected"}
          </span>
        </div>

        {/* API Keys */}
        <div className="dash-card">
          <div className="dash-card-header">
            <span className="dash-card-title">API Keys</span>
            <div className="dash-card-icon green">🔑</div>
          </div>
          <div className="dash-card-value">{configuredKeys}</div>
          <div className="dash-card-desc">
            {configuredKeys > 0
              ? `Configured: ${Object.entries(apiKeys).filter(([, v]) => v && v.trim().length > 0).map(([k]) => providerLabels[k as LLMProvider] || k).join(", ")}`
              : "No API keys configured"}
          </div>
          {configuredKeys === 0 && (
            <button className="quick-btn" style={{ marginTop: 10 }} onClick={() => onNavigate("settings")}>
              ⚙️ Add API Keys
            </button>
          )}
        </div>

        {/* Conversations */}
        <div className="dash-card">
          <div className="dash-card-header">
            <span className="dash-card-title">Conversations</span>
            <div className="dash-card-icon blue">💬</div>
          </div>
          <div className="dash-card-value">{conversationsCount}</div>
          <div className="dash-card-desc">Total messages in current session</div>
        </div>

        {/* Auto-Update */}
        <div className="dash-card">
          <div className="dash-card-header">
            <span className="dash-card-title">Auto-Update</span>
            <div className="dash-card-icon orange">🔄</div>
          </div>
          <div className={`dash-card-value ${updateStatus.hasUpdate ? "warning" : "online"}`}>
            v{updateStatus.currentVersion}
          </div>
          <div className="dash-card-desc">
            {updateStatus.status === "up-to-date" && "Up to date ✓"}
            {updateStatus.status === "update-available" && `Update available: v${updateStatus.latestVersion}`}
            {updateStatus.status === "error" && "Could not check for updates"}
          </div>
          <button className="quick-btn" style={{ marginTop: 8 }} onClick={checkForUpdates}>
            🔄 Check Now
          </button>
        </div>

        {/* Earnings Overview */}
        <div className="dash-card">
          <div className="dash-card-header">
            <span className="dash-card-title">Earnings</span>
            <div className="dash-card-icon teal">💰</div>
          </div>
          <div className="dash-card-value" style={{ color: "var(--accent-tertiary)" }}>—</div>
          <div className="dash-card-desc">Connect desktop app for earnings tracking</div>
        </div>

        {/* Quick Actions */}
        <div className="dash-card" style={{ gridColumn: "1 / -1" }}>
          <div className="dash-card-header">
            <span className="dash-card-title">Quick Actions</span>
            <div className="dash-card-icon yellow">🎯</div>
          </div>
          <div className="quick-actions-row">
            <button className="quick-btn" onClick={() => onNavigate("chat")}>
              🎙️ Voice Chat
            </button>
            <button className="quick-btn" onClick={() => onNavigate("chat")}>
              🎯 Hunt Jobs
            </button>
            <button className="quick-btn" onClick={() => onNavigate("chat")}>
              📝 Write Proposal
            </button>
            <button className="quick-btn" onClick={() => onNavigate("recording")}>
              🎙️ Record Audio
            </button>
            <button className="quick-btn" onClick={() => onNavigate("research")}>
              📚 Research
            </button>
          </div>
        </div>
      </div>

      {/* Agent Status */}
      <div style={{ marginTop: 24 }}>
        <div className="dash-card-title" style={{ marginBottom: 12 }}>Agent Status</div>
        <div className="agents-row">
          {agents.map((agent) => (
            <div key={agent.name} className="agent-card">
              <div className="agent-card-icon">{agent.icon}</div>
              <div className="agent-card-info">
                <div className="agent-card-name">{agent.name}</div>
                <span className={`status-badge ${agent.status}`}>
                  <span className="status-badge-dot"></span>
                  {agent.status === "active" ? "Active" : "Standby"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============== CHAT SECTION ==============
function ChatSection({
  apiKeys, activeProvider, hasAnyKey, saveApiKeys, saveActiveProvider,
}: {
  apiKeys: APIKeys;
  activeProvider: LLMProvider;
  hasAnyKey: boolean;
  saveApiKeys: (keys: APIKeys) => void;
  saveActiveProvider: (provider: LLMProvider) => void;
}) {
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"online" | "offline" | "nokey">("online");
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>("normal");
  const [streamingContent, setStreamingContent] = useState("");
  const [userId] = useState(() => `user_${Date.now()}`);

  // Voice & Conversation
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversationMode, setConversationMode] = useState(false);

  // File upload
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

  // Background tasks
  const [bgTasks, setBgTasks] = useState<BackgroundTask[]>([]);

  // Refs
  const conversationModeRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isLoadingRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<JarvisMessage[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakQueueRef = useRef<boolean>(false);

  // Sync refs
  useEffect(() => { conversationModeRef.current = conversationMode; }, [conversationMode]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Check health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        await res.json();
        setConnectionStatus(hasAnyKey ? "online" : "nokey");
      } catch { setConnectionStatus("offline"); }
    };
    checkHealth();
  }, [hasAnyKey]);

  // Show settings on first visit
  useEffect(() => {
    if (!hasAnyKey) setShowSettings(true);
  }, [hasAnyKey]);

  // Load voices
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // ===== CANCEL ALL SPEECH =====
  const cancelAllSpeech = useCallback(() => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    speakQueueRef.current = false;
  }, []);

  // ===== DETECT LANGUAGE =====
  const detectLanguage = (text: string): "ur" | "en" | "mixed" => {
    const urduChars = text.match(/[\u0600-\u06FF]/g);
    const urduCount = urduChars ? urduChars.length : 0;
    const ratio = text.length > 0 ? urduCount / text.length : 0;
    if (ratio > 0.15) return "ur";
    if (ratio > 0.03) return "mixed";
    return "en";
  };

  // ===== SPLIT URDU TEXT INTO SPEAKABLE CHUNKS =====
  const splitUrduChunks = (text: string): string[] => {
    const maxLen = 150;
    const raw = text.split(/(?<=[.!?۔\n])\s*/);
    const chunks: string[] = [];
    let current = "";
    for (const segment of raw) {
      if ((current + " " + segment).length > maxLen && current.length > 0) {
        chunks.push(current.trim());
        current = segment;
      } else {
        current = current ? current + " " + segment : segment;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text];
  };

  // ===== BROWSER TTS =====
  const speakWithBrowser = useCallback((
    text: string, lang: "ur" | "en" | "mixed", emotion: EmotionType,
    voice: SpeechSynthesisVoice | null, onDone?: () => void
  ) => {
    const chunks = lang === "ur" ? splitUrduChunks(text) :
      text.match(new RegExp(`.{1,180}[.!?\\n]|.{1,180}`, "g")) || [text];
    let chunkIndex = 0;
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    speakQueueRef.current = true;
    const speakChunk = () => {
      if (!speakQueueRef.current || chunkIndex >= chunks.length) {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        speakQueueRef.current = false;
        onDone?.();
        return;
      }
      const chunk = chunks[chunkIndex].trim();
      if (!chunk) { chunkIndex++; speakChunk(); return; }
      const utterance = new SpeechSynthesisUtterance(chunk);
      if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
      else { utterance.lang = (lang === "ur" || lang === "mixed") ? "ur-PK" : "en-US"; }
      utterance.rate = emotion === "happy" || emotion === "surprised" ? 1.0 : 0.88;
      utterance.pitch = emotion === "happy" ? 1.1 : emotion === "serious" ? 0.85 : 1.0;
      utterance.volume = 1.0;
      utterance.onend = () => { chunkIndex++; speakChunk(); };
      utterance.onerror = () => { chunkIndex++; speakChunk(); };
      window.speechSynthesis.speak(utterance);
    };
    speakChunk();
  }, []);

  // ===== GOOGLE TRANSLATE TTS =====
  const speakWithGoogleTTS = useCallback((text: string, emotion: EmotionType, onDone?: () => void) => {
    const chunks = splitUrduChunks(text);
    let chunkIndex = 0;
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    speakQueueRef.current = true;
    const playChunk = () => {
      if (!speakQueueRef.current || chunkIndex >= chunks.length) {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        speakQueueRef.current = false;
        onDone?.();
        return;
      }
      const chunk = chunks[chunkIndex].trim();
      if (!chunk) { chunkIndex++; playChunk(); return; }
      const encoded = encodeURIComponent(chunk.substring(0, 180));
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ur&q=${encoded}`;
      const audio = new Audio();
      audio.crossOrigin = "anonymous";
      audio.src = url;
      currentAudioRef.current = audio;
      audio.onended = () => { currentAudioRef.current = null; chunkIndex++; playChunk(); };
      audio.onerror = () => { currentAudioRef.current = null; speakWithBrowser(text, "ur", emotion, null, onDone); };
      audio.play().catch(() => { currentAudioRef.current = null; speakWithBrowser(text, "ur", emotion, null, onDone); });
    };
    playChunk();
  }, [speakWithBrowser]);

  // ===== URDU FALLBACK =====
  const speakUrduFallback = useCallback((text: string, emotion: EmotionType, onDone?: () => void) => {
    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find(v => v.lang === "ar-SA" && v.name.includes("Google")) ||
                        voices.find(v => v.lang.startsWith("ar") && v.name.includes("Google")) ||
                        voices.find(v => v.lang.startsWith("ar"));
    if (arabicVoice) { speakWithBrowser(text, "ur", emotion, arabicVoice, onDone); return; }
    speakWithGoogleTTS(text, emotion, onDone);
  }, [speakWithBrowser, speakWithGoogleTTS]);

  // ===== URDU CLOUD TTS =====
  const speakUrduCloud = useCallback((text: string, emotion: EmotionType, onDone?: () => void) => {
    const chunks = splitUrduChunks(text);
    let chunkIndex = 0;
    let failed = false;
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    speakQueueRef.current = true;
    const speakChunk = () => {
      if (!speakQueueRef.current || chunkIndex >= chunks.length || failed) {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        speakQueueRef.current = false;
        onDone?.();
        return;
      }
      const chunk = chunks[chunkIndex].trim();
      if (!chunk) { chunkIndex++; speakChunk(); return; }
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.lang = "ur-PK";
      utterance.rate = emotion === "happy" || emotion === "surprised" ? 1.0 : 0.85;
      utterance.pitch = emotion === "happy" ? 1.1 : emotion === "serious" ? 0.85 : 1.0;
      utterance.volume = 1.0;
      const timeout = setTimeout(() => {
        if (!failed && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          failed = true; window.speechSynthesis.cancel(); speakUrduFallback(text, emotion, onDone);
        }
      }, 3500);
      utterance.onend = () => { clearTimeout(timeout); chunkIndex++; speakChunk(); };
      utterance.onerror = () => {
        clearTimeout(timeout);
        if (!failed) { failed = true; speakUrduFallback(text, emotion, onDone); }
      };
      window.speechSynthesis.speak(utterance);
    };
    speakChunk();
  }, [speakUrduFallback]);

  // ===== SERVER-SIDE TTS =====
  const speakServerTTS = useCallback(async (text: string, lang: "ur" | "en" | "mixed", emotion: EmotionType, onDone?: () => void) => {
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    speakQueueRef.current = true;
    try {
      const chunks = (lang === "ur" || lang === "mixed") ? splitUrduChunks(text) :
        text.match(new RegExp(`.{1,300}[.!?\\n]|.{1,300}`, "g")) || [text];
      let chunkIndex = 0;
      const playChunk = async () => {
        if (!speakQueueRef.current || chunkIndex >= chunks.length) {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          speakQueueRef.current = false;
          onDone?.();
          return;
        }
        const chunk = chunks[chunkIndex].trim();
        if (!chunk) { chunkIndex++; await playChunk(); return; }
        try {
          const elevenlabsKey = localStorage.getItem("jarvis_elevenlabs_key") || "";
          const sarvamKey = localStorage.getItem("jarvis_sarvam_key") || "";
          const openaiKey = localStorage.getItem("jarvis_openai_tts_key") ||
            (localStorage.getItem("jarvis_api_keys") ?
              JSON.parse(localStorage.getItem("jarvis_api_keys") || "{}").openai : "") || "";
          const allOpenAIKeys = [openaiKey, localStorage.getItem("jarvis_openai_extra_keys") || ""]
            .join(",").split(",").map(k => k.trim()).filter(k => k.length > 0).join(",");
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: chunk.substring(0, 5000),
              lang: (lang === "ur" || lang === "mixed") ? "ur" : "en",
              emotion,
              elevenlabsKey: elevenlabsKey || undefined,
              sarvamKey: sarvamKey || undefined,
              openaiKey: allOpenAIKeys || undefined,
            }),
          });
          if (res.ok) {
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("audio") || contentType.includes("mpeg") || contentType.includes("wav")) {
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const audio = new Audio(url);
              currentAudioRef.current = audio;
              audio.onended = () => { currentAudioRef.current = null; URL.revokeObjectURL(url); chunkIndex++; playChunk(); };
              audio.onerror = () => { currentAudioRef.current = null; URL.revokeObjectURL(url); chunkIndex++; playChunk(); };
              await audio.play();
              return;
            }
          }
          chunkIndex++;
          await playChunk();
        } catch {
          if (lang === "ur" || lang === "mixed") { speakUrduCloud(text, emotion, onDone); }
          else { speakWithBrowser(text, "en", emotion, null, onDone); }
        }
      };
      await playChunk();
    } catch {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      speakQueueRef.current = false;
      if (lang === "ur" || lang === "mixed") { speakUrduCloud(text, emotion, onDone); }
      else { speakWithBrowser(text, "en", emotion, null, onDone); }
    }
  }, [speakUrduCloud, speakWithBrowser]);

  // ===== TTS — Urdu/English Smart =====
  const speakText = useCallback((text: string, emotion: EmotionType, onDone?: () => void) => {
    cancelAllSpeech();
    const cleanText = text
      .replace(/```[\s\S]*?```/g, " code block ")
      .replace(/`[^`]+`/g, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/https?:\/\/\S+/g, "link")
      .replace(/[[\]()]/g, "")
      .replace(/[#*_~]/g, "")
      .trim();
    if (!cleanText) { onDone?.(); return; }
    const lang = detectLanguage(cleanText);
    if (lang === "ur" || lang === "mixed") {
      speakServerTTS(cleanText, "ur", emotion, onDone);
    } else {
      const hasAnyTTSKey = localStorage.getItem("jarvis_elevenlabs_key") ||
        localStorage.getItem("jarvis_sarvam_key") ||
        localStorage.getItem("jarvis_openai_tts_key") ||
        (localStorage.getItem("jarvis_api_keys") ?
          JSON.parse(localStorage.getItem("jarvis_api_keys") || "{}").openai : "");
      if (hasAnyTTSKey) { speakServerTTS(cleanText, "en", emotion, onDone); }
      else {
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google") && !v.localService)
          || voices.find(v => v.lang.startsWith("en-US")) || null;
        speakWithBrowser(cleanText, "en", emotion, selectedVoice, onDone);
      }
    }
  }, [cancelAllSpeech, speakServerTTS, speakWithBrowser]);

  // ===== STT =====
  const startListening = useCallback((autoSend: boolean = false) => {
    if (isRecording) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech recognition requires Chrome browser."); return; }
    cancelAllSpeech();
    const recognition = new SpeechRecognition();
    recognition.lang = "ur-PK";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let silenceTimer: NodeJS.Timeout | null = null;
    let lastTranscript = "";
    let hasFinalResult = false;
    const convSilenceTimeout = conversationModeRef.current ? 4000 : 2500;
    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        if (lastTranscript.trim() && !hasFinalResult) {
          hasFinalResult = true;
          const finalTranscript = lastTranscript.trim();
          setIsRecording(false); setIsListening(false); setInput(finalTranscript);
          try { recognition.stop(); } catch {}
          if (autoSend || conversationModeRef.current) {
            setTimeout(() => sendMessageDirect(finalTranscript), 200);
          }
        } else if (!lastTranscript.trim() && conversationModeRef.current) {
          hasFinalResult = false;
        }
      }, convSilenceTimeout);
    };
    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscript += result[0].transcript;
        else interimTranscript += result[0].transcript;
      }
      if (finalTranscript) {
        lastTranscript = finalTranscript;
        hasFinalResult = true;
        setIsRecording(false); setIsListening(false); setInput(finalTranscript.trim());
        try { recognition.stop(); } catch {}
        if (autoSend || conversationModeRef.current) {
          setTimeout(() => sendMessageDirect(finalTranscript.trim()), 200);
        }
      } else if (interimTranscript) {
        lastTranscript = interimTranscript;
        setInput(interimTranscript);
        resetSilenceTimer();
      }
    };
    recognition.onerror = (event: any) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      setIsRecording(false); setIsListening(false);
      if (conversationModeRef.current && event.error !== "not-allowed" && event.error !== "aborted") {
        setTimeout(() => {
          if (conversationModeRef.current && !isLoadingRef.current && !isSpeakingRef.current) startListening(true);
        }, 800);
      }
    };
    recognition.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (conversationModeRef.current && !hasFinalResult && !isLoadingRef.current) {
        setTimeout(() => { if (conversationModeRef.current && !isSpeakingRef.current) startListening(true); }, 300);
        return;
      }
      setIsRecording(false); setIsListening(false);
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true); setIsListening(true);
    resetSilenceTimer();
  }, [isRecording, cancelAllSpeech]);

  // ===== SEND MESSAGE =====
  const sendMessageDirect = useCallback(async (text: string, fileData?: UploadedFile) => {
    if (!text.trim() || isLoadingRef.current) return;
    const currentKeys: APIKeys = {
      groq: apiKeys.groq || "", gemini: apiKeys.gemini || "",
      openai: apiKeys.openai || "", zai: apiKeys.zai || "",
      xai: apiKeys.xai || "", anthropic: apiKeys.anthropic || "",
    };
    if (!Object.values(currentKeys).some(k => k && k.trim().length > 0)) { setShowSettings(true); return; }
    cancelAllSpeech();
    const userMsg: JarvisMessage = {
      id: `msg_${Date.now()}`, role: "user",
      content: fileData ? `[📎 ${fileData.name}]\n${text.trim()}` : text.trim(),
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput(""); setUploadedFile(null);
    setIsLoading(true); isLoadingRef.current = true; setStreamingContent("");

    // Track conversation count
    try {
      const count = parseInt(localStorage.getItem("jarvis_conversation_count") || "0", 10);
      localStorage.setItem("jarvis_conversation_count", String(count + 1));
    } catch {}

    try {
      const isTask = /^(do|task|run|execute|search|find|analyze|write|create|build|scrape|fetch|download)/i.test(text.trim());
      const taskId = isTask ? `task_${Date.now()}` : null;
      if (taskId) setBgTasks(prev => [...prev, { id: taskId, description: text.trim(), status: "running" }]);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(), userId, history: messagesRef.current.slice(-20),
          stream: true, apiKeys: currentKeys, activeProvider,
          file: fileData ? { name: fileData.name, type: fileData.type, dataUrl: fileData.dataUrl } : null,
        }),
      });
      if (!response.ok) throw new Error("API error");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let fullContent = "";
      let emotion: EmotionType = "normal";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "meta") { emotion = data.emotion || "normal"; setCurrentEmotion(emotion); }
              else if (data.type === "content") { fullContent += data.content; setStreamingContent(fullContent); }
              else if (data.type === "done") {
                const assistantMsg: JarvisMessage = {
                  id: `msg_${Date.now()}`, role: "assistant", content: fullContent, emotion, timestamp: Date.now(),
                };
                setMessages(prev => [...prev, assistantMsg]);
                setStreamingContent("");
                if (taskId) {
                  setBgTasks(prev => prev.map(t =>
                    t.id === taskId ? { ...t, status: "completed" as const, result: fullContent.substring(0, 100) } : t
                  ));
                }
                speakText(fullContent, emotion, () => {
                  if (conversationModeRef.current) {
                    setTimeout(() => {
                      if (conversationModeRef.current && !isSpeakingRef.current) startListening(true);
                    }, 400);
                  }
                });
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch {
      const errorMsg: JarvisMessage = {
        id: `msg_${Date.now()}`, role: "assistant",
        content: "معذرت، کنکشن میں مسئلہ ہے۔ دوبارہ کوشش کریں۔",
        emotion: "sympathetic", timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
      if (conversationModeRef.current) {
        setTimeout(() => { if (conversationModeRef.current) startListening(true); }, 1000);
      }
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [userId, apiKeys, activeProvider, speakText, startListening, cancelAllSpeech]);

  const sendMessage = useCallback((text: string) => sendMessageDirect(text, uploadedFile || undefined), [sendMessageDirect, uploadedFile]);

  const toggleConversationMode = useCallback(() => {
    const newMode = !conversationMode;
    setConversationMode(newMode);
    conversationModeRef.current = newMode;
    if (newMode) { cancelAllSpeech(); setTimeout(() => startListening(true), 300); }
    else {
      cancelAllSpeech();
      recognitionRef.current?.stop();
      setIsRecording(false); setIsListening(false);
    }
  }, [conversationMode, startListening, cancelAllSpeech]);

  const toggleRecording = useCallback(() => {
    if (conversationMode) return;
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); setIsListening(false); }
    else { startListening(true); }
  }, [isRecording, conversationMode, startListening]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("File must be under 5MB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedFile({ name: file.name, type: file.type, size: file.size, dataUrl: ev.target?.result as string });
      inputRef.current?.focus();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const emotionEmojis: Record<EmotionType, string> = {
    happy: "😊", encouraging: "💪", serious: "⚡", sympathetic: "💙", surprised: "😲", normal: "🙂",
  };

  const providerLabels: Record<LLMProvider, string> = {
    groq: "Groq", gemini: "Gemini", openai: "OpenAI", zai: "ZAI", xai: "xAI", anthropic: "Claude",
  };

  // Input wrapper glow class
  const inputGlowClass = isRecording ? "glow-green" : isSpeaking ? "glow-purple" : "";

  // Wave animation bars for JARVIS speaking
  const waveBars = Array.from({ length: 20 }, (_, i) => (
    <div
      key={i}
      className="wave-bar"
      style={{
        animationDelay: `${i * 0.06}s`,
        animationDuration: `${0.8 + Math.random() * 0.6}s`,
      }}
    />
  ));

  // Recording ripple rings
  const rippleRings = Array.from({ length: 3 }, (_, i) => (
    <div key={i} className="ripple-ring" style={{ animationDelay: `${i * 0.5}s` }} />
  ));

  return (
    <div className="chat-container">
      {/* Header */}
      <header className="chat-header">
        <div className="header-brand">
          <div className="brand-icon">🧠</div>
          <div>
            <div className="brand-title">JARVIS Chat</div>
            <div className="brand-status">
              <span className={`status-dot ${connectionStatus === "online" ? "status-online" : "status-offline"}`}></span>
              <span>
                {connectionStatus === "online" ? providerLabels[activeProvider] :
                 connectionStatus === "nokey" ? "Add API Key" : "Offline"}
                {" · "}{emotionEmojis[currentEmotion]}
                {conversationMode && " · 🎙️ Live"}
              </span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn-icon" onClick={cancelAllSpeech} title="Mute">🔇</button>
          <button className="btn-icon" onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
        </div>
      </header>

      {/* Conversation Banner */}
      {conversationMode && (
        <div className="conv-banner">
          <div className={`conv-orb ${isSpeaking ? "speaking" : isListening ? "listening" : ""}`}>
            <div className="conv-orb-ring"></div>
            <div className="conv-orb-icon">
              {isSpeaking ? "🔊" : isListening ? "🎤" : "⏳"}
            </div>
          </div>
          <div>
            <div className="conv-info-title">
              {isSpeaking ? "جاروس بول رہا ہے..." : isListening ? "سن رہا ہوں... بولیے!" : "🎙️ وائس چیٹ آن"}
            </div>
            <div className="conv-info-sub">
              {isSpeaking ? "جواب سنیے، پھر آپ کی باری" : isListening ? "اب بولیے — آٹو سینڈ" : "بولیے، سنے گا اور انسان کی طرح جواب دے گا"}
            </div>
          </div>
        </div>
      )}

      {/* Background Tasks */}
      {bgTasks.filter(t => t.status === "running").length > 0 && (
        <div className="task-banner">
          <div className="task-banner-info">
            <div className="task-spinner"></div>
            <span>{bgTasks.filter(t => t.status === "running").length} task(s) running...</span>
          </div>
          <button className="task-banner-close" onClick={() => setBgTasks([])}>✕</button>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && !streamingContent ? (
          <div className="welcome-screen">
            <div className="welcome-logo">🧠</div>
            <h1 className="welcome-title">JARVIS</h1>
            <p className="welcome-subtitle">
              ریان سر کا ذاتی ساتھی — جobs تلاش، کلائنٹس سے بات، فری لانسنگ سب کچھ!
            </p>
            {!hasAnyKey ? (
              <div className="welcome-alert welcome-alert-warning">
                <p style={{ fontWeight: 600 }}>⚠️ API Key ضروری ہے!</p>
                <p style={{ fontSize: "13px", opacity: 0.85 }}>Settings میں جا کر کم از کم ایک API Key ڈالیں</p>
                <button className="welcome-alert-btn" onClick={() => setShowSettings(true)}>⚙️ Settings کھولیں</button>
              </div>
            ) : (
              <div className="welcome-alert welcome-alert-success">
                <p style={{ fontWeight: 600 }}>🎙️ نیچرل وائس چیٹ تیار ہے!</p>
                <p style={{ fontSize: "13px", opacity: 0.85 }}>نیچے 🎧 دباؤ — بولو، جاروس سنے گا، انسان کی طرح جواب دے گا!</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role === "user" ? "message-user" : "message-assistant"}`}>
                {msg.role === "assistant" && <div className="avatar">{emotionEmojis[msg.emotion || "normal"]}</div>}
                <div className="message-bubble">
                  <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }} />
                  {msg.emotion && msg.emotion !== "normal" && msg.role === "assistant" && (
                    <span className={`emotion-badge emotion-${msg.emotion}`}>{msg.emotion}</span>
                  )}
                </div>
              </div>
            ))}
            {streamingContent && (
              <div className="message message-assistant">
                <div className="avatar">{emotionEmojis[currentEmotion]}</div>
                <div className="message-bubble">
                  <div dangerouslySetInnerHTML={{ __html: formatMessage(streamingContent) }} />
                </div>
              </div>
            )}
            {isLoading && !streamingContent && (
              <div className="message message-assistant">
                <div className="avatar">🤖</div>
                <div className="message-bubble">
                  <div className="typing-indicator"><span></span><span></span><span></span></div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Wave Animation when JARVIS is speaking */}
      {isSpeaking && (
        <div className="wave-container">
          {waveBars}
        </div>
      )}

      {/* Input Area */}
      <div className="chat-input-area">
        {uploadedFile && (
          <div className="file-preview">
            <span>{uploadedFile.type.startsWith("image/") ? "🖼️" : "📄"}</span>
            <span>{uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)}KB)</span>
            <button className="file-preview-remove" onClick={() => setUploadedFile(null)}>✕</button>
          </div>
        )}

        <div className={`chat-input-wrapper ${inputGlowClass}`}>
          <button className="btn-icon" onClick={() => fileInputRef.current?.click()} title="Upload file">📎</button>
          <input ref={fileInputRef} type="file" hidden
            accept="image/*,.pdf,.txt,.csv,.json,.md,.py,.js,.ts,.html,.css"
            onChange={handleFileUpload} />

          {/* Conversation Mode Button */}
          <button
            className={`btn-icon ${conversationMode ? "btn-conversation-active" : ""}`}
            onClick={toggleConversationMode}
            title={conversationMode ? "🎙️ Stop Voice Chat" : "🎧 Start Voice Chat"}
            disabled={!hasAnyKey}
          >
            {conversationMode ? "🎙️" : "🎧"}
          </button>

          {/* Mic button with ripple effect */}
          <div className="ripple-container" style={{ position: "relative" }}>
            {isRecording && rippleRings}
            <button
              className={`btn-icon btn-voice ${isRecording ? "recording" : ""}`}
              onClick={toggleRecording}
              title={isRecording ? "Stop" : "🎤 Voice input (auto-sends)"}
              disabled={conversationMode}
            >
              {isRecording ? "⏹️" : "🎤"}
            </button>
          </div>

          <textarea ref={inputRef} className="chat-input" value={input}
            onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={hasAnyKey ? "Type your message... / اپنا پیغام لکھیں" : "⚠️ Add API Key in Settings"}
            rows={1} style={{ minHeight: "24px" }} />

          <button className="btn-icon btn-send" onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading || !hasAnyKey} title="Send">➤</button>
        </div>

        <div className="input-footer">
          <span>
            {hasAnyKey ? providerLabels[activeProvider] : "⚠️ No Key"}
            {conversationMode ? " · 🎙️ Voice Chat ON" : " · 🎧 = voice chat"}
            {isRecording && " · 🟢 Recording..."}
            {isSpeaking && " · 🟣 Speaking..."}
          </span>
          <span>Enter to send</span>
        </div>
      </div>

      {/* Quick Settings Popup */}
      {showSettings && (
        <ChatSettingsPanel
          apiKeys={apiKeys}
          activeProvider={activeProvider}
          onSaveKeys={saveApiKeys}
          onSaveProvider={saveActiveProvider}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

// ============== CHAT SETTINGS PANEL ==============
function ChatSettingsPanel({
  apiKeys, activeProvider, onSaveKeys, onSaveProvider, onClose,
}: {
  apiKeys: APIKeys;
  activeProvider: LLMProvider;
  onSaveKeys: (keys: APIKeys) => void;
  onSaveProvider: (provider: LLMProvider) => void;
  onClose: () => void;
}) {
  const [localKeys, setLocalKeys] = useState<APIKeys>({ ...apiKeys });
  const [localProvider, setLocalProvider] = useState<LLMProvider>(activeProvider);
  const [elevenlabsKey, setElevenlabsKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("jarvis_elevenlabs_key") || "";
  });
  const [sarvamKey, setSarvamKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("jarvis_sarvam_key") || "";
  });

  const providers: Array<{ id: LLMProvider; name: string; keyPlaceholder: string; getKeyUrl: string }> = [
    { id: "groq", name: "Groq (Llama 3.3 70B)", keyPlaceholder: "gsk_...", getKeyUrl: "https://console.groq.com" },
    { id: "gemini", name: "Google Gemini 1.5 Flash", keyPlaceholder: "AIza...", getKeyUrl: "https://aistudio.google.com/apikey" },
    { id: "openai", name: "OpenAI (GPT-4o Mini)", keyPlaceholder: "sk-...", getKeyUrl: "https://platform.openai.com/api-keys" },
    { id: "zai", name: "ZAI (GLM-4 Flash)", keyPlaceholder: "your-zai-api-key", getKeyUrl: "https://open.bigmodel.cn" },
    { id: "xai", name: "xAI / Grok", keyPlaceholder: "xai-...", getKeyUrl: "https://console.x.ai" },
    { id: "anthropic", name: "Anthropic / Claude", keyPlaceholder: "sk-ant-...", getKeyUrl: "https://console.anthropic.com" },
  ];

  const handleSave = () => {
    onSaveKeys(localKeys);
    onSaveProvider(localProvider);
    localStorage.setItem("jarvis_elevenlabs_key", elevenlabsKey);
    localStorage.setItem("jarvis_sarvam_key", sarvamKey);
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <h2>⚙️ API Settings</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
          کم از کم ایک API Key ڈالیں۔ comma (,) سے الگ کریں — لیمٹ ختم ہو تو اگلی key خودکار چلے گی!
        </p>
        <label style={{ fontWeight: 600, marginBottom: "8px", display: "block" }}>🎯 Active Provider</label>
        <select
          value={localProvider}
          onChange={(e) => setLocalProvider(e.target.value as LLMProvider)}
          className="form-select"
          style={{ marginBottom: 16 }}
        >
          {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {providers.map((p) => (
          <div key={p.id} className="provider-card">
            <div className="provider-header">
              <span className="provider-name">{p.name}</span>
              {localKeys[p.id] && localKeys[p.id]!.trim() && <span className="provider-saved">✓ Saved</span>}
            </div>
            <input
              className="provider-input"
              type="password"
              placeholder={p.keyPlaceholder}
              value={localKeys[p.id] || ""}
              onChange={(e) => setLocalKeys({ ...localKeys, [p.id]: e.target.value })}
            />
            <a className="provider-link" href={p.getKeyUrl} target="_blank" rel="noopener noreferrer">
              Get {p.name} API Key →
            </a>
          </div>
        ))}

        <div className="provider-card" style={{ marginTop: 8 }}>
          <div className="provider-header">
            <span className="provider-name">🔊 ElevenLabs TTS</span>
            {elevenlabsKey.trim() && <span className="provider-saved">✓</span>}
          </div>
          <input className="provider-input" type="password" placeholder="ElevenLabs API Key"
            value={elevenlabsKey} onChange={(e) => setElevenlabsKey(e.target.value)} />
        </div>

        <div className="provider-card">
          <div className="provider-header">
            <span className="provider-name">🔊 Sarvam AI TTS</span>
            {sarvamKey.trim() && <span className="provider-saved">✓</span>}
          </div>
          <input className="provider-input" type="password" placeholder="Sarvam AI API Key"
            value={sarvamKey} onChange={(e) => setSarvamKey(e.target.value)} />
        </div>

        <div className="settings-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleSave}>💾 Save</button>
        </div>
      </div>
    </div>
  );
}

// ============== RECORDING SECTION ==============
function RecordingSection({ apiKeys }: { apiKeys: APIKeys }) {
  const [recordText, setRecordText] = useState("");
  const [recordSpeed, setRecordSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const [recordLang, setRecordLang] = useState<"ur" | "en">("ur");
  const [isRecording, setIsRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speedLabels = {
    slow: "آہستہ (Slow)",
    normal: "نارمل (Normal)",
    fast: "تیز (Fast)",
  };

  const handleRecord = useCallback(async () => {
    if (!recordText.trim() || isRecording) return;
    setIsRecording(true);
    setRecordProgress(10);
    setAudioUrl(null);

    try {
      const openaiKey = apiKeys.openai || localStorage.getItem("jarvis_openai_tts_key") || "";
      const res = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: recordText,
          lang: recordLang,
          speed: recordSpeed,
          apiKey: openaiKey || undefined,
        }),
      });

      setRecordProgress(70);

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("audio") || contentType.includes("mpeg")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setRecordProgress(100);
      } else {
        // Browser TTS fallback
        const data = await res.json();
        if (data.useBrowserTTS && typeof window !== "undefined" && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(recordText);
          utterance.lang = recordLang === "ur" ? "ur-PK" : "en-US";
          utterance.rate = data.rate || 0.88;
          utterance.pitch = data.pitch || 1.0;
          utterance.onend = () => { setIsRecording(false); setRecordProgress(100); };
          utterance.onerror = () => { setIsRecording(false); };
          window.speechSynthesis.speak(utterance);
          setRecordProgress(80);
          return;
        }
        setRecordProgress(100);
      }
    } catch {
      // Fallback to browser TTS
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const speedMap = { slow: 0.65, normal: 0.88, fast: 1.3 };
        const pitchMap = { slow: 0.9, normal: 1.0, fast: 1.05 };
        const utterance = new SpeechSynthesisUtterance(recordText);
        utterance.lang = recordLang === "ur" ? "ur-PK" : "en-US";
        utterance.rate = speedMap[recordSpeed];
        utterance.pitch = pitchMap[recordSpeed];
        utterance.onend = () => { setIsRecording(false); setRecordProgress(100); };
        window.speechSynthesis.speak(utterance);
      }
    } finally {
      setTimeout(() => setIsRecording(false), 500);
    }
  }, [recordText, recordLang, recordSpeed, apiKeys, isRecording]);

  const handlePreview = useCallback(() => {
    if (!audioUrl) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  }, [audioUrl]);

  const handleDownload = useCallback(() => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `jarvis-recording-${Date.now()}.mp3`;
    a.click();
  }, [audioUrl]);

  // Wave bars for recording visualization
  const recWaveBars = Array.from({ length: 30 }, (_, i) => (
    <div
      key={i}
      className="rec-wave-bar"
      style={{
        animationDelay: `${i * 0.05}s`,
        animationDuration: `${0.6 + Math.random() * 0.8}s`,
      }}
    />
  ));

  return (
    <div className="recording-section">
      <div className="recording-header">
        <div className="recording-title">🎙️ Recording Studio</div>
        <div className="recording-subtitle">Text-to-Speech recording with speed control — اپنی آواز ریکارڈ کریں</div>
      </div>

      {/* Text input */}
      <textarea
        className="recording-textarea"
        value={recordText}
        onChange={(e) => setRecordText(e.target.value)}
        placeholder="یہاں متن لکھیں یا پیسٹ کریں...&#10;Type or paste your content here for recording..."
        dir="auto"
      />

      {/* Voice selection */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Voice:</span>
        <div className="voice-toggle">
          <button
            className={`voice-toggle-btn ${recordLang === "ur" ? "active" : ""}`}
            onClick={() => setRecordLang("ur")}
          >
            🇵🇰 Urdu
          </button>
          <button
            className={`voice-toggle-btn ${recordLang === "en" ? "active" : ""}`}
            onClick={() => setRecordLang("en")}
          >
            🇺🇸 English
          </button>
        </div>
      </div>

      {/* Speed control */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>Speed:</span>
        <div className="recording-controls">
          {(["slow", "normal", "fast"] as const).map((speed) => (
            <button
              key={speed}
              className={`speed-btn ${recordSpeed === speed ? "active" : ""}`}
              onClick={() => setRecordSpeed(speed)}
            >
              {speedLabels[speed]}
            </button>
          ))}
        </div>
      </div>

      {/* Recording wave */}
      {isRecording && (
        <div className="rec-wave-container">
          {recWaveBars}
        </div>
      )}

      {/* Progress */}
      {isRecording && (
        <div className="recording-progress">
          <div className="recording-progress-bar" style={{ width: `${recordProgress}%` }}></div>
        </div>
      )}

      {/* Action buttons */}
      <div className="recording-actions">
        <button className="rec-btn primary" onClick={handleRecord} disabled={!recordText.trim() || isRecording}>
          {isRecording ? "⏳ Recording..." : "🎙️ Record"}
        </button>
        <button className="rec-btn" onClick={handlePreview} disabled={!audioUrl || isPlaying}>
          ▶️ Preview
        </button>
        <button className="rec-btn" onClick={handleDownload} disabled={!audioUrl}>
          💾 Download
        </button>
        {isPlaying && (
          <button className="rec-btn danger" onClick={() => { audioRef.current?.pause(); setIsPlaying(false); }}>
            ⏹️ Stop
          </button>
        )}
      </div>
    </div>
  );
}

// ============== SETTINGS SECTION ==============
function SettingsSection({
  apiKeys, activeProvider, hasAnyKey, saveApiKeys, saveActiveProvider,
}: {
  apiKeys: APIKeys;
  activeProvider: LLMProvider;
  hasAnyKey: boolean;
  saveApiKeys: (keys: APIKeys) => void;
  saveActiveProvider: (provider: LLMProvider) => void;
}) {
  const [localKeys, setLocalKeys] = useState<APIKeys>({ ...apiKeys });
  const [localProvider, setLocalProvider] = useState<LLMProvider>(activeProvider);
  const [elevenlabsKey, setElevenlabsKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("jarvis_elevenlabs_key") || "";
  });
  const [sarvamKey, setSarvamKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("jarvis_sarvam_key") || "";
  });
  const [openaiTTSKey, setOpenaiTTSKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("jarvis_openai_tts_key") || "";
  });

  // Auto-update settings
  const [githubRepo, setGithubRepo] = useState(() => localStorage.getItem("jarvis_github_repo") || "");
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem("jarvis_github_token") || "");
  const [autoUpdate, setAutoUpdate] = useState(() => localStorage.getItem("jarvis_auto_update") === "true");
  const [updateStatus, setUpdateStatus] = useState<string>("up-to-date");
  const [currentVersion] = useState("2.0.0");

  // Preferences
  const [defaultLang, setDefaultLang] = useState(() => localStorage.getItem("jarvis_default_lang") || "mixed");
  const [personality, setPersonality] = useState(() => localStorage.getItem("jarvis_personality") || "friendly");
  const [voiceSpeed, setVoiceSpeed] = useState(() => {
    const v = localStorage.getItem("jarvis_voice_speed");
    return v ? parseFloat(v) : 0.88;
  });

  const checkForUpdates = async () => {
    setUpdateStatus("checking");
    try {
      const res = await fetch(`/api/update?repo=${encodeURIComponent(githubRepo)}&token=${encodeURIComponent(githubToken)}`);
      const data = await res.json();
      setUpdateStatus(data.hasUpdate ? "update-available" : "up-to-date");
    } catch {
      setUpdateStatus("error");
    }
  };

  const handleSave = () => {
    saveApiKeys(localKeys);
    saveActiveProvider(localProvider);
    localStorage.setItem("jarvis_elevenlabs_key", elevenlabsKey);
    localStorage.setItem("jarvis_sarvam_key", sarvamKey);
    localStorage.setItem("jarvis_openai_tts_key", openaiTTSKey);
    localStorage.setItem("jarvis_github_repo", githubRepo);
    localStorage.setItem("jarvis_github_token", githubToken);
    localStorage.setItem("jarvis_auto_update", String(autoUpdate));
    localStorage.setItem("jarvis_default_lang", defaultLang);
    localStorage.setItem("jarvis_personality", personality);
    localStorage.setItem("jarvis_voice_speed", String(voiceSpeed));
  };

  const llmProviders: Array<{ id: LLMProvider; name: string; keyPlaceholder: string; getKeyUrl: string }> = [
    { id: "groq", name: "Groq (Llama 3.3 70B)", keyPlaceholder: "gsk_...", getKeyUrl: "https://console.groq.com" },
    { id: "gemini", name: "Google Gemini 1.5 Flash", keyPlaceholder: "AIza...", getKeyUrl: "https://aistudio.google.com/apikey" },
    { id: "openai", name: "OpenAI (GPT-4o Mini)", keyPlaceholder: "sk-...", getKeyUrl: "https://platform.openai.com/api-keys" },
    { id: "zai", name: "ZAI (GLM-4 Flash)", keyPlaceholder: "your-zai-api-key", getKeyUrl: "https://open.bigmodel.cn" },
    { id: "xai", name: "xAI / Grok", keyPlaceholder: "xai-...", getKeyUrl: "https://console.x.ai" },
    { id: "anthropic", name: "Anthropic / Claude", keyPlaceholder: "sk-ant-...", getKeyUrl: "https://console.anthropic.com" },
  ];

  const ttsProviders = [
    { name: "ElevenLabs API Key", value: elevenlabsKey, setValue: setElevenlabsKey, placeholder: "ElevenLabs key..." },
    { name: "Sarvam AI API Key", value: sarvamKey, setValue: setSarvamKey, placeholder: "Sarvam key..." },
    { name: "OpenAI TTS Key (extra)", value: openaiTTSKey, setValue: setOpenaiTTSKey, placeholder: "sk-..." },
  ];

  return (
    <div className="settings-section">
      <div className="settings-title">⚙️ Settings</div>

      {/* A. LLM API Keys */}
      <div className="settings-category">
        <div className="settings-category-title">🔑 A. LLM API Keys</div>
        <label style={{ fontWeight: 600, marginBottom: "8px", display: "block", fontSize: 13 }}>🎯 Active Provider</label>
        <select
          value={localProvider}
          onChange={(e) => setLocalProvider(e.target.value as LLMProvider)}
          className="form-select"
          style={{ marginBottom: 12 }}
        >
          {llmProviders.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {llmProviders.map((p) => (
          <div key={p.id} className="provider-card">
            <div className="provider-header">
              <span className="provider-name">{p.name}</span>
              {localKeys[p.id] && localKeys[p.id]!.trim() && <span className="provider-saved">✓ Saved</span>}
            </div>
            <input className="provider-input" type="password" placeholder={p.keyPlaceholder}
              value={localKeys[p.id] || ""}
              onChange={(e) => setLocalKeys({ ...localKeys, [p.id]: e.target.value })} />
            <a className="provider-link" href={p.getKeyUrl} target="_blank" rel="noopener noreferrer">
              Get API Key →
            </a>
          </div>
        ))}
      </div>

      {/* B. TTS Keys */}
      <div className="settings-category">
        <div className="settings-category-title">🔊 B. TTS Keys</div>
        {ttsProviders.map((p) => (
          <div key={p.name} className="provider-card">
            <div className="provider-header">
              <span className="provider-name">{p.name}</span>
              {p.value.trim() && <span className="provider-saved">✓</span>}
            </div>
            <input className="provider-input" type="password" placeholder={p.placeholder}
              value={p.value} onChange={(e) => p.setValue(e.target.value)} />
          </div>
        ))}
      </div>

      {/* C. Auto-Update Settings */}
      <div className="settings-category">
        <div className="settings-category-title">🔄 C. Auto-Update Settings</div>
        <div className="update-card">
          <div className="provider-card">
            <span className="provider-name">GitHub Repository</span>
            <input className="provider-input" type="text" placeholder="username/JARVIS-HYBRID"
              value={githubRepo} onChange={(e) => setGithubRepo(e.target.value)} />
          </div>
          <div className="provider-card">
            <span className="provider-name">GitHub Personal Access Token</span>
            <input className="provider-input" type="password" placeholder="ghp_..."
              value={githubToken} onChange={(e) => setGithubToken(e.target.value)} />
          </div>
          <div className="toggle-row">
            <span className="toggle-label">Auto-Update</span>
            <div className={`toggle-switch ${autoUpdate ? "on" : ""}`}
              onClick={() => setAutoUpdate(!autoUpdate)} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <button className="quick-btn" onClick={checkForUpdates}>🔄 Check for Updates</button>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Current: v{currentVersion} · {updateStatus === "up-to-date" ? "✓ Up to date" :
                updateStatus === "update-available" ? "⚠️ Update available" :
                updateStatus === "error" ? "✗ Check failed" : "⏳ Checking..."}
            </span>
          </div>
        </div>
      </div>

      {/* D. Preferences */}
      <div className="settings-category">
        <div className="settings-category-title">🎨 D. Preferences</div>
        <div className="provider-card">
          <span className="provider-name">Default Language</span>
          <select className="form-select" value={defaultLang} onChange={(e) => setDefaultLang(e.target.value)}>
            <option value="ur">Urdu / اردو</option>
            <option value="en">English</option>
            <option value="mixed">Mixed / مکس</option>
          </select>
        </div>
        <div className="provider-card">
          <span className="provider-name">Personality</span>
          <select className="form-select" value={personality} onChange={(e) => setPersonality(e.target.value)}>
            <option value="friendly">Friendly / دوستانہ</option>
            <option value="professional">Professional / پیشہ ور</option>
            <option value="casual">Casual / آسان</option>
          </select>
        </div>
        <div className="provider-card">
          <span className="provider-name">Voice Speed: {voiceSpeed.toFixed(2)}x</span>
          <input type="range" className="pref-slider" min="0.5" max="2" step="0.05"
            value={voiceSpeed} onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)" }}>
            <span>Slow</span><span>Normal</span><span>Fast</span>
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <button className="btn-cancel" onClick={() => {
          setLocalKeys({ ...apiKeys });
          setLocalProvider(activeProvider);
        }}>Reset</button>
        <button className="btn-save" onClick={handleSave}>💾 Save All Settings</button>
      </div>
    </div>
  );
}

// ============== RESEARCH SECTION ==============
function ResearchSection({ apiKeys }: { apiKeys: APIKeys }) {
  const [entries, setEntries] = useState<ResearchEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<ResearchCategory | "all">("all");
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [askAiQuery, setAskAiQuery] = useState("");
  const [isAskingAi, setIsAskingAi] = useState(false);
  const [aiResults, setAiResults] = useState<Array<{ source: string; response: string }>>([]);

  // New entry form state
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<ResearchCategory>("general");
  const [newSource, setNewSource] = useState<ResearchSource>("Self");

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("jarvis_research_entries");
      if (saved) setEntries(JSON.parse(saved));
    } catch {}
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("jarvis_research_entries", JSON.stringify(entries));
  }, [entries]);

  const addEntry = (entry: Omit<ResearchEntry, "id" | "date">) => {
    const newEntry: ResearchEntry = {
      ...entry,
      id: `res_${Date.now()}`,
      date: Date.now(),
    };
    setEntries(prev => [newEntry, ...prev]);
  };

  const deleteEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const handleNewEntry = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    addEntry({ title: newTitle, content: newContent, category: newCategory, source: newSource });
    setNewTitle(""); setNewContent(""); setShowNewEntry(false);
  };

  const handleAskAi = async () => {
    if (!askAiQuery.trim() || isAskingAi) return;
    setIsAskingAi(true);
    setAiResults([]);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: askAiQuery, apiKeys }),
      });
      const data = await res.json();
      if (data.results) {
        setAiResults(data.results.filter((r: any) => r.response));
        // Auto-add as research entry
        if (data.results.length > 0) {
          const combinedResponse = data.results
            .filter((r: any) => r.response)
            .map((r: any) => `**${r.source}:** ${r.response}`)
            .join("\n\n---\n\n");
          addEntry({
            title: askAiQuery.substring(0, 100),
            content: combinedResponse.substring(0, 5000),
            category: "general",
            source: "Self",
          });
        }
      }
    } catch {
      setAiResults([{ source: "Error", response: "Failed to query AI providers. Check your API keys." }]);
    } finally {
      setIsAskingAi(false);
    }
  };

  const filteredEntries = entries
    .filter(e => filterCategory === "all" || e.category === filterCategory)
    .filter(e => !searchQuery || e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.content.toLowerCase().includes(searchQuery.toLowerCase()));

  const categoryLabels: Record<string, string> = {
    all: "🔍 All",
    earning: "💰 Earning",
    "self-improvement": "📈 Self-Improvement",
    technical: "⚙️ Technical",
    general: "📋 General",
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="research-section">
      <div className="research-header">
        <div>
          <div className="research-title">📚 Research Log</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Knowledge base & multi-AI research — تحقیق اور علم کا ذخیرہ
          </div>
        </div>
        <button className="quick-btn" onClick={() => setShowNewEntry(true)}>➕ New Research</button>
      </div>

      {/* Search */}
      <div className="research-search">
        <input
          className="research-search-input"
          placeholder="Search research entries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Category filters */}
      <div className="research-filters">
        {(["all", "earning", "self-improvement", "technical", "general"] as const).map((cat) => (
          <button
            key={cat}
            className={`filter-btn ${filterCategory === cat ? "active" : ""}`}
            onClick={() => setFilterCategory(cat)}
          >
            {categoryLabels[cat]}
          </button>
        ))}
      </div>

      {/* Ask AI */}
      <div style={{ background: "var(--bg-glass)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>🤖 Ask Multiple AIs</div>
        <div className="ask-ai-form">
          <input
            className="ask-ai-input"
            placeholder="Ask anything — multiple AI sources will research it..."
            value={askAiQuery}
            onChange={(e) => setAskAiQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAskAi()}
          />
          <button className="ask-ai-btn" onClick={handleAskAi} disabled={isAskingAi || !askAiQuery.trim()}>
            {isAskingAi ? "⏳ Researching..." : "🔍 Ask AI"}
          </button>
        </div>
        {aiResults.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {aiResults.map((r, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: "var(--accent-tertiary)", marginBottom: 4 }}>
                  {r.source}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, maxHeight: 150, overflow: "auto" }}
                  dangerouslySetInnerHTML={{ __html: formatMessage(r.response) }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Entries list */}
      <div className="research-list">
        {filteredEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <div className="empty-state-text">No research entries yet</div>
            <div className="empty-state-sub">Add your first research entry or ask AI to research something</div>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div key={entry.id} className="research-entry">
              <div className="research-entry-header">
                <div className="research-entry-title">{entry.title}</div>
                <div className="research-entry-meta">
                  <span className="research-entry-source">{entry.source}</span>
                  <span className="research-entry-date">{formatDate(entry.date)}</span>
                </div>
              </div>
              <div className="research-entry-content"
                dangerouslySetInnerHTML={{ __html: formatMessage(entry.content.substring(0, 500)) }} />
              <div className="research-entry-actions">
                <button className="research-entry-btn">{categoryLabels[entry.category] || entry.category}</button>
                <button className="research-entry-btn danger" onClick={() => deleteEntry(entry.id)}>🗑️ Delete</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Entry Modal */}
      {showNewEntry && (
        <div className="modal-overlay" onClick={() => setShowNewEntry(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">📝 New Research Entry</div>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" placeholder="Research title..."
                value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Content</label>
              <textarea className="form-textarea" placeholder="Research content..."
                value={newContent} onChange={(e) => setNewContent(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={newCategory} onChange={(e) => setNewCategory(e.target.value as ResearchCategory)}>
                <option value="earning">💰 Earning Methods</option>
                <option value="self-improvement">📈 Self-Improvement</option>
                <option value="technical">⚙️ Technical</option>
                <option value="general">📋 General</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Source</label>
              <select className="form-select" value={newSource} onChange={(e) => setNewSource(e.target.value as ResearchSource)}>
                <option value="Self">Self</option>
                <option value="ChatGPT">ChatGPT</option>
                <option value="xAI">xAI</option>
                <option value="Claude">Claude</option>
                <option value="Grok">Grok</option>
                <option value="Gemini">Gemini</option>
              </select>
            </div>
            <div className="settings-actions">
              <button className="btn-cancel" onClick={() => setShowNewEntry(false)}>Cancel</button>
              <button className="btn-save" onClick={handleNewEntry}>💾 Add Entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
