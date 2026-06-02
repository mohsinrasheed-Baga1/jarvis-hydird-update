// JARVIS Hybrid - LLM Router
// Supports: Groq, Gemini, OpenAI, ZAI
// API keys come from frontend request (user-provided)

import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  DEFAULT_LLM_CONFIG,
  PROVIDER_MODELS,
  type LLMConfig,
  type LLMProvider,
  type APIKeys,
} from "@/lib/protocol";

export class LLMRouter {
  private apiKeys: APIKeys;

  constructor(apiKeys: APIKeys = {}) {
    this.apiKeys = apiKeys;
  }

  updateKeys(apiKeys: APIKeys) {
    this.apiKeys = { ...this.apiKeys, ...apiKeys };
  }

  // Parse comma-separated keys into array
  private _parseKeys(key: string | undefined): string[] {
    if (!key) return [];
    return key.split(",").map(k => k.trim()).filter(k => k.length > 0);
  }

  // Get all keys for a provider (supports comma-separated multi-keys)
  private _getProviderKeys(provider: LLMProvider): string[] {
    const key = this.apiKeys[provider];
    const envKey = process.env[`GROQ_API_KEY`] && provider === "groq" ? process.env.GROQ_API_KEY :
                   process.env[`GEMINI_API_KEY`] && provider === "gemini" ? process.env.GEMINI_API_KEY :
                   process.env[`OPENAI_API_KEY`] && provider === "openai" ? process.env.OPENAI_API_KEY :
                   process.env[`ZAI_API_KEY`] && provider === "zai" ? process.env.ZAI_API_KEY : "";
    const allKeys = [...this._parseKeys(key), ...this._parseKeys(envKey)];
    // Remove duplicates
    return [...new Set(allKeys)];
  }

  // ============== CHAT ==============

  async chat(
    messages: Array<{ role: string; content: string }>,
    config: Partial<LLMConfig> = {}
  ): Promise<string> {
    const fullConfig = { ...DEFAULT_LLM_CONFIG, ...config };
    const provider = fullConfig.provider || this._selectProvider();

    // MULTI-KEY: Try each key for the primary provider first
    const providerKeys = this._getProviderKeys(provider);
    for (const key of providerKeys) {
      try {
        const singleKeyConfig = { ...this.apiKeys, [provider]: key };
        const router = new LLMRouter(singleKeyConfig);
        return await router._chatWithProvider(provider, messages, fullConfig);
      } catch (err: any) {
        const isRateLimit = err?.status === 429 || err?.statusCode === 429 ||
          String(err?.message || "").includes("rate") || String(err?.message || "").includes("limit") ||
          String(err?.message || "").includes("quota");
        console.warn(`[LLM Router] ${provider} key ${key.substring(0, 8)}... failed: ${err?.message?.substring(0, 80)}`);
        if (isRateLimit && providerKeys.indexOf(key) < providerKeys.length - 1) {
          console.log(`[LLM Router] Rate limited, trying next key...`);
          continue; // Try next key
        }
        break; // Non-rate-limit error or last key, fall through to other providers
      }
    }

    // Try fallback providers
    const allProviders: LLMProvider[] = ["groq", "gemini", "openai", "zai", "xai", "anthropic"];
    const fallbacks = allProviders.filter(
      (p) => p !== provider && this._hasKey(p as LLMProvider)
    );

    for (const fallback of fallbacks) {
      const fallbackKeys = this._getProviderKeys(fallback as LLMProvider);
      for (const key of fallbackKeys) {
        try {
          console.log(`[LLM Router] Trying fallback: ${fallback} key ${key.substring(0, 8)}...`);
          const singleKeyConfig = { ...this.apiKeys, [fallback]: key };
          const router = new LLMRouter(singleKeyConfig);
          return await router._chatWithProvider(fallback as LLMProvider, messages, {
            ...fullConfig,
            provider: fallback,
          });
        } catch (fbError: any) {
          const isRateLimit = fbError?.status === 429 || fbError?.statusCode === 429;
          if (isRateLimit && fallbackKeys.indexOf(key) < fallbackKeys.length - 1) {
            continue;
          }
          console.error(`[LLM Router] ${fallback} also failed:`, fbError?.message?.substring(0, 80));
          break;
        }
      }
    }

    throw new Error(
      "All LLM providers failed. Please add more API keys in Settings."
    );
  }

  // ============== STREAMING ==============

  async chatStream(
    messages: Array<{ role: string; content: string }>,
    config: Partial<LLMConfig> = {}
  ): Promise<ReadableStream> {
    const fullConfig = { ...DEFAULT_LLM_CONFIG, ...config };
    const provider = fullConfig.provider || this._selectProvider();

    try {
      return await this._streamWithProvider(provider, messages, fullConfig);
    } catch (primaryError) {
      console.error(`[LLM Router] ${provider} stream failed:`, primaryError);

      // Fallback to non-streaming with another provider
      const allProviders: LLMProvider[] = ["groq", "gemini", "openai", "zai", "xai", "anthropic"];
      const fallbacks = allProviders.filter(
        (p) => p !== provider && this._hasKey(p as LLMProvider)
      );

      for (const fallback of fallbacks) {
        try {
          const fullResponse = await this._chatWithProvider(fallback as LLMProvider, messages, {
            ...fullConfig,
            provider: fallback,
          });
          const encoder = new TextEncoder();
          return new ReadableStream({
            start(controller) {
              controller.enqueue(fullResponse);
              controller.close();
            },
          });
        } catch {
          continue;
        }
      }

      throw new Error("All providers failed for streaming.");
    }
  }

  // ============== TASK CLASSIFICATION ==============

  async classifyTask(userMessage: string): Promise<{
    agent: string;
    action: string;
    params: Record<string, unknown>;
    requiresLocal: boolean;
    confidence: number;
  }> {
    const classificationPrompt = [
      {
        role: "system",
        content: `You are a task classifier for JARVIS AI assistant. Classify the user's message into one of these agents:
- "general": General conversation, questions, greetings
- "windows": OS control (open apps, screenshots, system info, brightness, volume)
- "browser": Web search, scraping, browsing, form filling
- "file": File operations (read, write, convert, download, organize)
- "product_hunter": Product research, trending products, SEO, market analysis
- "code": Code writing, debugging, execution, review
- "upload": Upload to platforms (Redbubble, Amazon, Etsy)
- "freelance": Freelancing tasks — hunting jobs, proposals, job analysis, cover letters, negotiation, pricing, applying, portfolio pitch, full pipeline
- "whatsapp": WhatsApp communication — client chat, drafting messages, auto-replies, follow-ups, chat strategy
- "task_manager": Complex autonomous tasks that need planning and multi-step execution, daily plans

URDU KEYWORDS MAPPING:
- پروپوزل،فری لانس،جاب،نوکری،کلائنٹ،بجٹ،جوبس ڈھونڈو،اپلائی → freelance
- واٹس ایپ،میسج،چیٹ،پیغام،ریپلائی → whatsapp
- پلان،حکمت عملی،روزانہ،ٹاسک مینیجر → task_manager

Respond ONLY with valid JSON:
{"agent": "agent_name", "action": "brief_action", "params": {}, "requiresLocal": true/false, "confidence": 0.0-1.0}

requiresLocal is true for: windows, file (download/write), upload agents
requiresLocal is false for: general, browser (search), product_hunter, code (write only), freelance, whatsapp, task_manager

ACTION MAPPING for freelance:
- "hunt_jobs": Search for jobs on platforms (DEFAULT for job search requests)
- "apply_to_job": Apply to a specific job with proposal + portfolio
- "full_pipeline": Complete pipeline — hunt, apply, negotiate, report
- "generate_proposal": Writing a proposal for a job
- "analyze_job": Analyzing a job posting
- "cover_letter": Writing a cover letter
- "negotiate": Negotiation help
- "pricing_strategy": Pricing advice
- "job_search_strategy": How to find jobs strategically
- "client_response": Reply to client message
- "portfolio_pitch": Present portfolio to a client
- "match_skills": Match skills to job

ACTION MAPPING for whatsapp:
- "client_chat": Chat with client as Rayan Sir (DEFAULT for client conversations)
- "draft_message": Compose a new message
- "auto_reply": Auto-reply to incoming message
- "professional_reply": Professional response
- "friendly_reply": Casual response
- "negotiate_chat": Negotiate via chat
- "follow_up": Follow-up message`,
      },
      {
        role: "user",
        content: userMessage,
      },
    ];

    try {
      const response = await this.chat(classificationPrompt, {
        temperature: 0.1,
        maxTokens: 256,
      });

      const cleaned = response
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      return JSON.parse(cleaned);
    } catch {
      return {
        agent: "general",
        action: "chat",
        params: {},
        requiresLocal: false,
        confidence: 0.5,
      };
    }
  }

  // ============== PROVIDER ROUTING ==============

  private async _chatWithProvider(
    provider: LLMProvider,
    messages: Array<{ role: string; content: string }>,
    config: LLMConfig
  ): Promise<string> {
    switch (provider) {
      case "groq":
        return this._chatGroq(messages, config);
      case "gemini":
        return this._chatGemini(messages, config);
      case "openai":
        return this._chatOpenAI(messages, config);
      case "zai":
        return this._chatZAI(messages, config);
      case "xai":
        return this._chatXAI(messages, config);
      case "anthropic":
        return this._chatAnthropic(messages, config);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  private async _streamWithProvider(
    provider: LLMProvider,
    messages: Array<{ role: string; content: string }>,
    config: LLMConfig
  ): Promise<ReadableStream> {
    switch (provider) {
      case "groq":
        return this._streamGroq(messages, config);
      case "openai":
        return this._streamOpenAI(messages, config);
      case "gemini":
      case "zai":
        // Gemini/ZAI don't support server streaming easily, fallback to full response
        const response = await this._chatWithProvider(provider, messages, config);
        const encoder = new TextEncoder();
        return new ReadableStream({
          start(controller) {
            controller.enqueue(response);
            controller.close();
          },
        });
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  // ============== GROQ ==============

  private async _chatGroq(
    messages: Array<{ role: string; content: string }>,
    config: LLMConfig
  ): Promise<string> {
    const apiKey = this.apiKeys.groq || process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("Groq API key not provided");

    const client = new Groq({ apiKey });
    const models = PROVIDER_MODELS.groq;

    try {
      const response = await client.chat.completions.create({
        model: config.model || models.primary,
        messages: messages as Groq.Chat.Completions.ChatCompletionMessageParam[],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      });
      return response.choices[0]?.message?.content || "";
    } catch {
      // Try fallback model
      const response = await client.chat.completions.create({
        model: models.fallback,
        messages: messages as Groq.Chat.Completions.ChatCompletionMessageParam[],
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      });
      return response.choices[0]?.message?.content || "";
    }
  }

  private async _streamGroq(
    messages: Array<{ role: string; content: string }>,
    config: LLMConfig
  ): Promise<ReadableStream> {
    const apiKey = this.apiKeys.groq || process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("Groq API key not provided");

    const client = new Groq({ apiKey });
    const models = PROVIDER_MODELS.groq;

    const stream = await client.chat.completions.create({
      model: config.model || models.primary,
      messages: messages as Groq.Chat.Completions.ChatCompletionMessageParam[],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: true,
    });

    const encoder = new TextEncoder();
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  // ============== GEMINI ==============

  private async _chatGemini(
    messages: Array<{ role: string; content: string }>,
    config: LLMConfig
  ): Promise<string> {
    const apiKey = this.apiKeys.gemini || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key not provided");

    const genAI = new GoogleGenerativeAI(apiKey);
    const models = PROVIDER_MODELS.gemini;

    const model = genAI.getGenerativeModel({
      model: config.model || models.primary,
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: config.maxTokens,
      },
    });

    const chatHistory = messages.slice(0, -1).map((m) => ({
      role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history: chatHistory });
    const lastMessage = messages[messages.length - 1]?.content || "";
    const result = await chat.sendMessage(lastMessage);
    return result.response.text() || "";
  }

  // ============== OPENAI ==============

  private async _chatOpenAI(
    messages: Array<{ role: string; content: string }>,
    config: LLMConfig
  ): Promise<string> {
    const apiKey = this.apiKeys.openai || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI API key not provided");

    const models = PROVIDER_MODELS.openai;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || models.primary,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  }

  private async _streamOpenAI(
    messages: Array<{ role: string; content: string }>,
    config: LLMConfig
  ): Promise<ReadableStream> {
    const apiKey = this.apiKeys.openai || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI API key not provided");

    const models = PROVIDER_MODELS.openai;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || models.primary,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI stream error: ${response.status}`);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    return new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.error(new Error("No reader"));
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ") && line !== "data: [DONE]") {
                try {
                  const json = JSON.parse(line.slice(6));
                  const content = json.choices[0]?.delta?.content || "";
                  if (content) {
                    controller.enqueue(encoder.encode(content));
                  }
                } catch {
                  // Skip malformed chunks
                }
              }
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  // ============== ZAI ==============

  private async _chatZAI(
    messages: Array<{ role: string; content: string }>,
    config: LLMConfig
  ): Promise<string> {
    const apiKey = this.apiKeys.zai || process.env.ZAI_API_KEY;
    if (!apiKey) throw new Error("ZAI API key not provided");

    const models = PROVIDER_MODELS.zai;

    // ZAI uses OpenAI-compatible API format
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || models.primary,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`ZAI API error: ${err}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  }

  // ============== XAI ==============

  private async _chatXAI(
    messages: Array<{ role: string; content: string }>,
    config: LLMConfig
  ): Promise<string> {
    const apiKey = this.apiKeys.xai || process.env.XAI_API_KEY;
    if (!apiKey) throw new Error("xAI API key not provided");

    const models = PROVIDER_MODELS.xai;
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: config.model || models.primary,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`xAI API error: ${err}`);
    }
    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  }

  // ============== ANTHROPIC ==============

  private async _chatAnthropic(
    messages: Array<{ role: string; content: string }>,
    config: LLMConfig
  ): Promise<string> {
    const apiKey = this.apiKeys.anthropic || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Anthropic API key not provided");

    const models = PROVIDER_MODELS.anthropic;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model || models.primary,
        max_tokens: config.maxTokens,
        system: messages.find(m => m.role === "system")?.content || "You are a helpful assistant.",
        messages: messages.filter(m => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${err}`);
    }
    const data = await response.json();
    return data.content?.[0]?.text || "";
  }

  // ============== HELPERS ==============

  private _selectProvider(): LLMProvider {
    // Pick the first available provider with an API key
    const order: LLMProvider[] = ["groq", "gemini", "openai", "zai", "xai", "anthropic"];
    for (const p of order) {
      if (this._hasKey(p)) return p;
    }
    return "groq"; // Default
  }

  private _hasKey(provider: LLMProvider): boolean {
    switch (provider) {
      case "groq":
        return !!(this.apiKeys.groq || process.env.GROQ_API_KEY);
      case "gemini":
        return !!(this.apiKeys.gemini || process.env.GEMINI_API_KEY);
      case "openai":
        return !!(this.apiKeys.openai || process.env.OPENAI_API_KEY);
      case "zai":
        return !!(this.apiKeys.zai || process.env.ZAI_API_KEY);
      case "xai":
        return !!(this.apiKeys.xai || process.env.XAI_API_KEY);
      case "anthropic":
        return !!(this.apiKeys.anthropic || process.env.ANTHROPIC_API_KEY);
      default:
        return false;
    }
  }

  getAvailableProviders(): LLMProvider[] {
    return (["groq", "gemini", "openai", "zai", "xai", "anthropic"] as LLMProvider[]).filter((p) =>
      this._hasKey(p)
    );
  }
}
