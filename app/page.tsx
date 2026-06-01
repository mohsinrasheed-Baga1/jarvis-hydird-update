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
  const speakWithBrowser = (
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

  // ===== GOOGLE TRANSLATE TTS (Last resort) =====
  const speakWithGoogleTTS = useCallback((text: string, emotion: EmotionType, onDone?: () => void) => {
    console.log("[JARVIS] Trying Google Translate TTS...");
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
      audio.onended = () => {
        currentAudioRef.current = null;
        chunkIndex++;
        playChunk();
      };
      audio.onerror = () => {
        console.warn("[JARVIS] Google TTS failed, final fallback");
        currentAudioRef.current = null;
        speakWithBrowser(text, "ur", emotion, null, onDone);
      };
      audio.play().catch(() => {
        console.warn("[JARVIS] Google TTS play() failed");
        currentAudioRef.current = null;
        speakWithBrowser(text, "ur", emotion, null, onDone);
      });
    };
    playChunk();
  }, []);

  // ===== URDU FALLBACK =====
  const speakUrduFallback = useCallback((text: string, emotion: EmotionType, onDone?: () => void) => {
    console.log("[JARVIS] Trying Urdu fallback...");
    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find(v => v.lang === "ar-SA" && v.name.includes("Google")) ||
                        voices.find(v => v.lang.startsWith("ar") && v.name.includes("Google")) ||
                        voices.find(v => v.lang.startsWith("ar"));
    if (arabicVoice) {
      console.log("[JARVIS] Using Arabic voice:", arabicVoice.name);
      speakWithBrowser(text, "ur", emotion, arabicVoice, onDone);
      return;
    }
    speakWithGoogleTTS(text, emotion, onDone);
  }, [speakWithGoogleTTS]);

  // ===== URDU CLOUD TTS (Chrome's built-in cloud Urdu voice) =====
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
      // CRITICAL: Set lang to ur-PK but do NOT set voice property
      // This allows Chrome to use its cloud Urdu voice automatically
      utterance.lang = "ur-PK";
      utterance.rate = emotion === "happy" || emotion === "surprised" ? 1.0 : 0.85;
      utterance.pitch = emotion === "happy" ? 1.1 : emotion === "serious" ? 0.85 : 1.0;
      utterance.volume = 1.0;
      const timeout = setTimeout(() => {
        if (!failed && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          failed = true;
          window.speechSynthesis.cancel();
          speakUrduFallback(text, emotion, onDone);
        }
      }, 3500);
      utterance.onend = () => {
        clearTimeout(timeout);
        chunkIndex++;
        speakChunk();
      };
      utterance.onerror = (event) => {
        clearTimeout(timeout);
        console.warn("[JARVIS] Urdu cloud TTS error:", event.error);
        if (!failed) {
          failed = true;
          speakUrduFallback(text, emotion, onDone);
        }
      };
      window.speechSynthesis.speak(utterance);
    };
    speakChunk();
  }, [speakUrduFallback]);

  // ===== SERVER-SIDE TTS — CORRECT LANGUAGE (No CORS issues!) =====
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
          // Get ALL TTS keys — support comma-separated multi-keys
          const elevenlabsKey = localStorage.getItem("jarvis_elevenlabs_key") || "";
          const sarvamKey = localStorage.getItem("jarvis_sarvam_key") || "";
          const openaiKey = localStorage.getItem("jarvis_openai_tts_key") ||
            (localStorage.getItem("jarvis_api_keys") ?
              JSON.parse(localStorage.getItem("jarvis_api_keys") || "{}").openai : "") || "";

          // Merge all OpenAI keys (LLM key + dedicated TTS key)
          const allOpenAIKeys = [openaiKey, localStorage.getItem("jarvis_openai_extra_keys") || ""]
            .join(",").split(",").map(k => k.trim()).filter(k => k.length > 0).join(",");

          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: chunk.substring(0, 5000),
              lang: (lang === "ur" || lang === "mixed") ? "ur" : "en",  // CRITICAL: correct language!
              emotion: emotion,
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

              audio.onended = () => {
                currentAudioRef.current = null;
                URL.revokeObjectURL(url);
                chunkIndex++;
                playChunk();
              };

              audio.onerror = () => {
                currentAudioRef.current = null;
                URL.revokeObjectURL(url);
                chunkIndex++;
                playChunk();
              };

              await audio.play();
              return;
            }
          }
          // Server TTS failed for this chunk, try browser TTS as fallback
          console.warn(`[JARVIS] Server TTS chunk failed (provider: ${res.headers.get("X-TTS-Provider") || "unknown"}, status: ${res.status})`);
          chunkIndex++;
          await playChunk();
        } catch (err) {
          console.warn("[JARVIS] Server TTS error:", err);
          // Fall back to browser TTS
          if (lang === "ur" || lang === "mixed") {
            speakUrduCloud(text, emotion, onDone);
          } else {
            speakWithBrowser(text, "en", emotion, null, onDone);
          }
        }
      };

      await playChunk();
    } catch {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      speakQueueRef.current = false;
      // Fall back to browser TTS
      if (lang === "ur" || lang === "mixed") {
        speakUrduCloud(text, emotion, onDone);
      } else {
        speakWithBrowser(text, "en", emotion, null, onDone);
      }
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

    // CRITICAL FIX: Pass correct language to server TTS!
    // Before, ALL text was sent as lang="ur" which caused wrong voice selection
    if (lang === "ur" || lang === "mixed") {
      speakServerTTS(cleanText, "ur", emotion, onDone);
    } else {
      // English — use server TTS with lang="en" for correct voice
      const hasAnyTTSKey = localStorage.getItem("jarvis_elevenlabs_key") ||
        localStorage.getItem("jarvis_sarvam_key") ||
        localStorage.getItem("jarvis_openai_tts_key") ||
        (localStorage.getItem("jarvis_api_keys") ?
          JSON.parse(localStorage.getItem("jarvis_api_keys") || "{}").openai : "");
      if (hasAnyTTSKey) {
        speakServerTTS(cleanText, "en", emotion, onDone);
      } else {
        // No TTS keys — use browser TTS for English
        const voices = window.speechSynthesis.getVoices();
        const selectedVoice = voices.find(v =>
          v.lang.startsWith("en") && v.name.includes("Google") && !v.localService
        ) || voices.find(v =>
          v.lang.startsWith("en-US") && v.name.includes("Google")
        ) || voices.find(v =>
          v.lang.startsWith("en") && v.name.includes("Google")
        ) || voices.find(v => v.lang.startsWith("en-US")) ||
          voices.find(v => v.lang.startsWith("en")) || null;
        speakWithBrowser(cleanText, "en", emotion, selectedVoice, onDone);
      }
    }
  }, [cancelAllSpeech, speakServerTTS]);

  // ===== STT — Start Listening (NEVER auto-closes mic!) =====
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
    // CRITICAL: continuous = true means mic stays OPEN — never auto-closes!
    recognition.continuous = true;
    // interimResults = true so we can detect when user starts speaking
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // Silence detection — wait for user to finish speaking
    let silenceTimer: NodeJS.Timeout | null = null;
    let lastTranscript = "";
    let hasFinalResult = false;
    const SILENCE_TIMEOUT = 3000; // 3 seconds of silence = user done speaking
    // In conversation mode, be more patient
    const convSilenceTimeout = conversationModeRef.current ? 4000 : 2500;

    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        // User has been silent — they're done speaking
        if (lastTranscript.trim() && !hasFinalResult) {
          hasFinalResult = true;
          const finalTranscript = lastTranscript.trim();
          setIsRecording(false);
          setIsListening(false);
          setInput(finalTranscript);
          // Stop the recognition since we have the text
          try { recognition.stop(); } catch {}
          if (autoSend || conversationModeRef.current) {
            setTimeout(() => sendMessageDirect(finalTranscript), 200);
          }
        } else if (!lastTranscript.trim() && conversationModeRef.current) {
          // No speech detected yet, but in conversation mode — keep listening!
          // Don't close the mic, just reset the timer
          hasFinalResult = false;
        }
      }, convSilenceTimeout);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Update the last transcript with whatever we have
      if (finalTranscript) {
        lastTranscript = finalTranscript;
        hasFinalResult = true;
        setIsRecording(false);
        setIsListening(false);
        setInput(finalTranscript.trim());
        try { recognition.stop(); } catch {}
        if (autoSend || conversationModeRef.current) {
          setTimeout(() => sendMessageDirect(finalTranscript.trim()), 200);
        }
      } else if (interimTranscript) {
        lastTranscript = interimTranscript;
        // Show what user is saying in real-time
        setInput(interimTranscript);
        // Reset silence timer — user is still speaking
        resetSilenceTimer();
      }
    };

    recognition.onerror = (event: any) => {
      if (silenceTimer) clearTimeout(silenceTimer);
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
      if (silenceTimer) clearTimeout(silenceTimer);
      // In conversation mode, if we didn't get a final result, restart listening
      if (conversationModeRef.current && !hasFinalResult && !isLoadingRef.current) {
        setTimeout(() => {
          if (conversationModeRef.current && !isSpeakingRef.current) {
            startListening(true);
          }
        }, 300);
        return;
      }
      setIsRecording(false);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
    setIsListening(true);
    // Start the initial silence timer
    resetSilenceTimer();
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
    { icon: "🎯", text: "Hunt Jobs", prompt: "Mujhe jobs dhundho — web development, frontend, React, Next.js ke liye sab main platforms pe jobs talaash karo" },
    { icon: "🚀", text: "Full Pipeline", prompt: "Poora freelancing pipeline chalao — jobs dhundho, apply karo, negotiate karo, best strategy banao" },
    { icon: "💬", text: "Client Chat", prompt: "Client se WhatsApp pe baat karni hai — help me chat naturally as Rayan Sir" },
    { icon: "📝", text: "Write Proposal", prompt: "Winning proposal likho — job description de raha hoon" },
    { icon: "🎨", text: "Portfolio Pitch", prompt: "Portfolio pitch banao jo client ko impress kare" },
  ];

  const emotionEmojis: Record<EmotionType, string> = {
    happy: "😊", encouraging: "💪", serious: "⚡",
    sympathetic: "💙", surprised: "😲", normal: "🙂",
  };

  const providerLabels: Record<LLMProvider, string> = {
    groq: "Groq", gemini: "Gemini", openai: "OpenAI", zai: "ZAI",
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <header className="chat-header">
        <div className="header-brand">
          <div className="brand-icon">🧠</div>
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
                <button className="welcome-alert-btn" onClick={() => setShowSettings(true)}>
                  ⚙️ Settings کھولیں
                </button>
              </div>
            ) : (
              <div className="welcome-alert welcome-alert-success">
                <p style={{ fontWeight: 600 }}>🎙️ نیچرل وائس چیٹ تیار ہے!</p>
                <p style={{ fontSize: "13px", opacity: 0.85 }}>
                  نیچے 🎧 دباؤ — بولو، جاروس سنے گا، انسان کی طرح جواب دے گا!
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
            {" · 🎯 Hunt Jobs · 💬 Client Chat"}
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
  const [elevenlabsKey, setElevenlabsKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("jarvis_elevenlabs_key") || "";
  });
  const [sarvamKey, setSarvamKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("jarvis_sarvam_key") || "";
  });

  const providers: Array<{ id: LLMProvider; name: string; keyPlaceholder: string; getKeyUrl: string; free: boolean }> = [
    { id: "groq", name: "Groq (Llama 3.3 70B)", keyPlaceholder: "gsk_...", getKeyUrl: "https://console.groq.com", free: true },
    { id: "gemini", name: "Google Gemini 1.5 Flash", keyPlaceholder: "AIza...", getKeyUrl: "https://aistudio.google.com/apikey", free: true },
    { id: "openai", name: "OpenAI (GPT-4o Mini)", keyPlaceholder: "sk-...", getKeyUrl: "https://platform.openai.com/api-keys", free: false },
    { id: "zai", name: "ZAI (GLM-4 Flash)", keyPlaceholder: "your-zai-api-key", getKeyUrl: "https://open.bigmodel.cn", free: true },
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
          کم از کم ایک API Key ڈالیں۔ ایک سے زیادہ keys ڈالنے کے لیے comma (,) سے الگ کریں — لیمٹ ختم ہو تو اگلی key خودکار چلے گی!
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
              {localKeys[provider.id] && <span className="provider-saved">✅ {(localKeys[provider.id] || "").split(",").filter((k:string)=>k.trim()).length} key(s)</span>}
            </div>
            <input type="password" className="provider-input"
              value={localKeys[provider.id] || ""}
              onChange={(e) => setLocalKeys({ ...localKeys, [provider.id]: e.target.value })}
              placeholder={localKeys[provider.id] ? provider.keyPlaceholder + " (comma سے زیادہ keys ڈالیں)" : provider.keyPlaceholder} />
            <a href={provider.getKeyUrl} target="_blank" rel="noopener noreferrer" className="provider-link">
              Get API Key →
            </a>
          </div>
        ))}

        {/* ===== NATURAL VOICE / TTS Section ===== */}
        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "12px" }}>🎙️ نیچرل آواز (100% انسان جیسی)</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "16px" }}>
            یوٹیوب پر ہندی AI ایجنٹس جیسی بالکل نیچرل آواز چاہیے تو ElevenLabs یا Sarvam AI key ڈالیں۔ بغیر key کے Google TTS استعمال ہوگا (روبوٹک)۔
          </p>

          {/* ElevenLabs — THE BEST — same as YouTube Hindi AI agents */}
          <div className="provider-card" style={{ borderColor: elevenlabsKey ? "rgba(34,197,94,0.3)" : undefined }}>
            <div className="provider-header">
              <span className="provider-name">👑 ElevenLabs Turbo (سب سے نیچرل!)</span>
              {elevenlabsKey && <span className="provider-saved">✅</span>}
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "11px", margin: "6px 0 8px" }}>
              یہ وہی سسٹم ہے جو یوٹیوب پر ہندی AI ایجنٹس استعمال کرتے ہیں — 100% نیچرل، انسان جیسی آواز، جذبات کے ساتھ!
            </p>
            <input type="password" className="provider-input"
              value={elevenlabsKey}
              onChange={(e) => setElevenlabsKey(e.target.value)}
              placeholder="xi_... (ایک سے زیادہ keys comma سے الگ کریں)" />
            <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="provider-link">
              🆓 Free API Key لیں →
            </a>
          </div>

          {/* Sarvam AI — Indian TTS, natural Hindi/Urdu */}
          <div className="provider-card" style={{ borderColor: sarvamKey ? "rgba(34,197,94,0.3)" : undefined, marginTop: "10px" }}>
            <div className="provider-header">
              <span className="provider-name">🇮🇳 Sarvam AI (ہندی/اردو نیچرل آواز)</span>
              {sarvamKey && <span className="provider-saved">✅</span>}
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "11px", margin: "6px 0 8px" }}>
              ہندوستانی AI کمپنی — ہندی/اردو کے لیے مخصوص، بالکل نیچرل آواز، فری ٹائر دستیاب!
            </p>
            <input type="password" className="provider-input"
              value={sarvamKey}
              onChange={(e) => setSarvamKey(e.target.value)}
              placeholder="Sarvam API Key (ایک سے زیادہ comma سے الگ)" />
            <a href="https://sarvam.ai" target="_blank" rel="noopener noreferrer" className="provider-link">
              🆓 Sarvam AI سے Key لیں →
            </a>
          </div>

          {/* OpenAI TTS - auto-uses existing key */}
          <div className="provider-card" style={{
            borderColor: (localKeys.openai || localStorage.getItem("jarvis_api_keys") ?
              JSON.parse(localStorage.getItem("jarvis_api_keys") || "{}").openai : "") ? "rgba(34,197,94,0.3)" : undefined,
            marginTop: "10px"
          }}>
            <div className="provider-header">
              <span className="provider-name">🎵 OpenAI TTS HD (نیچرل)</span>
              {(localKeys.openai || localStorage.getItem("jarvis_api_keys") ?
                JSON.parse(localStorage.getItem("jarvis_api_keys") || "{}").openai : "") && <span className="provider-saved">✅ Auto</span>}
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "11px", margin: "6px 0 8px" }}>
              آپ کی OpenAI API key خودکار استعمال ہوگی — الگ سے کرنے کی ضرورت نہیں!
            </p>
          </div>

          {/* Priority Info */}
          <div style={{ marginTop: "12px", padding: "10px", background: "rgba(59,130,246,0.1)", borderRadius: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
            <p style={{ fontWeight: 600, marginBottom: "4px" }}>📋 آواز کی ترجیح:</p>
            <p>1️⃣ ElevenLabs Turbo (سب سے نیچرل — یوٹیوب جیسا)</p>
            <p>2️⃣ Sarvam AI (ہندی/اردو مخصوص)</p>
            <p>3️⃣ OpenAI TTS HD (اچھی نیچرل)</p>
            <p>4️⃣ Google Translate (روبوٹک — آخری آپشن)</p>
          </div>
        </div>

        <div className="settings-actions">
          <button className="btn-save" onClick={handleSave}>
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
