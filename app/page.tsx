"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { EmotionType, JarvisMessage, APIKeys, LLMProvider } from "@/lib/protocol";

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

  // Core state
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"online" | "offline" | "nokey">("online");
  const [currentEmotion, setCurrentEmotion] = useState<EmotionType>("normal");
  const [streamingContent, setStreamingContent] = useState("");
  const [apiKeys, setApiKeys] = useState<APIKeys>(loadApiKeys);
  const [activeProvider, setActiveProvider] = useState<LLMProvider>(loadActiveProvider);
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

  const hasAnyKey = Object.values(apiKeys).some((k) => k && k.trim().length > 0);

  const saveApiKeys = useCallback((keys: APIKeys) => {
    setApiKeys(keys);
    localStorage.setItem("jarvis_api_keys", JSON.stringify(keys));
  }, []);

  const saveActiveProvider = useCallback((provider: LLMProvider) => {
    setActiveProvider(provider);
    localStorage.setItem("jarvis_active_provider", provider);
  }, []);

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
  }, []);

  // Load voices
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      // Force load voices
      const loadVoices = () => {
        const v = window.speechSynthesis.getVoices();
        console.log("[JARVIS] Available voices:", v.length, v.filter(x => x.lang.startsWith("ur") || x.lang.startsWith("ar")).map(x => `${x.name} (${x.lang})`));
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // ===== CANCEL ALL SPEECH =====
  const cancelAllSpeech = useCallback(() => {
    // Cancel browser TTS
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    // Cancel any playing audio (Google TTS)
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    speakQueueRef.current = false;
  }, []);

  // ===== DETECT LANGUAGE =====
  const detectLanguage = (text: string): "ur" | "en" | "mixed" => {
    const urduChars = text.match(/[\u0600-\u06FF]/g);
    const urduCount = urduChars ? urduChars.length : 0;
    const ratio = text.length > 0 ? urduCount / text.length : 0;
    if (ratio > 0.2) return "ur";
    if (ratio > 0.03) return "mixed";
    return "en";
  };

  // ===== TTS — Urdu/English Smart =====
  const speakText = useCallback((text: string, emotion: EmotionType, onDone?: () => void) => {
    // Cancel any existing speech first
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
    const voices = window.speechSynthesis.getVoices();

    // Find best voice for the language
    let selectedVoice: SpeechSynthesisVoice | null = null;

    if (lang === "ur" || lang === "mixed") {
      // Priority 1: Urdu voice
      const urduVoice = voices.find(v => v.lang === "ur-PK") ||
                        voices.find(v => v.lang.startsWith("ur"));
      
      // Priority 2: Arabic voice (can read Urdu script partially)
      const arabicVoice = voices.find(v => v.lang === "ar-SA" && v.name.includes("Google")) ||
                          voices.find(v => v.lang.startsWith("ar") && v.name.includes("Google")) ||
                          voices.find(v => v.lang.startsWith("ar"));

      // Priority 3: Farsi voice (similar script)
      const farsiVoice = voices.find(v => v.lang.startsWith("fa"));

      selectedVoice = urduVoice || arabicVoice || farsiVoice || null;

      // If NO Urdu/Arabic/Farsi voice at all, try Google TTS audio approach
      if (!selectedVoice && lang === "ur") {
        speakWithAudioTag(cleanText, emotion, onDone);
        return;
      }
    } else {
      // English: use best English voice
      selectedVoice = voices.find(v =>
        v.lang.startsWith("en") && v.name.includes("Google") && !v.localService
      ) || voices.find(v =>
        v.lang.startsWith("en-US") && v.name.includes("Google")
      ) || voices.find(v =>
        v.lang.startsWith("en") && v.name.includes("Google")
      ) || voices.find(v => v.lang.startsWith("en-US")) ||
        voices.find(v => v.lang.startsWith("en")) || null;
    }

    // Speak using browser Speech Synthesis
    speakWithBrowser(cleanText, lang, emotion, selectedVoice, onDone);
  }, [cancelAllSpeech]);

  // ===== BROWSER TTS =====
  const speakWithBrowser = (
    text: string, lang: "ur" | "en" | "mixed", emotion: EmotionType,
    voice: SpeechSynthesisVoice | null, onDone?: () => void
  ) => {
    // Split into smaller chunks
    const maxLen = lang === "ur" ? 120 : 180;
    const chunks = text.match(new RegExp(`.{1,${maxLen}}[.!?۔\\n]|.{1,${maxLen}}`, "g")) || [text];
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

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = (lang === "ur" || lang === "mixed") ? "ur-PK" : "en-US";
      }

      utterance.rate = emotion === "happy" || emotion === "surprised" ? 1.0 : 0.88;
      utterance.pitch = emotion === "happy" ? 1.1 : emotion === "serious" ? 0.85 : 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => { chunkIndex++; speakChunk(); };
      utterance.onerror = () => { chunkIndex++; speakChunk(); };

      window.speechSynthesis.speak(utterance);
    };

    speakChunk();
  };

  // ===== AUDIO TAG TTS (Fallback for Urdu) =====
  const speakWithAudioTag = (text: string, emotion: EmotionType, onDone?: () => void) => {
    // Use Google Translate TTS via Audio tag (works better than fetch)
    const maxLen = 200;
    const textToSpeak = text.substring(0, maxLen);
    const encoded = encodeURIComponent(textToSpeak);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ur&q=${encoded}`;

    const audio = new Audio(url);
    currentAudioRef.current = audio;

    setIsSpeaking(true);
    isSpeakingRef.current = true;
    speakQueueRef.current = true;

    audio.onended = () => {
      currentAudioRef.current = null;
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      speakQueueRef.current = false;
      onDone?.();
    };

    audio.onerror = () => {
      currentAudioRef.current = null;
      // Fallback: try browser TTS with default voice and ur-PK lang
      const voices = window.speechSynthesis.getVoices();
      const anyVoice = voices.find(v => v.lang.startsWith("en")) || null;
      speakWithBrowser(text, "ur", emotion, anyVoice, onDone);
    };

    audio.play().catch(() => {
      currentAudioRef.current = null;
      // Fallback: browser TTS
      const voices = window.speechSynthesis.getVoices();
      const anyVoice = voices.find(v => v.lang.startsWith("en")) || null;
      speakWithBrowser(text, "ur", emotion, anyVoice, onDone);
    });
  };

  // ===== STT — Start Listening =====
  const startListening = useCallback((autoSend: boolean = false) => {
    if (isRecording) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition requires Chrome browser.");
      return;
    }

    // Cancel any speech first
    cancelAllSpeech();

    const recognition = new SpeechRecognition();
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
        if (autoSend || conversationModeRef.current) {
          setTimeout(() => sendMessageDirect(transcript.trim()), 150);
        }
      }
    };

    recognition.onerror = (event: any) => {
      setIsRecording(false);
      setIsListening(false);
      if (conversationModeRef.current && event.error !== "not-allowed" && event.error !== "aborted") {
        setTimeout(() => {
          if (conversationModeRef.current && !isLoadingRef.current && !isSpeakingRef.current) {
            startListening(true);
          }
        }, 800);
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
  }, [isRecording, cancelAllSpeech]);

  // ===== SEND MESSAGE =====
  const sendMessageDirect = useCallback(async (text: string, fileData?: UploadedFile) => {
    if (!text.trim() || isLoadingRef.current) return;

    const currentKeys: APIKeys = {
      groq: apiKeys.groq || "", gemini: apiKeys.gemini || "",
      openai: apiKeys.openai || "", zai: apiKeys.zai || "",
    };

    if (!Object.values(currentKeys).some(k => k && k.trim().length > 0)) {
      setShowSettings(true);
      return;
    }

    // Cancel any ongoing speech before sending new message
    cancelAllSpeech();

    const userMsg: JarvisMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: fileData ? `[📎 ${fileData.name}]\n${text.trim()}` : text.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setUploadedFile(null);
    setIsLoading(true);
    isLoadingRef.current = true;
    setStreamingContent("");

    try {
      const isTask = /^(do|task|run|execute|search|find|analyze|write|create|build|scrape|fetch|download)/i.test(text.trim());
      const taskId = isTask ? `task_${Date.now()}` : null;

      if (taskId) {
        setBgTasks(prev => [...prev, { id: taskId, description: text.trim(), status: "running" }]);
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          userId,
          history: messagesRef.current.slice(-20),
          stream: true,
          apiKeys: currentKeys,
          activeProvider,
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
                setMessages(prev => [...prev, assistantMsg]);
                setStreamingContent("");

                if (taskId) {
                  setBgTasks(prev => prev.map(t =>
                    t.id === taskId ? { ...t, status: "completed" as const, result: fullContent.substring(0, 100) } : t
                  ));
                }

                // Speak the response
                speakText(fullContent, emotion, () => {
                  if (conversationModeRef.current) {
                    setTimeout(() => {
                      if (conversationModeRef.current && !isSpeakingRef.current) {
                        startListening(true);
                      }
                    }, 400);
                  }
                });
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (error) {
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

  // ===== CONVERSATION MODE TOGGLE =====
  const toggleConversationMode = useCallback(() => {
    const newMode = !conversationMode;
    setConversationMode(newMode);
    conversationModeRef.current = newMode;

    if (newMode) {
      // Cancel any ongoing speech first
      cancelAllSpeech();
      // Start listening
      setTimeout(() => startListening(true), 300);
    } else {
      // Stop everything
      cancelAllSpeech();
      recognitionRef.current?.stop();
      setIsRecording(false);
      setIsListening(false);
    }
  }, [conversationMode, startListening, cancelAllSpeech]);

  // ===== MANUAL VOICE TOGGLE =====
  const toggleRecording = useCallback(() => {
    if (conversationMode) return;
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setIsListening(false);
    } else {
      startListening(true);
    }
  }, [isRecording, conversationMode, startListening]);

  // ===== FILE UPLOAD =====
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("File must be under 5MB"); return; }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadedFile({
        name: file.name, type: file.type, size: file.size,
        dataUrl: ev.target?.result as string,
      });
      inputRef.current?.focus();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const quickActions = [
    { icon: "🎙️", text: "Voice Chat", prompt: "", isConvMode: true },
    { icon: "🔍", text: "Search the web", prompt: "Search for latest tech news" },
    { icon: "💻", text: "Write code", prompt: "Write a Python web scraper" },
    { icon: "📊", text: "Analyze market", prompt: "Analyze the market for AI tools" },
  ];

  const emotionEmojis: Record<EmotionType, string> = {
    happy: "😊", encouraging: "💪", serious: "⚡",
    sympathetic: "💙", surprised: "😲", normal: "🤖",
  };

  const providerLabels: Record<LLMProvider, string> = {
    groq: "Groq", gemini: "Gemini", openai: "OpenAI", zai: "ZAI",
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <header className="chat-header">
        <div className="header-brand">
          <div className="brand-icon">🤖</div>
          <div>
            <div className="brand-title">JARVIS</div>
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
              {isSpeaking ? "JARVIS bol raha hai..." : isListening ? "Sun raha hoon... boliye!" : "🎙️ Voice Chat ON"}
            </div>
            <div className="conv-info-sub">
              {isSpeaking ? "Jawab suniye, phir aapki baari" : isListening ? "Ab boliye — auto-send" : "Boliye, sunega aur jawab dega"}
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
            <div className="welcome-logo">🤖</div>
            <h1 className="welcome-title">JARVIS</h1>
            <p className="welcome-subtitle">
              آپ کا ذاتی AI اسسٹنٹ — بولیں، سنیں، کام کریں
            </p>

            {!hasAnyKey ? (
              <div className="welcome-alert welcome-alert-warning">
                <p style={{ fontWeight: 600 }}>⚠️ API Key ضروری ہے!</p>
                <p style={{ fontSize: "13px", opacity: 0.85 }}>Settings میں جا کر کم از کم ایک API Key ڈالیں</p>
                <button className="welcome-alert-btn" onClick={() => setShowSettings(true)}>
                  ⚙️ Settings کھولیں
                </button>
              </div>
            ) : (
              <div className="welcome-alert welcome-alert-success">
                <p style={{ fontWeight: 600 }}>🎙️ Voice Chat Available</p>
                <p style={{ fontSize: "13px", opacity: 0.85 }}>
                  نیچے 🎧 dabao — boliye, JARVIS sunega, jawab dega, phir sunega!
                </p>
              </div>
            )}

            <div className="quick-actions">
              {quickActions.map((action, i) => (
                <button key={i} className="quick-action"
                  onClick={() => action.isConvMode ? toggleConversationMode() : sendMessage(action.prompt)}
                  disabled={!hasAnyKey && !action.isConvMode}
                >
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

      {/* Input Area — CONVERSATION BUTTON IS HERE NOW */}
      <div className="chat-input-area">
        {/* File Preview */}
        {uploadedFile && (
          <div className="file-preview">
            <span>{uploadedFile.type.startsWith("image/") ? "🖼️" : "📄"}</span>
            <span>{uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)}KB)</span>
            <button className="file-preview-remove" onClick={() => setUploadedFile(null)}>✕</button>
          </div>
        )}

        <div className="chat-input-wrapper">
          {/* Upload button */}
          <button className="btn-icon" onClick={() => fileInputRef.current?.click()} title="Upload file">
            📎
          </button>
          <input ref={fileInputRef} type="file" hidden
            accept="image/*,.pdf,.txt,.csv,.json,.md,.py,.js,.ts,.html,.css"
            onChange={handleFileUpload} />

          {/* Conversation Mode Button — IN INPUT AREA */}
          <button
            className={`btn-icon ${conversationMode ? "btn-conversation-active" : ""}`}
            onClick={toggleConversationMode}
            title={conversationMode ? "🎙️ Stop Voice Chat" : "🎧 Start Voice Chat (Conversation Mode)"}
            disabled={!hasAnyKey}
          >
            {conversationMode ? "🎙️" : "🎧"}
          </button>

          {/* Mic button */}
          <button
            className={`btn-icon btn-voice ${isRecording ? "recording" : ""}`}
            onClick={toggleRecording}
            title={isRecording ? "Stop" : "🎤 Voice input (auto-sends)"}
            disabled={conversationMode}
          >
            {isRecording ? "⏹️" : "🎤"}
          </button>

          {/* Text input */}
          <textarea ref={inputRef} className="chat-input" value={input}
            onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={hasAnyKey ? "Type your message... / اپنا پیغام لکھیں" : "⚠️ Add API Key in Settings"}
            rows={1} style={{ minHeight: "24px" }} />

          {/* Send button */}
          <button className="btn-icon btn-send" onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading || !hasAnyKey} title="Send">➤</button>
        </div>

        <div className="input-footer">
          <span>
            {hasAnyKey ? providerLabels[activeProvider] : "⚠️ No Key"}
            {conversationMode ? " · 🎙️ Voice Chat ON" : " · 🎧 = voice chat"}
          </span>
          <span>Enter to send</span>
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

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <h2>⚙️ API Settings</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
          کم از کم ایک API Key ڈالیں۔ Keys browser میں محفوظ رہیں گی۔
        </p>

        <label style={{ fontWeight: 600, marginBottom: "8px", display: "block" }}>🎯 Active Provider</label>
        <select
          value={localProvider}
          onChange={(e) => setLocalProvider(e.target.value as LLMProvider)}
          style={{
            width: "100%", padding: "10px 12px", background: "var(--bg-primary)",
            border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)", fontSize: "14px", marginBottom: "20px", outline: "none",
          }}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id} disabled={!localKeys[p.id]}>
              {p.name} {!localKeys[p.id] ? "(No Key)" : "✅"} {p.free ? "🆓" : "💰"}
            </option>
          ))}
        </select>

        {providers.map((provider) => (
          <div key={provider.id} className="provider-card"
            style={{ borderColor: localKeys[provider.id] ? "rgba(34,197,94,0.3)" : undefined }}>
            <div className="provider-header">
              <span className="provider-name">
                {provider.free ? "🆓" : "💰"} {provider.name}
              </span>
              {localKeys[provider.id] && <span className="provider-saved">✅</span>}
            </div>
            <input type="password" className="provider-input"
              value={localKeys[provider.id] || ""}
              onChange={(e) => setLocalKeys({ ...localKeys, [provider.id]: e.target.value })}
              placeholder={provider.keyPlaceholder} />
            <a href={provider.getKeyUrl} target="_blank" rel="noopener noreferrer" className="provider-link">
              Get API Key →
            </a>
          </div>
        ))}

        <div className="settings-actions">
          <button className="btn-save" onClick={() => { onSaveKeys(localKeys); onSaveProvider(localProvider); onClose(); }}>
            💾 Save & Close
          </button>
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============== HELPERS ==============
function formatMessage(content: string): string {
  let f = content;
  f = f.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`);
  f = f.replace(/`([^`]+)`/g, "<code>$1</code>");
  f = f.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  f = f.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  f = f.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" style="color: var(--accent-tertiary);">$1</a>');
  f = f.replace(/\n/g, "<br/>");
  return f;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
