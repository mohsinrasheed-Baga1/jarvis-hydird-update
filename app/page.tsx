"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { EmotionType, JarvisMessage, APIKeys, LLMProvider } from "@/lib/protocol";

// ============== MAIN CHAT PAGE ==============

export default function ChatPage() {
  // Load API keys from localStorage
  const loadApiKeys = (): APIKeys => {
    if (typeof window === "undefined") return {};
    try {
      const saved = localStorage.getItem("jarvis_api_keys");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const loadActiveProvider = (): LLMProvider => {
    if (typeof window === "undefined") return "groq";
    return (localStorage.getItem("jarvis_active_provider") as LLMProvider) || "groq";
  };

  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"online" | "offline" | "nokey">("online");
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>("normal");
  const [streamingContent, setStreamingContent] = useState("");
  const [apiKeys, setApiKeys] = useState<APIKeys>(loadApiKeys);
  const [activeProvider, setActiveProvider] = useState<LLMProvider>(loadActiveProvider);
  const [userId] = useState(() => `user_${Date.now()}`);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Save API keys to localStorage
  const saveApiKeys = useCallback((keys: APIKeys) => {
    setApiKeys(keys);
    localStorage.setItem("jarvis_api_keys", JSON.stringify(keys));
  }, []);

  const saveActiveProvider = useCallback((provider: LLMProvider) => {
    setActiveProvider(provider);
    localStorage.setItem("jarvis_active_provider", provider);
  }, []);

  // Check if any key is configured
  const hasAnyKey = Object.values(apiKeys).some((k) => k && k.trim().length > 0);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Check health + key status on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        if (hasAnyKey) {
          setConnectionStatus("online");
        } else {
          setConnectionStatus("nokey");
        }
      } catch {
        setConnectionStatus("offline");
      }
    };
    checkHealth();
  }, [hasAnyKey]);

  // Show settings on first visit if no keys
  useEffect(() => {
    if (!hasAnyKey) {
      setShowSettings(true);
    }
  }, []);

  // Send message
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    if (!hasAnyKey) {
      setShowSettings(true);
      return;
    }

    const userMsg: JarvisMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          userId,
          history: messages.slice(-20),
          stream: true,
          apiKeys,
          activeProvider,
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
              if (data.type === "meta") {
                emotion = data.emotion || "normal";
                setCurrentEmotion(emotion);
              } else if (data.type === "content") {
                fullContent += data.content;
                setStreamingContent(fullContent);
              } else if (data.type === "done") {
                const assistantMsg: JarvisMessage = {
                  id: `msg_${Date.now()}`,
                  role: "assistant",
                  content: fullContent,
                  emotion,
                  timestamp: Date.now(),
                };
                setMessages((prev) => [...prev, assistantMsg]);
                setStreamingContent("");
                speakText(fullContent, emotion);
              }
            } catch {
              // Skip malformed data
            }
          }
        }
      }
    } catch (error) {
      const errorMsg: JarvisMessage = {
        id: `msg_${Date.now()}`,
        role: "assistant",
        content: "معذرت، کنکشن میں مسئلہ ہے۔ دوبارہ کوشش کریں۔",
        emotion: "sympathetic",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, userId, apiKeys, activeProvider, hasAnyKey]);

  // TTS
  const speakText = (text: string, emotion: EmotionType) => {
    if (!window.speechSynthesis) return;
    const cleanText = text
      .replace(/\*\*[^*]+\*\*/g, "")
      .replace(/```[\s\S]*?```/g, " code block ")
      .replace(/`[^`]+`/g, "")
      .replace(/[#*_~]/g, "")
      .replace(/\[.*?\]/g, "")
      .trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = emotion === "happy" || emotion === "surprised" ? 1.1 : 0.95;
    utterance.pitch = emotion === "happy" ? 1.2 : emotion === "serious" ? 0.9 : 1.0;

    const voices = window.speechSynthesis.getVoices();
    const urduVoice = voices.find((v) => v.lang.startsWith("ur"));
    const englishVoice = voices.find((v) => v.lang.startsWith("en") && v.name.includes("Google"));
    const urduChars = cleanText.match(/[\u0600-\u06FF]/g);
    if (urduChars && urduChars.length > cleanText.length * 0.3 && urduVoice) {
      utterance.voice = urduVoice;
      utterance.lang = "ur-PK";
    } else if (englishVoice) {
      utterance.voice = englishVoice;
      utterance.lang = "en-US";
    }
    window.speechSynthesis.speak(utterance);
  };

  // STT
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported. Please use Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ur-PK";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isRecording]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const quickActions = [
    { icon: "🔍", text: "Search the web", prompt: "Search for latest tech news" },
    { icon: "🔥", text: "Trending products", prompt: "What products are trending right now?" },
    { icon: "💻", text: "Write code", prompt: "Write a Python web scraper" },
    { icon: "📊", text: "Product analysis", prompt: "Analyze the market for AI tools" },
  ];

  const emotionEmojis: Record<EmotionType, string> = {
    happy: "😊", encouraging: "💪", serious: "⚡",
    sympathetic: "💙", surprised: "😲", normal: "🤖",
  };

  const providerLabels: Record<LLMProvider, string> = {
    groq: "Groq (Llama 3.3)", gemini: "Gemini (Google)",
    openai: "OpenAI (GPT-4o)", zai: "ZAI (GLM-4)",
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <header className="chat-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "50%",
            background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "22px", boxShadow: "0 2px 10px var(--accent-glow)",
          }}>🤖</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "16px" }}>JARVIS Hybrid</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
              <span className={`status-dot ${
                connectionStatus === "online" ? "status-online" :
                connectionStatus === "nokey" ? "status-offline" : "status-offline"
              }`}></span>
              <span style={{ color: "var(--text-secondary)" }}>
                {connectionStatus === "online" ? `Online • ${providerLabels[activeProvider]}` :
                 connectionStatus === "nokey" ? "⚠️ Add API Key" : "Offline"} • {emotionEmojis[currentEmotion]} {currentEmotion}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn-icon" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
            onClick={() => window.speechSynthesis.cancel()} title="Stop speaking">🔇</button>
          <button className="btn-icon" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
            onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
        </div>
      </header>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && !streamingContent ? (
          <div className="welcome-screen">
            <div className="welcome-logo">🤖</div>
            <h1 className="welcome-title">JARVIS Hybrid</h1>
            <p className="welcome-subtitle">
              آپ کا ذاتی AI اسسٹنٹ — Cloud Brain + Desktop Hands
            </p>
            {!hasAnyKey && (
              <div style={{
                marginTop: "20px", padding: "16px 24px",
                background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.3)",
                borderRadius: "12px", color: "#eab308", textAlign: "center",
              }}>
                <p style={{ fontWeight: 600, marginBottom: "8px" }}>⚠️ API Key ضروری ہے!</p>
                <p style={{ fontSize: "14px", opacity: 0.9 }}>
                  چلانے کے لیے Settings میں جا کر کم از کم ایک API Key ڈالیں
                </p>
                <button onClick={() => setShowSettings(true)} style={{
                  marginTop: "12px", padding: "8px 20px",
                  background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
                  color: "white", border: "none", borderRadius: "8px",
                  cursor: "pointer", fontWeight: 600,
                }}>⚙️ Settings کھولیں</button>
              </div>
            )}
            <div className="quick-actions">
              {quickActions.map((action, i) => (
                <button key={i} className="quick-action" onClick={() => sendMessage(action.prompt)}
                  disabled={!hasAnyKey}>
                  <div className="quick-action-icon">{action.icon}</div>
                  <div className="quick-action-text">{action.text}</div>
                </button>
              ))}
            </div>
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

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-wrapper">
          <button className={`btn-icon btn-voice ${isRecording ? "recording" : ""}`}
            onClick={toggleRecording} title={isRecording ? "Stop recording" : "Start voice input"}>
            {isRecording ? "⏹️" : "🎤"}
          </button>
          <textarea ref={inputRef} className="chat-input" value={input}
            onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={hasAnyKey ? "اپنا پیغام لکھیں... (Type your message)" : "⚠️ پہلے Settings میں API Key ڈالیں"}
            rows={1} style={{ minHeight: "24px" }} />
          <button className="btn-icon btn-send" onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading || !hasAnyKey} title="Send message">➤</button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px", color: "var(--text-secondary)" }}>
          <span>{hasAnyKey ? `${providerLabels[activeProvider]} • Browser Voice` : "⚠️ No API Key"}</span>
          <span>Enter to send • Shift+Enter new line</span>
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <SettingsPanel
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

// ============== SETTINGS PANEL ==============

function SettingsPanel({
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

  const providers: Array<{ id: LLMProvider; name: string; keyPlaceholder: string; getKeyUrl: string; free: boolean }> = [
    { id: "groq", name: "Groq (Llama 3.3 70B)", keyPlaceholder: "gsk_...", getKeyUrl: "https://console.groq.com", free: true },
    { id: "gemini", name: "Google Gemini 1.5 Flash", keyPlaceholder: "AIza...", getKeyUrl: "https://aistudio.google.com/apikey", free: true },
    { id: "openai", name: "OpenAI (GPT-4o Mini)", keyPlaceholder: "sk-...", getKeyUrl: "https://platform.openai.com/api-keys", free: false },
    { id: "zai", name: "ZAI (GLM-4 Flash)", keyPlaceholder: "your-zai-api-key", getKeyUrl: "https://open.bigmodel.cn", free: true },
  ];

  const handleSave = () => {
    onSaveKeys(localKeys);
    onSaveProvider(localProvider);
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "550px" }}>
        <h2>⚙️ API Settings</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginBottom: "20px" }}>
          کم از کم ایک API Key ڈالیں تاکہ JARVIS چل سکے۔ Keys آپ کے browser میں محفوظ رہیں گی۔
        </p>

        {/* Active Provider Selection */}
        <label style={{ fontWeight: 600, marginBottom: "8px" }}>🎯 Active Provider</label>
        <select
          value={localProvider}
          onChange={(e) => setLocalProvider(e.target.value as LLMProvider)}
          style={{ width: "100%", padding: "10px 12px", background: "var(--bg-primary)",
            border: "1px solid var(--border-color)", borderRadius: "8px",
            color: "var(--text-primary)", fontSize: "14px", marginBottom: "20px", outline: "none" }}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id} disabled={!localKeys[p.id]}>
              {p.name} {!localKeys[p.id] ? "(No Key)" : "✅"} {p.free ? "🆓" : "💰"}
            </option>
          ))}
        </select>

        {/* API Key Inputs */}
        {providers.map((provider) => (
          <div key={provider.id} style={{
            marginBottom: "16px", padding: "14px",
            background: "var(--bg-primary)", border: `1px solid ${localKeys[provider.id] ? "var(--success)" : "var(--border-color)"}`,
            borderRadius: "10px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontWeight: 600, fontSize: "14px" }}>
                {provider.free ? "🆓" : "💰"} {provider.name}
              </span>
              {localKeys[provider.id] && <span style={{ color: "var(--success)", fontSize: "12px" }}>✅ Saved</span>}
            </div>
            <input
              type="password"
              value={localKeys[provider.id] || ""}
              onChange={(e) => setLocalKeys({ ...localKeys, [provider.id]: e.target.value })}
              placeholder={provider.keyPlaceholder}
              style={{
                width: "100%", padding: "8px 12px", background: "var(--bg-secondary)",
                border: "1px solid var(--border-color)", borderRadius: "6px",
                color: "var(--text-primary)", fontSize: "13px", outline: "none",
              }}
            />
            <a href={provider.getKeyUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: "11px", color: "var(--accent-primary)", marginTop: "4px", display: "block" }}>
              Get API Key →
            </a>
          </div>
        ))}

        {/* Save/Cancel */}
        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button onClick={handleSave} style={{
            flex: 1, padding: "10px",
            background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
            color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600,
          }}>💾 Save & Close</button>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px", background: "var(--bg-primary)",
            color: "var(--text-secondary)", border: "1px solid var(--border-color)",
            borderRadius: "8px", cursor: "pointer",
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============== HELPERS ==============

function formatMessage(content: string): string {
  let formatted = content;
  formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`);
  formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" style="color: var(--accent-primary);">$1</a>');
  formatted = formatted.replace(/\n/g, "<br/>");
  return formatted;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
