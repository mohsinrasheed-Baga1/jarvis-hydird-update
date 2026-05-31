// JARVIS Hybrid - Base Agent Class

import type { LLMRouter } from "@/lib/llm-router";
import type { AgentResponse, EmotionType } from "@/lib/protocol";

export abstract class BaseAgent {
  protected llmRouter: LLMRouter;
  protected name: string;

  constructor(name: string, llmRouter: LLMRouter) {
    this.name = name;
    this.llmRouter = llmRouter;
  }

  abstract handle(action: string, params: Record<string, unknown>, ...args: unknown[]): Promise<AgentResponse>;

  protected success(message: string, emotion: EmotionType = "normal", data?: Record<string, unknown>): AgentResponse {
    return { success: true, message, emotion, data };
  }

  protected error(message: string, emotion: EmotionType = "serious"): AgentResponse {
    return { success: false, message, emotion, error: message };
  }
}
