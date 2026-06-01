"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { EmotionType, JarvisMessage, APIKeys, LLMProvider } from "@/lib/protocol";

// ============== MAIN CHAT PAGE ==============

export default function ChatPage() {
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

  // ===== CONVERSATION MODE STATE =====
  const [conversationMode, setConversationMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const conversationModeRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isLoadingRef = useRef(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const saveApiKeys = useCallback((keys: APIKeys) => {
    setApiKeys(keys);
    localStorage.setItem("jarvis_api_keys", JSON.stringify(keys));
  }, []);

  const saveActiveProvider = useCallback((provider: LLMProvider) => {
    setActiveProvider(provider);
    localStorage.setItem("jarvis_active_provider", provider);
  }, []);

  const hasAnyKey = Object.values(apiKeys).some((k) => k && k.trim().length > 0);

  // Sync refs with state
  useEffect(() => { conversationModeRef.current = conversationMode; }, [conversationMode]);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);

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

  // Show settings on first visit if no keys
  useEffect(() => {
    if (!hasAnyKey) setShowSettings(true);
  }, []);

  // Load voices on mount
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // ===== DETECT LANGUAGE FROM TEXT =====
  const detectLanguage = (text: string): "ur" | "en" | "mixed" => {
    const urduChars = text.match(/[\u0600-\u06FF]/g);
    const urduCount = urduChars ? urduChars.length : 0;
    const ratio = urduCount / text.length;
    if (ratio > 0.3) return "ur";
    if (ratio > 0.05) return "mixed";
    return "en";
  };

  // ===== TEXT-TO-SPEECH WITH CONVERSATION MODE CALLBACK =====
  const speakText = useCallback((text: string, emotion: EmotionType, onDone?: () => void) => {
    if (!window.speechSynthesis) { onDone?.(); return; }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/```[\s\S]*?```/g, " code block ")
      .replace(/`[^`]+`/g, "")
      .replace(/\*\*[^*]+\*\*/g, (match) => match.replace(/\*\*/g, ""))
      .replace(/\*[^*]+\*/g, (match) => match.replace(/\*/g, ""))
      .replace(/#{1,6}\s/g, "")
      .replace(/[#*_~\[\]()]/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .trim();

    if (!cleanText) { onDone?.(); return; }

    // Split long text into chunks for better TTS
    const chunks = cleanText.match(/.{1,200}[.!?۔]|.{1,200}/g) || [cleanText];
    let chunkIndex = 0;

    const speakChunk = () => {
      if (chunkIndex >= chunks.length) {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        onDone?.();
        return;
      }

      const chunk = chunks[chunkIndex].trim();
      if (!chunk) { chunkIndex++; speakChunk(); return; }

      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.rate = emotion === "happy" || emotion === "surprised" ? 1.05 : 0.92;
      utterance.pitch = emotion === "happy" ? 1.15 : emotion === "serious" ? 0.85 : 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const lang = detectLanguage(chunk);

      if (lang === "ur" || lang === "mixed") {
        const urduVoice = voices.find((v) => v.lang.startsWith("ur"));
        if (urduVoice) {
          utterance.voice = urduVoice;
          utterance.lang = "ur-PK";
        } else {
          // Fallback: use any Arabic/Persian voice for Urdu
          const arabicVoice = voices.find((v) => v.lang.startsWith("ar") || v.lang.startsWith("fa"));
          if (arabicVoice) {
            utterance.voice = arabicVoice;
            utterance.lang = "ur-PK";
          }
        }
      } else {
        const englishVoice = voices.find((v) =>
          v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural"))
        ) || voices.find((v) => v.lang.startsWith("en"));
        if (englishVoice) {
          utterance.voice = englishVoice;
          utterance.lang = "en-US";
        }
      }

      utterance.onend = () => {
        chunkIndex++;
        speakChunk();
      };

      utterance.onerror = () => {
        chunkIndex++;
        speakChunk();
      };

      synthUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    };

    setIsSpeaking(true);
    isSpeakingRef.current = true;
    speakChunk();
  }, []);

  // ===== START LISTENING (STT) =====
  const startListening = useCallback((autoSend: boolean = false) => {
    if (isRecording || isSpeakingRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported. Please use Chrome.");
      return;
    }

    // Cancel any ongoing speech first
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    isSpeakingRef.current = false;

    const recognition = new SpeechRecognition();
    // Support both Urdu and English
    recognition.lang = "ur-PK";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsRecording(false);
      setIsListening(false);

      if (transcript.trim()) {
        setInput(transcript);
        // AUTO-SEND: In conversation mode OR when autoSend flag is true
        if (autoSend || conversationModeRef.current) {
          // Small delay to let state update
          setTimeout(() => {
            sendMessageDirect(transcript.trim());
          }, 100);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.log("Speech recognition error:", event.error);
      setIsRecording(false);
      setIsListening(false);
      // In conversation mode, try listening again after a brief pause
      if (conversationModeRef.current && event.error !== "not-allowed") {
        setTimeout(() => {
          if (conversationModeRef.current && !isLoadingRef.current && !isSpeakingRef.current) {
            startListening(true);
          }
        }, 500);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setIsListening(true);
  }, [isRecording]);

  // ===== SEND MESSAGE (direct, no callback dependency issues) =====
  const sendMessageDirect = useCallback(async (text: string) => {
    if (!text.trim() || isLoadingRef.current) return;

    const currentKeys: APIKeys = {
      groq: apiKeys.groq || "",
      gemini: apiKeys.gemini || "",
      openai: apiKeys.openai || "",
      zai: apiKeys.zai || "",
    };

    if (!Object.values(currentKeys).some((k) => k && k.trim().length > 0)) {
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
    isLoadingRef.current = true;
    setStreamingContent("");

    try {
      const currentMessages = await new Promise<JarvisMessage[]>((resolve) => {
        setMessages((prev) => { resolve(prev); return prev; });
      });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          userId,
          history: currentMessages.slice(-20),
          stream: true,
          apiKeys: currentKeys,
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
                // Speak the response
                speakText(fullContent, emotion, () => {
                  // AFTER SPEAKING: In conversation mode, auto-listen again
                  if (conversationModeRef.current) {
                    setTimeout(() => {
                      if (conversationModeRef.current && !isSpeakingRef.current) {
                        startListening(true);
                      }
                    }, 300);
                  }
                });
              }
            } catch { /* skip */ }
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

      // In conversation mode, try listening again after error
      if (conversationModeRef.current) {
        setTimeout(() => {
          if (conversationModeRef.current) startListening(true);
        }, 1000);
      }
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [userId, apiKeys, activeProvider, speakText, startListening]);

  // ===== SEND MESSAGE (from input field) =====
  const sendMessage = useCallback(async (text: string) => {
    sendMessageDirect(text);
  }, [sendMessageDirect]);

  // ===== TOGGLE CONVERSATION MODE =====
  const toggleConversationMode = useCallback(() => {
    const newMode = !conversationMode;
    setConversationMode(newMode);
    conversationModeRef.current = newMode;

    if (newMode) {
      // Start conversation mode - begin listening
      setTimeout(() => {
        startListening(true);
      }, 200);
    } else {
      // Stop conversation mode - stop listening and speaking
      recognitionRef.current?.stop();
      window.speechSynthesis.cancel();
      setIsRecording(false);
      setIsListening(false);
      setIsSpeaking(false);
      isSpeakingRef.current = false;
    }
  }, [conversationMode, startListening]);

  // ===== TOGGLE RECORDING (manual mode) =====
  const toggleRecording = useCallback(() => {
    if (conversationMode) return; // In conversation mode, use the mode button instead

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setIsListening(false);
    } else {
      startListening(false); // Manual mode - don't auto-send
    }
  }, [isRecording, conversationMode, startListening]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ===== Auto-send when input changes from voice (manual mode) =====
  useEffect(() => {
    if (!conversationMode && input && isRecording === false) {
      // Voice input was just set - don't auto-send in manual mode
      // User can press Enter or click Send
    }
  }, [input, conversationMode, isRecording]);

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
                {connectionStatus === "online" ? `${providerLabels[activeProvider]}` :
                 connectionStatus === "nokey" ? "⚠️ Add API Key" : "Offline"}
                {" • "}{emotionEmojis[currentEmotion]} {currentEmotion}
                {conversationMode && " • 🎙️ Conversation Mode"}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className={`btn-icon ${conversationMode ? "btn-conversation-active" : "btn-conversation"}`}
            onClick={toggleConversationMode}
            title={conversationMode ? "Conversation Mode ON - Click to stop" : "Start Conversation Mode (like ChatGPT voice)"}
            disabled={!hasAnyKey}
          >
            {conversationMode ? "🎙️" : "🎧"}
          </button>
          <button className="btn-icon" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
            onClick={() => { window.speechSynthesis.cancel(); setIsSpeaking(false); isSpeakingRef.current = false; }}
            title="Stop speaking">🔇</button>
          <button className="btn-icon" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
            onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
        </div>
      </header>

      {/* Conversation Mode Banner */}
      {conversationMode && (
        <div style={{
          padding: "10px 16px", background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(59, 130, 246, 0.15))",
          borderBottom: "1px solid rgba(16, 185, 129, 0.3)", display: "flex",
          alignItems: "center", justifyContent: "center", gap: "10px",
        }}>
          <div className={`voice-pulse ${isSpeaking ? "speaking" : isListening ? "listening" : "waiting"}`}>
            <div className="voice-pulse-ring"></div>
            <div className="voice-pulse-dot">
              {isSpeaking ? "🔊" : isListening ? "🎤" : "⏳"}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "13px", color: "#10b981" }}>
              {isSpeaking ? "JARVIS bol raha hai..." : isListening ? "Sun raha hoon... boliye!" : "Conversation Mode"}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              {isSpeaking ? "Jawab suniye, phir aapki baari" : isListening ? "ابھی بولیں، میں سن رہا ہوں" : "Boliye, sunega aur jawab dega"}
            </div>
          </div>
        </div>
      )}

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
            {hasAnyKey && (
              <div style={{
                marginTop: "20px", padding: "16px 24px",
                background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "12px", color: "#10b981", textAlign: "center",
              }}>
                <p style={{ fontWeight: 600, marginBottom: "8px" }}>🎙️ Conversation Mode</p>
                <p style={{ fontSize: "14px", opacity: 0.9 }}>
                  ہیڈر میں 🎧 بٹن دبائیں — بولیں، JARVIS سنیگا، جواب دے گا، پھر سنیگا!
                </p>
                <p style={{ fontSize: "12px", opacity: 0.7, marginTop: "6px" }}>
                  Like ChatGPT voice conversation — hands-free baat-cheet
                </p>
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
          <button
            className={`btn-icon btn-voice ${isRecording ? "recording" : ""} ${conversationMode ? "btn-voice-disabled" : ""}`}
            onClick={toggleRecording}
            title={conversationMode ? "Conversation Mode mein hai - 🎧 use karo" : isRecording ? "Stop recording" : "Start voice input (auto-sends)"}
            disabled={conversationMode}
          >
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
          <span>
            {hasAnyKey ? `${providerLabels[activeProvider]}` : "⚠️ No API Key"}
            {conversationMode ? " • 🎙️ Conversation ON" : " • 🎧 Click for voice chat"}
          </span>
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
