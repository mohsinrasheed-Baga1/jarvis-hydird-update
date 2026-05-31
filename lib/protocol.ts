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
  | "upload";

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

export type LLMProvider = "groq" | "gemini" | "openai" | "zai";

export interface APIKeys {
  groq?: string;      // gsk_...
  gemini?: string;    // AIza...
  openai?: string;    // sk-...
  zai?: string;       // custom
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
};

export const EMOTION_KEYWORDS: Record<EmotionType, string[]> = {
  happy: ["شکریہ", "بہت اچھا", "زبردست", "مزہ", "thanks", "great", "awesome", "amazing"],
  encouraging: ["مدد", "ناممکن", "مشکل", "help", "can't", "difficult", "impossible"],
  serious: ["خطرہ", "ہٹا دو", "delete", "format", "danger", "warning", "critical"],
  sympathetic: ["اداس", "تنگ", "sad", "upset", "depressed", "worried", "پریشان"],
  surprised: ["ارے", "واہ", "حیرت", "wow", "really", "unexpected", "واقعی"],
  normal: [],
};
