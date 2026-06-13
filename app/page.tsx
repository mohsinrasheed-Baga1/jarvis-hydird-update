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

interface DesktopActionResult { success: boolean; message: string; }
interface ElectronDesktopAPI {
  desktopAction: (action: { type: string; url?: string; query?: string; command?: string; path?: string; title?: string; body?: string; app?: string }) => Promise<DesktopActionResult>;
  openUrl: (url: string) => Promise<DesktopActionResult>;
  searchYoutube: (query: string) => Promise<DesktopActionResult>;
  playYoutube: (queryOrUrl: string) => Promise<DesktopActionResult>;
  systemCommand: (cmd: string) => Promise<DesktopActionResult>;
  openFolder: (path: string) => Promise<DesktopActionResult>;
  openApp: (app: string) => Promise<DesktopActionResult>;
  showNotification: (title: string, body: string) => Promise<DesktopActionResult>;
  platform: string;
}

function isElectron(): boolean {
  return !!(window as any).__JARVIS_DESKTOP__ || !!(window as any).electronAPI;
}

function getElectronAPI(): ElectronDesktopAPI | undefined {
  return (window as any).electronAPI;
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

  // TTS Provider indicator
  const [ttsProvider, setTtsProvider] = useState<string>("");

  // File upload
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

  // Background tasks
  const [bgTasks, setBgTasks] = useState<BackgroundTask[]>([]);

  // Story Recording
  const [isRecordingStory, setIsRecordingStory] = useState(false);
  const [storyTitle, setStoryTitle] = useState("");
  const [showStoryPanel, setShowStoryPanel] = useState(false);

  // TTS Test
  const [ttsTestResult, setTtsTestResult] = useState<string>("");
  const [ttsTesting, setTtsTesting] = useState(false);

  // Voice Cloning
  const [showVoiceClone, setShowVoiceClone] = useState(false);
  const [clonedVoiceId, setClonedVoiceId] = useState<string>("");
  const [voiceCloneStatus, setVoiceCloneStatus] = useState<string>("");
  const [voiceCloneRecording, setVoiceCloneRecording] = useState(false);
  const [voiceCloneSamples, setVoiceCloneSamples] = useState<string[]>([]);
  const [discoveredVoices, setDiscoveredVoices] = useState<Array<{id: string; name: string; gender: string; category: string}>>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);

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
  const sttMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sttChunksRef = useRef<Blob[]>([]);
  const sttStreamRef = useRef<MediaStream | null>(null);
  const sttAutoSendRef = useRef(false);
  const sttSilenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sttAnalyserRef = useRef<AnalyserNode | null>(null);
  const sttAudioContextRef = useRef<AudioContext | null>(null);
  const startListeningRef = useRef<(autoSend?: boolean) => void>(() => {});
  const sendMessageDirectRef = useRef<(text: string, fileData?: UploadedFile) => void>(() => {});

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

  // Load voices + Load cloned voice ID
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Load saved cloned voice
      const savedVoiceId = localStorage.getItem("jarvis_cloned_voice_id") || "";
      if (savedVoiceId) setClonedVoiceId(savedVoiceId);

      if (window.speechSynthesis) {
        const loadVoices = () => {
          const v = window.speechSynthesis.getVoices();
          console.log("[JARVIS] Available voices:", v.length, v.filter(x => x.lang.startsWith("ur") || x.lang.startsWith("ar")).map(x => `${x.name} (${x.lang})`));
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  // ===== CANCEL ALL SPEECH =====
  const cancelAllSpeech = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
    isSpeakingRef.current = false;
    speakQueueRef.current = false;
    setTtsProvider("");
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

  // ===== SPLIT TEXT INTO CHUNKS =====
  const splitTextChunks = (text: string, maxLen: number): string[] => {
    if (text.length <= maxLen) return [text];
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
    const chunks = splitTextChunks(text, 180);
    let chunkIndex = 0;
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    speakQueueRef.current = true;
    setTtsProvider("Browser TTS");
    const speakChunk = () => {
      if (!speakQueueRef.current || chunkIndex >= chunks.length) {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        speakQueueRef.current = false;
        setTtsProvider("");
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
    const chunks = splitTextChunks(text, 180);
    let chunkIndex = 0;
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    speakQueueRef.current = true;
    setTtsProvider("Google TTS (روبوٹک)");
    const playChunk = () => {
      if (!speakQueueRef.current || chunkIndex >= chunks.length) {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        speakQueueRef.current = false;
        setTtsProvider("");
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
        currentAudioRef.current = null;
        speakWithBrowser(text, "ur", emotion, null, onDone);
      };
      audio.play().catch(() => {
        currentAudioRef.current = null;
        speakWithBrowser(text, "ur", emotion, null, onDone);
      });
    };
    playChunk();
  }, []);

  // ===== URDU FALLBACK =====
  const speakUrduFallback = useCallback((text: string, emotion: EmotionType, onDone?: () => void) => {
    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find(v => v.lang === "ar-SA" && v.name.includes("Google")) ||
                        voices.find(v => v.lang.startsWith("ar") && v.name.includes("Google")) ||
                        voices.find(v => v.lang.startsWith("ar"));
    if (arabicVoice) {
      speakWithBrowser(text, "ur", emotion, arabicVoice, onDone);
      return;
    }
    speakWithGoogleTTS(text, emotion, onDone);
  }, [speakWithGoogleTTS]);

  // ===== URDU CLOUD TTS =====
  const speakUrduCloud = useCallback((text: string, emotion: EmotionType, onDone?: () => void) => {
    const chunks = splitTextChunks(text, 180);
    let chunkIndex = 0;
    let failed = false;
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    speakQueueRef.current = true;
    setTtsProvider("Chrome Urdu");
    const speakChunk = () => {
      if (!speakQueueRef.current || chunkIndex >= chunks.length || failed) {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        speakQueueRef.current = false;
        setTtsProvider("");
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
      utterance.onerror = () => {
        clearTimeout(timeout);
        if (!failed) {
          failed = true;
          speakUrduFallback(text, emotion, onDone);
        }
      };
      window.speechSynthesis.speak(utterance);
    };
    speakChunk();
  }, [speakUrduFallback]);

  // ===== SERVER-SIDE TTS — NATURAL VOICE =====
  const speakServerTTS = useCallback(async (text: string, lang: "ur" | "en" | "mixed", emotion: EmotionType, onDone?: () => void) => {
    setIsSpeaking(true);
    isSpeakingRef.current = true;
    speakQueueRef.current = true;

    try {
      const maxChunkLen = 4000;
      const chunks = splitTextChunks(text, maxChunkLen);
      let chunkIndex = 0;

      const playChunk = async () => {
        if (!speakQueueRef.current || chunkIndex >= chunks.length) {
          setIsSpeaking(false);
          isSpeakingRef.current = false;
          speakQueueRef.current = false;
          setTtsProvider("");
          onDone?.();
          return;
        }

        const chunk = chunks[chunkIndex].trim();
        if (!chunk) { chunkIndex++; await playChunk(); return; }

        try {
          // Get ALL TTS keys
          const elevenlabsKey = localStorage.getItem("jarvis_elevenlabs_key") || "";
          const sarvamKey = localStorage.getItem("jarvis_sarvam_key") || "";
          const openaiKey = localStorage.getItem("jarvis_openai_tts_key") ||
            (localStorage.getItem("jarvis_api_keys") ?
              JSON.parse(localStorage.getItem("jarvis_api_keys") || "{}").openai : "") || "";

          const allOpenAIKeys = [openaiKey, localStorage.getItem("jarvis_openai_extra_keys") || ""]
            .join(",").split(",").map(k => k.trim()).filter(k => k.length > 0).join(",");

          console.log(`[JARVIS] TTS request: lang=${lang}, elevenlabs=${elevenlabsKey ? "YES" : "NO"}, sarvam=${sarvamKey ? "YES" : "NO"}, openai=${allOpenAIKeys ? "YES" : "NO"}`);

          const savedClonedVoiceId = localStorage.getItem("jarvis_cloned_voice_id") || "";

          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: chunk.substring(0, 5000),
              lang: (lang === "ur" || lang === "mixed") ? "ur" : "en",
              emotion: emotion,
              elevenlabsKey: elevenlabsKey || undefined,
              sarvamKey: sarvamKey || undefined,
              openaiKey: allOpenAIKeys || undefined,
              clonedVoiceId: savedClonedVoiceId || undefined,
              testMode: true,
            }),
          });

          if (res.ok) {
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("audio") || contentType.includes("mpeg") || contentType.includes("wav")) {
              const provider = res.headers.get("X-TTS-Provider") || "unknown";
              console.log(`[JARVIS] TTS using: ${provider}, chunk ${chunkIndex + 1}/${chunks.length}`);
              setTtsProvider(provider);
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
          // Server TTS failed — get debug info
          let errorDetail = "";
          try {
            const errorJson = await res.json();
            errorDetail = errorJson.debug ? errorJson.debug.join("\n") : JSON.stringify(errorJson);
            console.warn(`[JARVIS] Server TTS FAILED! Debug:\n${errorDetail}`);
            // Show debug info to user
            setTtsTestResult(`❌ TTS فیل! تفصیلات:\n${errorDetail}`);
          } catch {
            try { errorDetail = await res.text(); } catch {}
            console.warn(`[JARVIS] Server TTS failed (status: ${res.status}): ${errorDetail.substring(0, 200)}`);
          }
          
          // Fall back to browser TTS for remaining text
          const remainingText = chunks.slice(chunkIndex).join(" ").trim();
          if (remainingText) {
            if (lang === "ur" || lang === "mixed") {
              speakUrduCloud(remainingText, emotion, onDone);
            } else {
              speakWithBrowser(remainingText, "en", emotion, null, onDone);
            }
          } else {
            setIsSpeaking(false);
            isSpeakingRef.current = false;
            speakQueueRef.current = false;
            setTtsProvider("");
            onDone?.();
          }
          return;
        } catch (err) {
          console.warn("[JARVIS] Server TTS error:", err);
          if (lang === "ur" || lang === "mixed") {
            speakUrduCloud(text, emotion, onDone);
          } else {
            speakWithBrowser(text, "en", emotion, null, onDone);
          }
          return;
        }
      };

      await playChunk();
    } catch {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      speakQueueRef.current = false;
      setTtsProvider("");
      if (lang === "ur" || lang === "mixed") {
        speakUrduCloud(text, emotion, onDone);
      } else {
        speakWithBrowser(text, "en", emotion, null, onDone);
      }
    }
  }, [speakUrduCloud, speakWithBrowser]);

  // ===== TEST TTS — Diagnose why natural voice isn't working =====
  const testTTS = useCallback(async () => {
    setTtsTesting(true);
    setTtsTestResult("🔄 ٹیسٹ جاری ہے...");

    try {
      const elevenlabsKey = localStorage.getItem("jarvis_elevenlabs_key") || "";
      const sarvamKey = localStorage.getItem("jarvis_sarvam_key") || "";
      const openaiKey = localStorage.getItem("jarvis_openai_tts_key") ||
        (localStorage.getItem("jarvis_api_keys") ?
          JSON.parse(localStorage.getItem("jarvis_api_keys") || "{}").openai : "") || "";
      const allOpenAIKeys = [openaiKey, localStorage.getItem("jarvis_openai_extra_keys") || ""]
        .join(",").split(",").map(k => k.trim()).filter(k => k.length > 0).join(",");

      const testText = "سلام، میں جاروس ہوں، آپ کا ذاتی ساتھی";
      
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: testText,
          lang: "ur",
          emotion: "normal",
          elevenlabsKey: elevenlabsKey || undefined,
          sarvamKey: sarvamKey || undefined,
          openaiKey: allOpenAIKeys || undefined,
        }),
      });

      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        const provider = res.headers.get("X-TTS-Provider") || "unknown";
        const debugHeader = res.headers.get("X-TTS-Debug") || "";
        
        if (contentType.includes("audio")) {
          const blob = await res.blob();
          // Play the test audio
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => URL.revokeObjectURL(url);
          audio.play();
          
          setTtsTestResult(`✅ کامیاب! آواز: ${provider}\n${debugHeader ? "Debug: " + decodeURIComponent(debugHeader) : ""}`);
        } else {
          // JSON response (error)
          const json = await res.json();
          setTtsTestResult(`⚠️ غیر متوقع جواب: ${JSON.stringify(json).substring(0, 500)}`);
        }
      } else {
        // Error response - get debug info
        try {
          const errorJson = await res.json();
          const debugLines = errorJson.debug || [];
          setTtsTestResult(`❌ TTS فیل! تفصیلات:\n${debugLines.join("\n")}`);
        } catch {
          setTtsTestResult(`❌ HTTP Error ${res.status}`);
        }
      }
    } catch (err: any) {
      setTtsTestResult(`❌ نیٹورک ایرر: ${err?.message || err}`);
    } finally {
      setTtsTesting(false);
    }
  }, []);

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
      // Urdu — use happy emotion for warm, natural tone
      speakServerTTS(cleanText, "ur", "happy", onDone);
    } else {
      const hasAnyTTSKey = localStorage.getItem("jarvis_elevenlabs_key") ||
        localStorage.getItem("jarvis_sarvam_key") ||
        localStorage.getItem("jarvis_openai_tts_key") ||
        (localStorage.getItem("jarvis_api_keys") ?
          JSON.parse(localStorage.getItem("jarvis_api_keys") || "{}").openai : "");
      if (hasAnyTTSKey) {
        speakServerTTS(cleanText, "en", emotion, onDone);
      } else {
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

  // ===== VOICE CLONING SYSTEM — اپنی آواز کلون کرنا =====
  const startVoiceCloneRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      voiceChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(voiceChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          setVoiceCloneSamples(prev => [...prev, base64]);
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      setVoiceCloneRecording(true);
    } catch (err: any) {
      alert("مائیک رس نہیں ہو سکا: " + (err?.message || err));
    }
  }, []);

  const stopVoiceCloneRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setVoiceCloneRecording(false);
    }
  }, []);

  const cloneMyVoice = useCallback(async () => {
    if (voiceCloneSamples.length === 0) {
      alert("پہلے اپنی آواز ریکارڈ کریں — کم از کم 3 نمونے چاہیے");
      return;
    }

    const elevenlabsKey = localStorage.getItem("jarvis_elevenlabs_key") || "";
    if (!elevenlabsKey) {
      alert("ElevenLabs API Key چاہیے وائس کلوننگ کے لیے۔ Settings میں ڈالیں۔");
      return;
    }

    setVoiceCloneStatus("🔄 آواز کلون ہو رہی ہے...");

    try {
      const res = await fetch("/api/voice-clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clone",
          elevenlabsKey,
          voiceName: "JARVIS My Voice",
          voiceDescription: "My personal voice for JARVIS — natural, emotional, romantic Urdu/English speaking style",
          voiceSamples: voiceCloneSamples,
        }),
      });

      const data = await res.json();
      if (data.success && data.voice_id) {
        setClonedVoiceId(data.voice_id);
        localStorage.setItem("jarvis_cloned_voice_id", data.voice_id);
        setVoiceCloneStatus(`✅ آواز کامیابی سے کلون ہو گئی! Voice ID: ${data.voice_id}`);
      } else {
        setVoiceCloneStatus(`❌ ${data.message || "کلوننگ فیل ہوئی"}`);
      }
    } catch (err: any) {
      setVoiceCloneStatus(`❌ ایرر: ${err?.message || err}`);
    }
  }, [voiceCloneSamples]);

  const fetchMyVoices = useCallback(async () => {
    const elevenlabsKey = localStorage.getItem("jarvis_elevenlabs_key") || "";
    if (!elevenlabsKey) return;

    try {
      const res = await fetch("/api/voice-clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_voices", elevenlabsKey }),
      });
      const data = await res.json();
      if (data.success) {
        setDiscoveredVoices(data.voices);
      }
    } catch {}
  }, []);

  const selectClonedVoice = useCallback((voiceId: string) => {
    setClonedVoiceId(voiceId);
    localStorage.setItem("jarvis_cloned_voice_id", voiceId);
    setVoiceCloneStatus(`✅ آواز سیٹ ہو گئی! Voice ID: ${voiceId}`);
  }, []);

  // ===== STORY RECORDING SYSTEM =====
  const recordStory = useCallback(async (storyText: string, title: string) => {
    if (!storyText.trim()) return;
    setIsRecordingStory(true);

    try {
      const elevenlabsKey = localStorage.getItem("jarvis_elevenlabs_key") || "";
      const sarvamKey = localStorage.getItem("jarvis_sarvam_key") || "";
      const openaiKey = localStorage.getItem("jarvis_openai_tts_key") ||
        (localStorage.getItem("jarvis_api_keys") ?
          JSON.parse(localStorage.getItem("jarvis_api_keys") || "{}").openai : "") || "";
      const allOpenAIKeys = [openaiKey, localStorage.getItem("jarvis_openai_extra_keys") || ""]
        .join(",").split(",").map(k => k.trim()).filter(k => k.length > 0).join(",");

      // For story, always use Urdu for natural narration
      const lang = detectLanguage(storyText);
      const ttsLang = (lang === "ur" || lang === "mixed") ? "ur" : "en";

      const chunks = splitTextChunks(storyText, 4000);
      const audioBlobs: Blob[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i].trim();
        if (!chunk) continue;

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: chunk.substring(0, 5000),
            lang: ttsLang,
            emotion: "normal",
            elevenlabsKey: elevenlabsKey || undefined,
            sarvamKey: sarvamKey || undefined,
            openaiKey: allOpenAIKeys || undefined,
          }),
        });

        if (res.ok) {
          const contentType = res.headers.get("content-type") || "";
          if (contentType.includes("audio") || contentType.includes("mpeg") || contentType.includes("wav")) {
            const blob = await res.blob();
            audioBlobs.push(blob);
            console.log(`[STORY] Chunk ${i + 1}/${chunks.length} recorded, provider: ${res.headers.get("X-TTS-Provider")}`);
          }
        }
      }

      if (audioBlobs.length > 0) {
        // Merge all audio blobs into one
        const combinedBlob = new Blob(audioBlobs, { type: "audio/mpeg" });
        const url = URL.createObjectURL(combinedBlob);

        // Create download link
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title || "story"}_${Date.now()}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Also save to localStorage for "library"
        const storyData = {
          title: title || "بے نام کہانی",
          date: new Date().toISOString(),
          audioUrl: url,
          textPreview: storyText.substring(0, 200),
        };
        const existingStories = JSON.parse(localStorage.getItem("jarvis_stories") || "[]");
        existingStories.push(storyData);
        localStorage.setItem("jarvis_stories", JSON.stringify(existingStories));

        console.log(`[STORY] Story recorded successfully! ${audioBlobs.length} chunks`);
      } else {
        alert("کہانی ریکارڈ نہیں ہو سکی۔ براہ کرم TTS API keys چیک کریں۔");
      }
    } catch (err) {
      console.error("[STORY] Recording error:", err);
      alert("کہانی ریکارڈ کرنے میں مسئلہ ہوا۔");
    } finally {
      setIsRecordingStory(false);
    }
  }, []);

  // ===== CLOUD STT — Transcribe Audio via /api/stt =====
  const transcribeAudio = useCallback(async (audioBlob: Blob, autoSend: boolean) => {
    try {
      console.log(`[JARVIS STT] Transcribing audio: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });
      const base64Audio = await base64Promise;
      if (!base64Audio || base64Audio.length < 100) {
        console.warn("[JARVIS STT] Audio too short");
        setIsRecording(false); setIsListening(false);
        if (conversationModeRef.current && !isLoadingRef.current) {
          setTimeout(() => { if (conversationModeRef.current && !isSpeakingRef.current) startListeningRef.current(true); }, 500);
        }
        return;
      }
      const savedKeys = localStorage.getItem("jarvis_api_keys");
      const parsedKeys = savedKeys ? JSON.parse(savedKeys) : {};
      const groqKey = parsedKeys.groq || "";
      const openaiKey = parsedKeys.openai || "";
      if (!groqKey && !openaiKey) {
        setIsRecording(false); setIsListening(false);
        alert("آواز سننے کے لیے Groq یا OpenAI API Key چاہیے۔ Settings میں ڈالیں۔");
        return;
      }
      setIsListening(true);
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64Audio, mimeType: audioBlob.type || "audio/webm", language: undefined, groqKey: groqKey || undefined, openaiKey: openaiKey || undefined }),
      });
      const data = await res.json();
      if (data.success && data.text && data.text.trim()) {
        const transcribedText = data.text.trim();
        console.log(`[JARVIS STT] Transcribed (${data.provider}): "${transcribedText}"`);
        setInput(transcribedText);
        if (autoSend || conversationModeRef.current) {
          setTimeout(() => sendMessageDirectRef.current(transcribedText), 200);
        }
      } else {
        if (conversationModeRef.current && !isLoadingRef.current) {
          setTimeout(() => { if (conversationModeRef.current && !isSpeakingRef.current) startListeningRef.current(true); }, 500);
        }
      }
    } catch (err) {
      console.error("[JARVIS STT] Transcription error:", err);
      if (conversationModeRef.current && !isLoadingRef.current) {
        setTimeout(() => { if (conversationModeRef.current && !isSpeakingRef.current) startListeningRef.current(true); }, 800);
      }
    } finally {
      setIsRecording(false); setIsListening(false);
    }
  }, []);

  // ===== CLOUD STT — Stop Recording and Transcribe =====
  const stopCloudListeningAndTranscribe = useCallback(() => {
    if (sttSilenceTimerRef.current) { clearTimeout(sttSilenceTimerRef.current); sttSilenceTimerRef.current = null; }
    if (sttMediaRecorderRef.current && sttMediaRecorderRef.current.state === "recording") { sttMediaRecorderRef.current.stop(); }
  }, []);

  // ===== STT — Start Listening (Dual Path: Chrome STT or Cloud Whisper STT) =====
  const startListening = useCallback((autoSend: boolean = false) => {
    if (isRecording) return;

    // In Electron, ALWAYS use Cloud Whisper STT (webkitSpeechRecognition doesn't work properly in Electron)
    const SpeechRecognition = isElectron() ? null : ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SpeechRecognition) {
      // Use Cloud Whisper STT for Electron/Firefox
      console.log("[JARVIS STT] Using Cloud Whisper STT");
      sttAutoSendRef.current = autoSend;
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          sttStreamRef.current = stream;
          sttChunksRef.current = [];
          const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
          let selectedMime = "";
          for (const mime of mimeTypes) { if (MediaRecorder.isTypeSupported(mime)) { selectedMime = mime; break; } }
          const mediaRecorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
          sttMediaRecorderRef.current = mediaRecorder;
          mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) sttChunksRef.current.push(e.data); };
          mediaRecorder.onstop = () => {
            if (sttStreamRef.current) { sttStreamRef.current.getTracks().forEach(t => t.stop()); sttStreamRef.current = null; }
            if (sttChunksRef.current.length > 0) {
              const audioBlob = new Blob(sttChunksRef.current, { type: selectedMime || "audio/webm" });
              transcribeAudio(audioBlob, sttAutoSendRef.current);
            } else {
              setIsRecording(false); setIsListening(false);
              if (conversationModeRef.current && !isLoadingRef.current) {
                setTimeout(() => { if (conversationModeRef.current && !isSpeakingRef.current) startListeningRef.current(true); }, 500);
              }
            }
            sttMediaRecorderRef.current = null;
          };
          mediaRecorder.onerror = () => { setIsRecording(false); setIsListening(false); };
          mediaRecorder.start(500);
          setIsRecording(true); setIsListening(true);
          console.log(`[JARVIS STT] Recording started (mime: ${selectedMime || "default"})`);
          // Silence detection
          try {
            const audioContext = new AudioContext();
            sttAudioContextRef.current = audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);
            sttAnalyserRef.current = analyser;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            let silenceStart = Date.now();
            let hasSpeech = false;
            const detectSilence = () => {
              if (!sttMediaRecorderRef.current || sttMediaRecorderRef.current.state !== "recording") return;
              analyser.getByteFrequencyData(dataArray);
              const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
              if (average > 10) { silenceStart = Date.now(); hasSpeech = true; }
              else if (hasSpeech) {
                const silenceDuration = Date.now() - silenceStart;
                const convSilenceTimeout = conversationModeRef.current ? 4000 : 2500;
                if (silenceDuration > convSilenceTimeout) { stopCloudListeningAndTranscribe(); return; }
              }
              if (Date.now() - silenceStart > 30000 && !hasSpeech) { stopCloudListeningAndTranscribe(); return; }
              requestAnimationFrame(detectSilence);
            };
            detectSilence();
          } catch {
            sttSilenceTimerRef.current = setTimeout(() => { stopCloudListeningAndTranscribe(); }, conversationModeRef.current ? 8000 : 6000);
          }
        })
        .catch((err) => {
          console.error("[JARVIS STT] Microphone access denied:", err);
          setIsRecording(false); setIsListening(false);
          alert("مائیکروفون رس نہیں ہو سکا۔ براہ کرم مائیکروفون کی اجازت دیں۔\n\nError: " + (err?.message || err));
        });
      return;
    }

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
          setIsRecording(false);
          setIsListening(false);
          setInput(finalTranscript);
          try { recognition.stop(); } catch {}
          if (autoSend || conversationModeRef.current) {
            setTimeout(() => sendMessageDirectRef.current(finalTranscript), 200);
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
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        lastTranscript = finalTranscript;
        hasFinalResult = true;
        setIsRecording(false);
        setIsListening(false);
        setInput(finalTranscript.trim());
        try { recognition.stop(); } catch {}
        if (autoSend || conversationModeRef.current) {
          setTimeout(() => sendMessageDirectRef.current(finalTranscript.trim()), 200);
        }
      } else if (interimTranscript) {
        lastTranscript = interimTranscript;
        setInput(interimTranscript);
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
            startListeningRef.current(true);
          }
        }, 800);
      }
    };

    recognition.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      if (conversationModeRef.current && !hasFinalResult && !isLoadingRef.current) {
        setTimeout(() => {
          if (conversationModeRef.current && !isSpeakingRef.current) {
            startListeningRef.current(true);
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
    resetSilenceTimer();
  }, [isRecording, cancelAllSpeech, transcribeAudio, stopCloudListeningAndTranscribe]);

  // ===== STOP ALL LISTENING — Both Chrome STT and Cloud STT =====
  const stopAllListening = useCallback(() => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
    if (sttMediaRecorderRef.current && sttMediaRecorderRef.current.state === "recording") { sttMediaRecorderRef.current.stop(); }
    if (sttStreamRef.current) { sttStreamRef.current.getTracks().forEach(t => t.stop()); sttStreamRef.current = null; }
    if (sttSilenceTimerRef.current) { clearTimeout(sttSilenceTimerRef.current); sttSilenceTimerRef.current = null; }
    if (sttAudioContextRef.current) { try { sttAudioContextRef.current.close(); } catch {} sttAudioContextRef.current = null; }
    setIsRecording(false); setIsListening(false);
  }, []);

  // ===== PRE-SCAN ACTION SYSTEM — Execute actions BEFORE AI call =====
  const preScanAndExecuteAction = useCallback(async (text: string): Promise<{ actionExecuted: boolean; actionDescription: string; modifiedMessage: string }> => {
    const electron = getElectronAPI();
    if (!electron) return { actionExecuted: false, actionDescription: "", modifiedMessage: text };

    const lower = text.toLowerCase();
    let query = '';

    // YouTube / Video
    if (/(یوٹیوب|youtube)\s*(کھول|open|چلاؤ|لگاؤ|play|شروع|سروچ|search)/i.test(lower) ||
        /(یوٹیوب|youtube)\s*(تلاوت|tilawat|قرآن|quran|اذان|azan|نعت|naat|حمد|hamd)/i.test(lower)) {
      if (/تلاوت|tilawat|قرآن|quran/i.test(lower)) query = 'Quran Tilawat with Urdu Translation';
      else if (/اذان|azan/i.test(lower)) query = 'Beautiful Azan - Adhan';
      else if (/نعت|naat/i.test(lower)) query = 'Beautiful Naat Sharif';
      else if (/حمد|hamd/i.test(lower)) query = 'Hamd e Bari Taala';
      else {
        const ytMatch = lower.match(/(?:یوٹیوب|youtube)\s*(?:پر|on)?\s*(?:کھول|open|چلاؤ|لگاؤ|play|شروع|سروچ|search)?\s*(.*)/i);
        query = ytMatch?.[1] || lower.replace(/یوٹیوب|youtube|کھول|open|چلاؤ|لگاؤ|play|شروع|پر|سروچ|search/gi, '').trim() || 'Islamic';
      }
      try { await electron.searchYoutube(query); } catch {}
      return { actionExecuted: true, actionDescription: `YouTube پر "${query}" کھول دیا`, modifiedMessage: `میں نے یوٹیوب پر ${query} کھولنے کو کہا تھا، اب مختصر جواب دو` };
    }

    // Play audio/music
    if (/(چلاؤ|لگاؤ|play|شروع|بجاؤ)\s*(گانا|song|میوزک|music|آڈیو|audio|اذان|azan|تلاوت|tilawat|نعت|naat|ویدیو|video)/i.test(lower)) {
      if (/تلاوت|tilawat|قرآن/i.test(lower)) query = 'Quran Tilawat';
      else if (/اذان|azan/i.test(lower)) query = 'Beautiful Azan';
      else if (/نعت|naat/i.test(lower)) query = 'Naat Sharif Urdu';
      else { const m = lower.match(/(?:چلاؤ|لگاؤ|play|شروع|بجاؤ)\s+(.*)/i); query = m?.[1] || 'Islamic audio'; }
      try { await electron.searchYoutube(query); } catch {}
      return { actionExecuted: true, actionDescription: `"${query}" چلا دیا`, modifiedMessage: `میں نے ${query} چلانے کو کہا تھا، اب مختصر جواب دو` };
    }

    // Open URL/website
    const urlMatch = lower.match(/(?:کھول|open|چلاؤ|جواؤ)\s*(https?:\/\/\S+)/i) || lower.match(/(?:کھول|open|چلاؤ)\s*(?:وہبسائٹ|website|site)\s+(\S+)/i);
    if (urlMatch) {
      let url = urlMatch[1] || urlMatch[0];
      if (!url.startsWith('http')) url = 'https://' + url;
      try { await electron.openUrl(url); } catch {}
      return { actionExecuted: true, actionDescription: `${url} کھول دیا`, modifiedMessage: `میں نے ${url} کھولنے کو کہا تھا، اب مختصر جواب دو` };
    }

    // Open app
    const appMatch = lower.match(/(?:کھول|open|چلاؤ|شروع)\s*(?:ایپ|app|سافٹویئر|program|ایپلیکیشن)?\s*(chrome|notepad|calculator|paint|word|excel|vscode|code|telegram|whatsapp|firefox|spotify|vlc|discord)/i);
    if (appMatch) {
      try { await electron.openApp(appMatch[1]); } catch {}
      return { actionExecuted: true, actionDescription: `${appMatch[1]} کھول دیا`, modifiedMessage: `میں نے ${appMatch[1]} کھولنے کو کہا تھا، اب مختصر جواب دو` };
    }

    // System commands
    if (/شٹ\s*ڈاؤن|shutdown|بند\s*کرو/i.test(lower)) { try { await electron.systemCommand('shutdown'); } catch {} return { actionExecuted: true, actionDescription: "شٹ ڈاؤن شروع کر دیا", modifiedMessage: "شٹ ڈاؤن کا حکم دیا، اب مختصر جواب دو" }; }
    if (/ری\s*سٹارٹ|restart|دوبارہ\s*شروع/i.test(lower)) { try { await electron.systemCommand('restart'); } catch {} return { actionExecuted: true, actionDescription: "ری سٹارٹ شروع کر دیا", modifiedMessage: "ری سٹارٹ کا حکم دیا، اب مختصر جواب دو" }; }
    if (/سلیپ|sleep/i.test(lower)) { try { await electron.systemCommand('sleep'); } catch {} return { actionExecuted: true, actionDescription: "سلیپ موڈ", modifiedMessage: "سلیپ کا حکم دیا، اب مختصر جواب دو" }; }
    if (/لاک|lock/i.test(lower)) { try { await electron.systemCommand('lock'); } catch {} return { actionExecuted: true, actionDescription: "سسٹم لاک", modifiedMessage: "لاک کا حکم دیا، اب مختصر جواب دو" }; }
    if (/والیوم\s*اپ|volume\s*up|آواز\s*زیادہ/i.test(lower)) { try { await electron.systemCommand('volume-up'); } catch {} return { actionExecuted: true, actionDescription: "والیوم بڑھا دیا", modifiedMessage: "والیوم اپ کا حکم دیا، اب مختصر جواب دو" }; }
    if (/والیوم\s*ڈاؤن|volume\s*down|آواز\s*کم/i.test(lower)) { try { await electron.systemCommand('volume-down'); } catch {} return { actionExecuted: true, actionDescription: "والیوم کم کر دیا", modifiedMessage: "والیوم ڈاؤن کا حکم دیا، اب مختصر جواب دو" }; }
    if (/(مائیوٹ|میوٹ|خاموش|mute|silent)/i.test(lower)) { try { await electron.systemCommand('mute'); } catch {} return { actionExecuted: true, actionDescription: "خاموش کر دیا", modifiedMessage: "میوٹ کا حکم دیا، اب مختصر جواب دو" }; }

    // Open folder
    const folderMatch = lower.match(/(?:فولڈر|folder|ڈائرکٹری)\s+(.*)/i);
    if (folderMatch) { try { await electron.openFolder(folderMatch[1].trim()); } catch {} return { actionExecuted: true, actionDescription: `فولڈر کھول دیا: ${folderMatch[1]}`, modifiedMessage: `فولڈر کھولنے کو کہا تھا، اب مختصر جواب دو` }; }

    return { actionExecuted: false, actionDescription: "", modifiedMessage: text };
  }, []);

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

    // Pre-scan for desktop actions — execute BEFORE AI call
    const { actionExecuted, actionDescription, modifiedMessage } = await preScanAndExecuteAction(text.trim());
    if (actionExecuted) {
      const actionMsg: JarvisMessage = {
        id: `msg_action_${Date.now()}`,
        role: "assistant",
        content: `✅ ${actionDescription}`,
        emotion: "happy" as EmotionType,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, actionMsg]);
    }
    const messageForAI = modifiedMessage;

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
          message: messageForAI,
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
                        startListeningRef.current(true);
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
        setTimeout(() => { if (conversationModeRef.current) startListeningRef.current(true); }, 1000);
      }
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [userId, apiKeys, activeProvider, speakText, cancelAllSpeech, preScanAndExecuteAction]);

  const sendMessage = useCallback((text: string) => sendMessageDirect(text, uploadedFile || undefined), [sendMessageDirect, uploadedFile]);

  // Ref syncs for circular dependencies
  useEffect(() => { startListeningRef.current = startListening; }, [startListening]);
  useEffect(() => { sendMessageDirectRef.current = sendMessageDirect; }, [sendMessageDirect]);

  // ===== CONVERSATION MODE TOGGLE =====
  const toggleConversationMode = useCallback(() => {
    const newMode = !conversationMode;
    setConversationMode(newMode);
    conversationModeRef.current = newMode;

    if (newMode) {
      cancelAllSpeech();
      setTimeout(() => startListening(true), 300);
    } else {
      cancelAllSpeech();
      stopAllListening();
    }
  }, [conversationMode, startListening, cancelAllSpeech, stopAllListening]);

  // ===== MANUAL VOICE TOGGLE =====
  const toggleRecording = useCallback(() => {
    if (conversationMode) return;
    if (isRecording) {
      // Stop whichever STT path is active
      if (sttMediaRecorderRef.current && sttMediaRecorderRef.current.state === "recording") {
        stopCloudListeningAndTranscribe();
      } else {
        recognitionRef.current?.stop();
      }
      setIsRecording(false);
      setIsListening(false);
    } else {
      startListening(true);
    }
  }, [isRecording, conversationMode, startListening, stopCloudListeningAndTranscribe]);

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
    { icon: "📖", text: "Record Story", prompt: "", isStoryMode: true },
    { icon: "🎭", text: "Clone Voice", prompt: "", isVoiceClone: true },
    { icon: "🎯", text: "Fiverr Gig", prompt: "Fiverr pe web development ka gig banao — complete SEO, title, description, 3 packages, image prompts, tags, aur FAQs ke saath" },
    { icon: "🔍", text: "Hunt Jobs", prompt: "Mujhe jobs dhundho — web development, frontend, React, Next.js ke liye sab main platforms pe jobs talaash karo" },
    { icon: "🚀", text: "Auto Freelance", prompt: "Poora freelancing pipeline khud chalao — market research, gig banao, jobs dhundho, apply karo, client se baat karo, report do" },
    { icon: "💰", text: "Gig SEO", prompt: "Fiverr SEO analysis karo web development category ke liye — best keywords, tags, competitor analysis, optimization tips" },
    { icon: "💬", text: "Client Chat", prompt: "Client se WhatsApp pe baat karni hai — help me chat naturally as Rayan Sir" },
    { icon: "📝", text: "Proposal", prompt: "Winning proposal likho — job description de raha hoon" },
    { icon: "🤖", text: "Automation", prompt: "Mere liye complete automation plan banao — khud jobs dhundho, gige banao, apply karo, client se baat karo, project complete karo" },
  ];

  const emotionEmojis: Record<EmotionType, string> = {
    happy: "😊", encouraging: "💪", serious: "⚡",
    sympathetic: "💙", surprised: "😲", normal: "🙂",
  };

  const providerLabels: Record<LLMProvider, string> = {
    groq: "Groq", gemini: "Gemini", openai: "OpenAI", zai: "ZAI",
    xai: "xAI / Grok", anthropic: "Claude",
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
          <button className="btn-icon" onClick={() => setShowVoiceClone(!showVoiceClone)} title="Voice Clone" style={{color: clonedVoiceId ? "#22c55e" : undefined}}>🎭</button>
          <button className="btn-icon" onClick={() => setShowStoryPanel(!showStoryPanel)} title="Story Recorder">📖</button>
          <button className="btn-icon" onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
        </div>
      </header>

      {/* TTS Provider Indicator + Test Button */}
      {(ttsProvider || ttsTestResult) && (
        <div style={{
          padding: "4px 12px",
          background: ttsProvider && (ttsProvider.includes("google") || ttsProvider.includes("Google") || ttsProvider.includes("Browser") || ttsProvider.includes("Chrome"))
            ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
          borderBottom: ttsProvider && (ttsProvider.includes("google") || ttsProvider.includes("Google") || ttsProvider.includes("Browser") || ttsProvider.includes("Chrome"))
            ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(34,197,94,0.3)",
          fontSize: "11px",
          color: ttsProvider && (ttsProvider.includes("google") || ttsProvider.includes("Google") || ttsProvider.includes("Browser") || ttsProvider.includes("Chrome"))
            ? "#ef4444" : "#22c55e",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexWrap: "wrap",
        }}>
          {ttsProvider && (
            <>
              <span>{ttsProvider.includes("google") || ttsProvider.includes("Google") || ttsProvider.includes("Browser") || ttsProvider.includes("Chrome") ? "⚠️" : "✅"}</span>
              <span>آواز: {ttsProvider}</span>
              {(ttsProvider.includes("google") || ttsProvider.includes("Google") || ttsProvider.includes("Browser") || ttsProvider.includes("Chrome")) && (
                <button onClick={testTTS} disabled={ttsTesting} style={{
                  background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)",
                  borderRadius: "4px", color: "#ef4444", cursor: "pointer",
                  padding: "2px 8px", fontSize: "10px", fontWeight: 600,
                }}>
                  {ttsTesting ? "⏳ ٹیسٹ..." : "🔧 ٹیسٹ آواز"}
                </button>
              )}
            </>
          )}
          {ttsTestResult && (
            <pre style={{
              fontSize: "10px", margin: "4px 0 0", padding: "6px 8px",
              background: "rgba(0,0,0,0.3)", borderRadius: "4px",
              whiteSpace: "pre-wrap", width: "100%", maxHeight: "200px",
              overflow: "auto", color: ttsTestResult.startsWith("✅") ? "#22c55e" : "#ef4444",
            }}>{ttsTestResult}</pre>
          )}
        </div>
      )}

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

      {/* Voice Cloning Panel */}
      {showVoiceClone && (
        <div style={{
          padding: "16px",
          background: "rgba(236,72,153,0.1)",
          borderBottom: "1px solid rgba(236,72,153,0.3)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#ec4899" }}>🎭 وائس کلونر — اپنی آواز مستقل بنائیں</h3>
            <button onClick={() => setShowVoiceClone(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px" }}>✕</button>
          </div>
          
          {clonedVoiceId && (
            <div style={{ padding: "8px 12px", background: "rgba(34,197,94,0.15)", borderRadius: "8px", marginBottom: "12px", fontSize: "12px", color: "#22c55e" }}>
              ✅ کلون شدہ آواز فعال ہے — JARVIS اب آپ کی آواز میں بولے گا!
              <br />Voice ID: {clonedVoiceId.substring(0, 16)}...
            </div>
          )}

          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
            اپنی آواز ریکارڈ کریں — JARVIS ہمیشہ آپ کی آواز میں بولے گا۔ API Keys کی ضرورت نہیں پڑے گی مستقبل میں!
          </div>

          {/* Recording controls */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
            <button
              onClick={voiceCloneRecording ? stopVoiceCloneRecording : startVoiceCloneRecording}
              style={{
                padding: "8px 16px",
                background: voiceCloneRecording ? "rgba(239,68,68,0.2)" : "rgba(236,72,153,0.2)",
                border: voiceCloneRecording ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(236,72,153,0.4)",
                borderRadius: "8px",
                color: voiceCloneRecording ? "#ef4444" : "#ec4899",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {voiceCloneRecording ? "⏹️ رکیں" : "🎙️ آواز ریکارڈ کریں"}
            </button>

            <span style={{ fontSize: "11px", color: "var(--text-muted)", alignSelf: "center" }}>
              نمونے: {voiceCloneSamples.length}/5 (کم از کم 3 چاہیے)
            </span>

            {voiceCloneSamples.length >= 1 && (
              <button
                onClick={() => setVoiceCloneSamples([])}
                style={{
                  padding: "6px 12px",
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: "6px",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: "11px",
                }}
              >
                🗑️ صاف کریں
              </button>
            )}
          </div>

          {/* Recording tips */}
          {voiceCloneRecording && (
            <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.1)", borderRadius: "8px", marginBottom: "12px", fontSize: "11px", color: "#ef4444" }}>
              🔴 ریکارڈنگ جاری ہے... قدرتی انداز میں بولیے۔ کچھ بھی پڑھیں — اخبار، کہانی، یا اپنی باتیں۔ 30 سیکنڈ سے زیادہ ریکارڈ کریں۔
            </div>
          )}

          {/* Clone button */}
          {voiceCloneSamples.length >= 1 && (
            <button
              onClick={cloneMyVoice}
              disabled={voiceCloneSamples.length < 1}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, #ec4899, #8b5cf6)",
                border: "none",
                borderRadius: "8px",
                color: "white",
                cursor: voiceCloneSamples.length >= 1 ? "pointer" : "not-allowed",
                fontSize: "13px",
                fontWeight: 600,
                width: "100%",
                opacity: voiceCloneSamples.length >= 1 ? 1 : 0.5,
              }}
            >
              🎭 آواز کلون کریں ({voiceCloneSamples.length} نمونے)
            </button>
          )}

          {voiceCloneStatus && (
            <div style={{ marginTop: "8px", fontSize: "12px", color: voiceCloneStatus.startsWith("✅") ? "#22c55e" : "#ef4444" }}>
              {voiceCloneStatus}
            </div>
          )}

          {/* Fetch existing voices */}
          <div style={{ marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "12px" }}>
            <button
              onClick={fetchMyVoices}
              style={{
                padding: "6px 12px",
                background: "rgba(139,92,246,0.2)",
                border: "1px solid rgba(139,92,246,0.4)",
                borderRadius: "6px",
                color: "#8b5cf6",
                cursor: "pointer",
                fontSize: "11px",
              }}
            >
              📋 میری آوازیں دیکھیں
            </button>

            {discoveredVoices.length > 0 && (
              <div style={{ marginTop: "8px", maxHeight: "150px", overflow: "auto" }}>
                {discoveredVoices.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => selectClonedVoice(v.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "6px 10px",
                      margin: "4px 0",
                      background: clonedVoiceId === v.id ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.05)",
                      border: clonedVoiceId === v.id ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "6px",
                      color: clonedVoiceId === v.id ? "#22c55e" : "var(--text-primary)",
                      cursor: "pointer",
                      fontSize: "11px",
                      textAlign: "left",
                    }}
                  >
                    {v.category === "cloned" ? "🎭" : v.gender === "female" ? "👩" : "👨"} {v.name}
                    <span style={{ color: "var(--text-muted)", marginLeft: "8px" }}>
                      ({v.category}, {v.gender})
                    </span>
                    {clonedVoiceId === v.id && " ✅"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Story Recording Panel */}
      {showStoryPanel && (
        <div style={{
          padding: "16px",
          background: "rgba(139,92,246,0.1)",
          borderBottom: "1px solid rgba(139,92,246,0.3)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#8b5cf6" }}>📖 کہانی ریکارڈر</h3>
            <button onClick={() => setShowStoryPanel(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px" }}>✕</button>
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "10px" }}>
            کہانی لکھیں یا پیسٹ کریں — نیچرل آواز میں ریکارڈ ہوگی اور ڈاؤنلوڈ ہو جائے گی!
          </p>
          <input
            type="text"
            placeholder="کہانی کا عنوان..."
            value={storyTitle}
            onChange={(e) => setStoryTitle(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px", marginBottom: "8px",
              background: "var(--bg-primary)", border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "13px",
            }}
          />
          <textarea
            placeholder="یہاں کہانی لکھیں یا پیسٹ کریں..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", minHeight: "120px",
              background: "var(--bg-primary)", border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "13px",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
            <button
              onClick={() => recordStory(input, storyTitle)}
              disabled={!input.trim() || isRecordingStory}
              style={{
                background: isRecordingStory ? "rgba(139,92,246,0.3)" : "rgba(139,92,246,0.15)",
                border: "1px solid rgba(139,92,246,0.4)",
                borderRadius: "8px", color: "#8b5cf6", cursor: isRecordingStory ? "wait" : "pointer",
                padding: "8px 16px", fontSize: "13px", fontWeight: 600,
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              {isRecordingStory ? "⏳ ریکارڈ ہو رہی ہے..." : "🎙️ ریکارڈ کریں اور ڈاؤنلوڈ"}
            </button>
            <button
              onClick={() => {
                if (input.trim()) {
                  speakText(input, "normal");
                }
              }}
              disabled={!input.trim() || isRecordingStory}
              style={{
                background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: "8px", color: "var(--accent-primary)", cursor: "pointer",
                padding: "8px 16px", fontSize: "13px", fontWeight: 600,
              }}
            >
              🔊 صرف سنیں
            </button>
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
                  onClick={() => action.isConvMode ? toggleConversationMode() : action.isStoryMode ? setShowStoryPanel(true) : (action as any).isVoiceClone ? setShowVoiceClone(true) : sendMessage(action.prompt)}
                  disabled={!hasAnyKey && !action.isConvMode && !action.isStoryMode && !(action as any).isVoiceClone}
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

      {/* Input Area */}
      <div className="chat-input-area">
        {uploadedFile && (
          <div className="file-preview">
            <span>{uploadedFile.type.startsWith("image/") ? "🖼️" : "📄"}</span>
            <span>{uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)}KB)</span>
            <button className="file-preview-remove" onClick={() => setUploadedFile(null)}>✕</button>
          </div>
        )}

        <div className="chat-input-wrapper">
          <button className="btn-icon" onClick={() => fileInputRef.current?.click()} title="Upload file">
            📎
          </button>
          <input ref={fileInputRef} type="file" hidden
            accept="image/*,.pdf,.txt,.csv,.json,.md,.py,.js,.ts,.html,.css"
            onChange={handleFileUpload} />

          <button
            className={`btn-icon ${conversationMode ? "btn-conversation-active" : ""}`}
            onClick={toggleConversationMode}
            title={conversationMode ? "🎙️ Stop Voice Chat" : "🎧 Start Voice Chat (Conversation Mode)"}
            disabled={!hasAnyKey}
          >
            {conversationMode ? "🎙️" : "🎧"}
          </button>

          <button
            className={`btn-icon btn-voice ${isRecording ? "recording" : ""}`}
            onClick={toggleRecording}
            title={isRecording ? "Stop" : "🎤 Voice input (auto-sends)"}
            disabled={conversationMode}
          >
            {isRecording ? "⏹️" : "🎤"}
          </button>

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

// ============== SETTINGS PANEL — MULTI-KEY WITH ADD MORE ==============
function SettingsPanel({
  apiKeys, activeProvider, onSaveKeys, onSaveProvider, onClose,
}: {
  apiKeys: APIKeys;
  activeProvider: LLMProvider;
  onSaveKeys: (keys: APIKeys) => void;
  onSaveProvider: (provider: LLMProvider) => void;
  onClose: () => void;
}) {
  const parseKeysArray = (str: string): string[] => {
    if (!str || !str.trim()) return [""];
    const keys = str.split(",").map(k => k.trim()).filter(k => k.length > 0);
    return keys.length > 0 ? keys : [""];
  };

  const loadKeysArray = (storageKey: string, fallbackKey?: string): string[] => {
    if (typeof window === "undefined") return [""];
    const stored = localStorage.getItem(storageKey) || "";
    if (stored) return parseKeysArray(stored);
    if (fallbackKey) {
      const fallback = localStorage.getItem("jarvis_api_keys");
      if (fallback) {
        try {
          const parsed = JSON.parse(fallback);
          if (parsed[fallbackKey]) return parseKeysArray(parsed[fallbackKey]);
        } catch {}
      }
    }
    return [""];
  };

  const [groqKeys, setGroqKeys] = useState<string[]>(() => parseKeysArray(apiKeys.groq || ""));
  const [geminiKeys, setGeminiKeys] = useState<string[]>(() => parseKeysArray(apiKeys.gemini || ""));
  const [openaiKeys, setOpenaiKeys] = useState<string[]>(() => parseKeysArray(apiKeys.openai || ""));
  const [zaiKeys, setZaiKeys] = useState<string[]>(() => parseKeysArray(apiKeys.zai || ""));
  const [localProvider, setLocalProvider] = useState<LLMProvider>(activeProvider);

  // TTS keys
  const [elevenlabsKeys, setElevenlabsKeys] = useState<string[]>(() => loadKeysArray("jarvis_elevenlabs_key"));
  const [sarvamKeys, setSarvamKeys] = useState<string[]>(() => loadKeysArray("jarvis_sarvam_key"));

  const providers: Array<{ id: LLMProvider; name: string; keyPlaceholder: string; getKeyUrl: string; free: boolean; icon: string }> = [
    { id: "groq", name: "Groq (Llama 3.3 70B)", keyPlaceholder: "gsk_...", getKeyUrl: "https://console.groq.com", free: true, icon: "🆓" },
    { id: "gemini", name: "Google Gemini 1.5 Flash", keyPlaceholder: "AIza...", getKeyUrl: "https://aistudio.google.com/apikey", free: true, icon: "🆓" },
    { id: "openai", name: "OpenAI (GPT-4o Mini)", keyPlaceholder: "sk-...", getKeyUrl: "https://platform.openai.com/api-keys", free: false, icon: "💰" },
    { id: "zai", name: "ZAI (GLM-4 Flash)", keyPlaceholder: "your-zai-api-key", getKeyUrl: "https://open.bigmodel.cn", free: true, icon: "🆓" },
  ];

  const getKeysForProvider = (id: LLMProvider): string[] => {
    switch (id) {
      case "groq": return groqKeys;
      case "gemini": return geminiKeys;
      case "openai": return openaiKeys;
      case "zai": return zaiKeys;
      default: return [""];
    }
  };

  const setKeysForProvider = (id: LLMProvider, keys: string[]) => {
    switch (id) {
      case "groq": setGroqKeys(keys); break;
      case "gemini": setGeminiKeys(keys); break;
      case "openai": setOpenaiKeys(keys); break;
      case "zai": setZaiKeys(keys); break;
    }
  };

  const addKey = (id: LLMProvider | "elevenlabs" | "sarvam") => {
    if (id === "elevenlabs") { setElevenlabsKeys(prev => [...prev, ""]); return; }
    if (id === "sarvam") { setSarvamKeys(prev => [...prev, ""]); return; }
    setKeysForProvider(id, [...getKeysForProvider(id), ""]);
  };

  const removeKey = (id: LLMProvider | "elevenlabs" | "sarvam", index: number) => {
    if (id === "elevenlabs") {
      setElevenlabsKeys(prev => prev.length <= 1 ? [""] : prev.filter((_, i) => i !== index));
      return;
    }
    if (id === "sarvam") {
      setSarvamKeys(prev => prev.length <= 1 ? [""] : prev.filter((_, i) => i !== index));
      return;
    }
    const current = getKeysForProvider(id);
    setKeysForProvider(id, current.length <= 1 ? [""] : current.filter((_, i) => i !== index));
  };

  const updateKey = (id: LLMProvider | "elevenlabs" | "sarvam", index: number, value: string) => {
    if (id === "elevenlabs") {
      setElevenlabsKeys(prev => { const n = [...prev]; n[index] = value; return n; });
      return;
    }
    if (id === "sarvam") {
      setSarvamKeys(prev => { const n = [...prev]; n[index] = value; return n; });
      return;
    }
    const current = getKeysForProvider(id);
    const updated = [...current];
    updated[index] = value;
    setKeysForProvider(id, updated);
  };

  const joinKeys = (keys: string[]): string => {
    return keys.filter(k => k.trim().length > 0).join(",");
  };

  const countKeys = (keys: string[]): number => keys.filter(k => k.trim().length > 0).length;

  const handleSave = () => {
    const newKeys: APIKeys = {
      groq: joinKeys(groqKeys),
      gemini: joinKeys(geminiKeys),
      openai: joinKeys(openaiKeys),
      zai: joinKeys(zaiKeys),
    };
    onSaveKeys(newKeys);
    onSaveProvider(localProvider);
    localStorage.setItem("jarvis_elevenlabs_key", joinKeys(elevenlabsKeys));
    localStorage.setItem("jarvis_sarvam_key", joinKeys(sarvamKeys));
    onClose();
  };

  const KeyInputRow = ({ value, onChange, onRemove, placeholder, canRemove }: {
    value: string; onChange: (v: string) => void; onRemove: () => void;
    placeholder: string; canRemove: boolean;
  }) => (
    <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
      <input type="password" className="provider-input" style={{ marginBottom: 0, flex: 1 }}
        value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {canRemove && (
        <button onClick={onRemove} style={{
          background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: "6px", color: "#ef4444", cursor: "pointer", padding: "0 10px",
          fontSize: "16px", fontWeight: 600, lineHeight: "1",
        }} title="Remove key">✕</button>
      )}
    </div>
  );

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <h2>⚙️ API Settings</h2>
        <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>
          کم از کم ایک API Key ڈالیں۔ + Add More سے زیادہ keys ڈالیں — لیمٹ ختم ہو تو اگلی key خودکار چلے گی!
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
          {providers.map((p) => {
            const keys = getKeysForProvider(p.id);
            const hasKey = countKeys(keys) > 0;
            return (
              <option key={p.id} value={p.id} disabled={!hasKey}>
                {p.name} {!hasKey ? "(No Key)" : `✅ ${countKeys(keys)} key(s)`} {p.free ? "🆓" : "💰"}
              </option>
            );
          })}
        </select>

        {/* LLM Provider Keys */}
        {providers.map((provider) => {
          const keys = getKeysForProvider(provider.id);
          const validCount = countKeys(keys);
          return (
            <div key={provider.id} className="provider-card"
              style={{ borderColor: validCount > 0 ? "rgba(34,197,94,0.3)" : undefined }}>
              <div className="provider-header">
                <span className="provider-name">
                  {provider.icon} {provider.name}
                </span>
                {validCount > 0 && <span className="provider-saved">✅ {validCount} key(s)</span>}
              </div>
              {keys.map((key, idx) => (
                <KeyInputRow key={idx}
                  value={key}
                  onChange={(v) => updateKey(provider.id, idx, v)}
                  onRemove={() => removeKey(provider.id, idx)}
                  placeholder={provider.keyPlaceholder}
                  canRemove={keys.length > 1}
                />
              ))}
              <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                <button onClick={() => addKey(provider.id)} style={{
                  background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)",
                  borderRadius: "6px", color: "var(--accent-primary)", cursor: "pointer",
                  padding: "6px 12px", fontSize: "12px", fontWeight: 600,
                }}>+ Add More</button>
                <a href={provider.getKeyUrl} target="_blank" rel="noopener noreferrer" className="provider-link">
                  Get API Key →
                </a>
              </div>
            </div>
          );
        })}

        {/* ===== NATURAL VOICE / TTS Section ===== */}
        <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px solid var(--border-color)" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "12px" }}>🎙️ نیچرل آواز (100% انسان جیسی)</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "16px" }}>
            یوٹیوب پر ہندی AI ایجنٹس جیسی بالکل نیچرل آواز چاہیے تو ElevenLabs یا Sarvam AI key ڈالیں۔ بغیر key کے Google TTS استعمال ہوگا (روبوٹک)۔
          </p>

          {/* ElevenLabs — THE BEST */}
          <div className="provider-card" style={{ borderColor: countKeys(elevenlabsKeys) > 0 ? "rgba(34,197,94,0.3)" : undefined }}>
            <div className="provider-header">
              <span className="provider-name">👑 ElevenLabs Turbo (سب سے نیچرل!)</span>
              {countKeys(elevenlabsKeys) > 0 && <span className="provider-saved">✅ {countKeys(elevenlabsKeys)} key(s)</span>}
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "11px", margin: "6px 0 8px" }}>
              یہ وہی سسٹم ہے جو یوٹیوب پر ہندی AI ایجنٹس استعمال کرتے ہیں — 100% نیچرل، انسان جیسی آواز، جذبات کے ساتھ! اردو کے لیے خودکار ہندی/اردو آوازیں ٹرائی کرتا ہے۔
            </p>
            {elevenlabsKeys.map((key, idx) => (
              <KeyInputRow key={idx}
                value={key}
                onChange={(v) => updateKey("elevenlabs", idx, v)}
                onRemove={() => removeKey("elevenlabs", idx)}
                placeholder="xi_..."
                canRemove={elevenlabsKeys.length > 1}
              />
            ))}
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              <button onClick={() => addKey("elevenlabs")} style={{
                background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: "6px", color: "var(--accent-primary)", cursor: "pointer",
                padding: "6px 12px", fontSize: "12px", fontWeight: 600,
              }}>+ Add More</button>
              <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noopener noreferrer" className="provider-link">
                🆓 Free API Key لیں →
              </a>
            </div>
          </div>

          {/* Sarvam AI */}
          <div className="provider-card" style={{ borderColor: countKeys(sarvamKeys) > 0 ? "rgba(34,197,94,0.3)" : undefined, marginTop: "10px" }}>
            <div className="provider-header">
              <span className="provider-name">🇮🇳 Sarvam AI (ہندی/اردو نیچرل آواز)</span>
              {countKeys(sarvamKeys) > 0 && <span className="provider-saved">✅ {countKeys(sarvamKeys)} key(s)</span>}
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "11px", margin: "6px 0 8px" }}>
              ہندوستانی AI کمپنی — ہندی/اردو کے لیے مخصوص، بالکل نیچرل آواز، فری ٹائر دستیاب!
            </p>
            {sarvamKeys.map((key, idx) => (
              <KeyInputRow key={idx}
                value={key}
                onChange={(v) => updateKey("sarvam", idx, v)}
                onRemove={() => removeKey("sarvam", idx)}
                placeholder="Sarvam API Key"
                canRemove={sarvamKeys.length > 1}
              />
            ))}
            <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
              <button onClick={() => addKey("sarvam")} style={{
                background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: "6px", color: "var(--accent-primary)", cursor: "pointer",
                padding: "6px 12px", fontSize: "12px", fontWeight: 600,
              }}>+ Add More</button>
              <a href="https://sarvam.ai" target="_blank" rel="noopener noreferrer" className="provider-link">
                🆓 Sarvam AI سے Key لیں →
              </a>
            </div>
          </div>

          {/* OpenAI TTS - auto-uses existing key */}
          <div className="provider-card" style={{
            borderColor: countKeys(openaiKeys) > 0 ? "rgba(34,197,94,0.3)" : undefined,
            marginTop: "10px"
          }}>
            <div className="provider-header">
              <span className="provider-name">🎵 OpenAI TTS HD (انگریز کے لیے نیچرل)</span>
              {countKeys(openaiKeys) > 0 && <span className="provider-saved">✅ Auto</span>}
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "11px", margin: "6px 0 8px" }}>
              آپ کی OpenAI API key خودکار استعمال ہوگی — صرف انگریزی کے لیے! اردو سپورٹ نہیں۔
            </p>
          </div>

          {/* Priority Info */}
          <div style={{ marginTop: "12px", padding: "10px", background: "rgba(59,130,246,0.1)", borderRadius: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
            <p style={{ fontWeight: 600, marginBottom: "4px" }}>📋 آواز کی ترجیح:</p>
            <p>1️⃣ ElevenLabs Turbo (سب سے نیچرل — آپ کے اکاؤنٹ کی ہندی آوازیں خودکار ڈھونڈتا ہے)</p>
            <p>2️⃣ Sarvam AI (ہندی/اردو مخصوص)</p>
            <p>3️⃣ OpenAI TTS HD (صرف انگریزی)</p>
            <p>4️⃣ Google Translate (روبوٹک — آخری آپشن)</p>
            <p style={{ marginTop: "8px", fontWeight: 600, color: "#f59e0b" }}>💡 اہم: ElevenLabs کا فری ٹائر 10,000 کیرکٹرز/ماہ دیتا ہے۔ اگر آواز نہ آئے تو ٹیسٹ بٹن دبائیں!</p>
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
