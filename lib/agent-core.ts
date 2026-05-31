// JARVIS Hybrid - Agent Core
// Main orchestrator - accepts API keys per-request for multi-user support

import { LLMRouter } from "./llm-router";
import { MemoryManager } from "./memory";
import { BrowserAgent } from "./sub-agents/browser-agent";
import { ProductHunterAgent } from "./sub-agents/product-hunter";
import { CodeAgent } from "./sub-agents/code-agent";
import type {
  AgentResponse,
  EmotionType,
  JarvisMessage,
  APIKeys,
  LLMProvider,
} from "@/lib/protocol";

export class AgentCore {
  private memory = new MemoryManager();

  private emotionRules: Record<EmotionType, { prefix: string; style: string }> = {
    happy: { prefix: "😊", style: "enthusiastic and warm" },
    encouraging: { prefix: "💪", style: "motivating and supportive" },
    serious: { prefix: "⚡", style: "direct and precise" },
    sympathetic: { prefix: "💙", style: "caring and understanding" },
    surprised: { prefix: "😲", style: "amazed and impressed" },
    normal: { prefix: "🤖", style: "helpful and clear" },
  };

  private getRouter(apiKeys: APIKeys): LLMRouter {
    return new LLMRouter(apiKeys);
  }

  async processMessage(
    userId: string,
    userMessage: string,
    apiKeys: APIKeys,
    conversationHistory: JarvisMessage[] = [],
    activeProvider?: LLMProvider
  ): Promise<AgentResponse> {
    try {
      const llmRouter = this.getRouter(apiKeys);
      const emotion = this.detectEmotion(userMessage);
      const classification = await llmRouter.classifyTask(userMessage);

      let response: AgentResponse;

      switch (classification.agent) {
        case "browser": {
          const browserAgent = new BrowserAgent(llmRouter);
          response = await browserAgent.handle(classification.action, classification.params);
          break;
        }
        case "product_hunter": {
          const productHunter = new ProductHunterAgent(llmRouter);
          response = await productHunter.handle(classification.action, classification.params);
          break;
        }
        case "code": {
          const codeAgent = new CodeAgent(llmRouter);
          response = await codeAgent.handle(classification.action, classification.params, userMessage);
          break;
        }
        case "windows":
        case "file":
        case "upload":
          response = {
            success: true,
            message: `I'll handle this on your desktop! ${this.getLocalActionMessage(classification.agent)}`,
            emotion,
            requiresLocalAction: true,
            localAction: {
              type: classification.agent as "windows" | "file" | "upload",
              action: classification.action,
              params: classification.params,
            },
          };
          break;
        default:
          response = await this.handleGeneralChat(llmRouter, userMessage, conversationHistory, emotion, activeProvider);
      }

      await this.memory.saveConversation(userId, "user", userMessage, emotion, classification.agent);
      await this.memory.saveConversation(userId, "assistant", response.message, response.emotion, classification.agent);

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[Agent Core] Error:", errorMessage);

      return {
        success: false,
        message: "معذرت، کوئی مسئلہ آ گیا ہے۔ براہ کرم Settings میں API Key ڈالیں۔",
        emotion: "sympathetic",
        error: errorMessage,
      };
    }
  }

  async processMessageStream(
    userId: string,
    userMessage: string,
    apiKeys: APIKeys,
    conversationHistory: JarvisMessage[] = [],
    activeProvider?: LLMProvider
  ): Promise<{ stream: ReadableStream; classification: { agent: string; action: string; params: Record<string, unknown>; requiresLocal: boolean; confidence: number }; emotion: EmotionType }> {
    const llmRouter = this.getRouter(apiKeys);
    const emotion = this.detectEmotion(userMessage);

    let classification;
    try {
      classification = await llmRouter.classifyTask(userMessage);
    } catch {
      classification = { agent: "general", action: "chat", params: {}, requiresLocal: false, confidence: 0.5 };
    }

    // Local agents
    if (["windows", "file", "upload"].includes(classification.agent)) {
      const text = `I'll handle this on your desktop! ${this.getLocalActionMessage(classification.agent)}`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(text));
          controller.close();
        },
      });
      return { stream, classification, emotion };
    }

    // Sub-agents
    if (classification.agent !== "general") {
      let responseText = "";
      try {
        switch (classification.agent) {
          case "browser": {
            const agent = new BrowserAgent(llmRouter);
            const resp = await agent.handle(classification.action, classification.params);
            responseText = resp.message;
            break;
          }
          case "product_hunter": {
            const agent = new ProductHunterAgent(llmRouter);
            const resp = await agent.handle(classification.action, classification.params);
            responseText = resp.message;
            break;
          }
          case "code": {
            const agent = new CodeAgent(llmRouter);
            const resp = await agent.handle(classification.action, classification.params, userMessage);
            responseText = resp.message;
            break;
          }
        }
      } catch (e) {
        responseText = "Agent error occurred. Please check your API key in Settings.";
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(responseText));
          controller.close();
        },
      });
      return { stream, classification, emotion };
    }

    // General chat - stream from LLM
    const systemPrompt = this.buildSystemPrompt(emotion);
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: userMessage },
    ];

    const provider = activeProvider || undefined;
    const stream = await llmRouter.chatStream(messages, { provider } as any);
    return { stream, classification, emotion };
  }

  private async handleGeneralChat(
    llmRouter: LLMRouter,
    userMessage: string,
    history: JarvisMessage[],
    emotion: EmotionType,
    activeProvider?: LLMProvider
  ): Promise<AgentResponse> {
    const systemPrompt = this.buildSystemPrompt(emotion);
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: userMessage },
    ];

    const provider = activeProvider || undefined;
    const response = await llmRouter.chat(messages, { provider } as any);

    return {
      success: true,
      message: response,
      emotion,
    };
  }

  private buildSystemPrompt(emotion: EmotionType): string {
    const emotionConfig = this.emotionRules[emotion];
    return `You are JARVIS, an intelligent AI assistant with a bilingual personality (Urdu/English).

EMOTION: [${emotion.toUpperCase()}]
STYLE: ${emotionConfig.style}

RULES:
1. Respond naturally in the language the user speaks (Urdu or English)
2. If user speaks Urdu/mixed, respond in Urdu/mixed
3. If user speaks English, respond in English
4. Be helpful, smart, and witty
5. You can help with: general questions, web search, product research, coding, file operations, and desktop control
6. For desktop operations (screenshots, file downloads, uploads), tell the user you'll handle it locally
7. Use emotion-appropriate expressions but don't overdo it
8. Keep responses concise but informative

CAPABILITIES:
- General conversation and questions
- Web search and browsing (cloud-based)
- Product research and trend analysis (cloud-based)
- Code writing, debugging, and review (cloud-based)
- Desktop control via local agent (screenshots, apps, file operations, uploads)

You are running as a hybrid system - cloud brain + desktop hands.`;
  }

  private detectEmotion(message: string): EmotionType {
    const lower = message.toLowerCase();

    const emotionChecks: Array<{ emotion: EmotionType; keywords: string[] }> = [
      { emotion: "happy", keywords: ["شکریہ", "بہت اچھا", "زبردست", "مزہ", "thanks", "great", "awesome", "amazing", "love it"] },
      { emotion: "encouraging", keywords: ["مدد", "ناممکن", "مشکل", "help", "can't", "difficult", "impossible", "struggling"] },
      { emotion: "serious", keywords: ["خطرہ", "ہٹا دو", "delete", "format", "danger", "warning", "critical", "remove"] },
      { emotion: "sympathetic", keywords: ["اداس", "تنگ", "sad", "upset", "depressed", "worried", "پریشان", "tired"] },
      { emotion: "surprised", keywords: ["ارے", "واہ", "حیرت", "wow", "really", "واقعی", "ماشاءاللہ"] },
    ];

    for (const check of emotionChecks) {
      if (check.keywords.some((kw) => lower.includes(kw))) {
        return check.emotion;
      }
    }

    return "normal";
  }

  private getLocalActionMessage(agent: string): string {
    const messages: Record<string, string> = {
      windows: "آپ کے کمپیوٹر پر یہ کام کر رہا ہوں...",
      file: "آپ کے سسٹم پر فائل آپریشن کر رہا ہوں...",
      upload: "آپ کے ڈیسک ٹاپ سے اپلوڈ کر رہا ہوں...",
    };
    return messages[agent] || "";
  }
}
