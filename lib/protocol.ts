// JARVIS Hybrid - Shared Protocol Types
// Used by both Cloud and Desktop for communication

export interface JarvisMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  emotion?: EmotionType;
  agent?: AgentType;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export type EmotionType =
  | "happy"
  | "encouraging"
  | "serious"
  | "sympathetic"
  | "surprised"
  | "normal";

export type AgentType =
  | "general"
  | "windows"
  | "browser"
  | "file"
  | "product_hunter"
  | "code"
  | "upload"
  | "freelance"
  | "whatsapp"
  | "task_manager";

export interface TaskClassification {
  agent: AgentType;
  action: string;
  params: Record<string, unknown>;
  requiresLocal: boolean;
  confidence: number;
}

export interface AgentResponse {
  success: boolean;
  message: string;
  emotion: EmotionType;
  data?: Record<string, unknown>;
  error?: string;
  requiresLocalAction?: boolean;
  localAction?: LocalAction;
}

export interface LocalAction {
  type: AgentType;
  action: string;
  params: Record<string, unknown>;
}

export interface CloudToDesktopMessage {
  type: "task" | "config" | "ping";
  taskId: string;
  action: LocalAction;
  callbackUrl?: string;
}

export interface DesktopToCloudMessage {
  type: "result" | "status" | "error" | "pong";
  taskId: string;
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

export interface MemoryEntry {
  id: string;
  userId: string;
  role: string;
  content: string;
  emotion?: string;
  agent?: string;
  timestamp: number;
}

export interface UserPreferences {
  userId: string;
  language: "ur" | "en" | "mixed";
  voiceEnabled: boolean;
  speedMode: "fast" | "balanced" | "thorough";
  personality: "friendly" | "professional" | "casual";
  activeProvider: LLMProvider;
}

// ============== LLM PROVIDERS ==============

export type LLMProvider = "groq" | "gemini" | "openai" | "zai" | "xai" | "anthropic";

export interface APIKeys {
  groq?: string;      // gsk_...
  gemini?: string;    // AIza...
  openai?: string;    // sk-...
  zai?: string;       // custom
  xai?: string;       // xai-...
  anthropic?: string; // sk-ant-...
}

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  provider: "groq",
  model: "llama-3.3-70b-versatile",
  temperature: 0.7,
  maxTokens: 2048,
};

export const PROVIDER_MODELS: Record<LLMProvider, { primary: string; fallback: string; label: string; placeholder: string }> = {
  groq: {
    primary: "llama-3.3-70b-versatile",
    fallback: "llama-3.1-8b-instant",
    label: "Groq (Llama 3.3 70B)",
    placeholder: "gsk_...",
  },
  gemini: {
    primary: "gemini-1.5-flash",
    fallback: "gemini-1.5-pro",
    label: "Google Gemini 1.5 Flash",
    placeholder: "AIza...",
  },
  openai: {
    primary: "gpt-4o-mini",
    fallback: "gpt-3.5-turbo",
    label: "OpenAI (GPT-4o Mini)",
    placeholder: "sk-...",
  },
  zai: {
    primary: "glm-4-flash",
    fallback: "glm-4-flash",
    label: "ZAI (GLM-4 Flash)",
    placeholder: "your-zai-api-key",
  },
  xai: {
    primary: "grok-2",
    fallback: "grok-2-mini",
    label: "xAI / Grok",
    placeholder: "xai-...",
  },
  anthropic: {
    primary: "claude-3-5-sonnet-20241022",
    fallback: "claude-3-haiku-20240307",
    label: "Anthropic / Claude",
    placeholder: "sk-ant-...",
  },
};

export const EMOTION_KEYWORDS: Record<EmotionType, string[]> = {
  happy: ["شکریہ", "بہت اچھا", "زبردست", "مزہ", "thanks", "great", "awesome", "amazing"],
  encouraging: ["مدد", "ناممکن", "مشکل", "help", "can't", "difficult", "impossible"],
  serious: ["خطرہ", "ہٹا دو", "delete", "format", "danger", "warning", "critical"],
  sympathetic: ["اداس", "تنگ", "sad", "upset", "depressed", "worried", "پریشان"],
  surprised: ["ارے", "واہ", "حیرت", "wow", "really", "unexpected", "واقعی"],
  normal: [],
};

// ============== NEW TYPES ==============

export type ResearchCategory = "earning" | "self-improvement" | "technical" | "general";
export type ResearchSource = "ChatGPT" | "xAI" | "Claude" | "Grok" | "Self" | "Gemini";

export interface ResearchEntry {
  id: string;
  title: string;
  content: string;
  source: ResearchSource;
  date: number;
  category: ResearchCategory;
}

export interface UpdateStatus {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  lastChecked: number;
  status: "up-to-date" | "update-available" | "downloading" | "error";
}

export interface RecordingConfig {
  speed: "slow" | "normal" | "fast";
  lang: "ur" | "en";
}

export interface RecordingSpeedPreset {
  label: string;
  labelUr: string;
  rate: number;
  pitch: number;
}

export const RECORDING_SPEEDS: Record<string, RecordingSpeedPreset> = {
  slow: { label: "Slow", labelUr: "آہستہ", rate: 0.65, pitch: 0.9 },
  normal: { label: "Normal", labelUr: "نارمل", rate: 0.88, pitch: 1.0 },
  fast: { label: "Fast", labelUr: "تیز", rate: 1.3, pitch: 1.05 },
};

export type SidebarSection = "dashboard" | "chat" | "recording" | "settings" | "research";
