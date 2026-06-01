// JARVIS Hybrid - WhatsApp Agent
// Handles WhatsApp communication: message drafting, chat management, auto-replies

import { BaseAgent } from "./base-agent";
import type { LLMRouter } from "@/lib/llm-router";
import type { AgentResponse } from "@/lib/protocol";

export class WhatsAppAgent extends BaseAgent {
  constructor(llmRouter: LLMRouter) {
    super("whatsapp", llmRouter);
  }

  async handle(action: string, params: Record<string, unknown>, ...args: unknown[]): Promise<AgentResponse> {
    switch (action) {
      case "draft_message":
        return this.draftMessage(params.context as string, params.tone as string, params.goal as string);
      case "auto_reply":
        return this.autoReply(params.message as string, params.context as string, params.personality as string);
      case "chat_strategy":
        return this.chatStrategy(params.context as string, params.goal as string);
      case "professional_reply":
        return this.professionalReply(params.message as string, params.context as string);
      case "friendly_reply":
        return this.friendlyReply(params.message as string, params.context as string);
      case "negotiate_chat":
        return this.negotiateChat(params.message as string, params.goal as string);
      case "follow_up":
        return this.followUp(params.context as string, params.daysSinceLastContact as number);
      default:
        return this.draftMessage(params.context as string, params.tone as string, params.goal as string);
    }
  }

  // Draft a new WhatsApp message
  private async draftMessage(context: string, tone: string, goal: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `You are drafting a WhatsApp message. Rules:
- Keep it SHORT and natural (WhatsApp style, not email)
- Use appropriate emojis sparingly
- Write in the SAME language as the context
- Tone: ${tone || "friendly"}
- Goal: ${goal || "general communication"}
- No long paragraphs — break into short messages if needed
- Sound human, not robotic
- Get straight to the point`,
      },
      {
        role: "user",
        content: `Draft a WhatsApp message. Context: ${context}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.6,
        maxTokens: 300,
      });

      return this.success(`📱 **WhatsApp Message**\n\n${response}`, "happy");
    } catch (err) {
      return this.error(`Message drafting failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Auto-reply to incoming messages
  private async autoReply(message: string, context: string, personality: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `You are an AI assistant generating a WhatsApp auto-reply on behalf of the user.

RULES:
- Reply in the SAME language as the incoming message
- Personality: ${personality || "professional yet friendly"}
- Keep it SHORT (1-3 short messages)
- Be helpful and responsive
- Don't over-promise
- Sound natural, like a real person texting
- Use minimal emojis
- If it's a business inquiry, be professional
- If it's casual, match the energy`,
      },
      {
        role: "user",
        content: `**Incoming Message:** ${message}\n\n**Context:** ${context || "No additional context"}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.5,
        maxTokens: 400,
      });

      return this.success(`💬 **Auto-Reply Suggestion**\n\n${response}\n\n---\n⚠️ Review before sending — this is a suggestion, not automatic.`, "normal");
    } catch (err) {
      return this.error(`Auto-reply failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Chat strategy for important conversations
  private async chatStrategy(context: string, goal: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `You are a communication strategist. Help plan a WhatsApp conversation.

Provide:
1. **Opening Line** - How to start the conversation naturally
2. **Key Points** - What to mention (in order)
3. **Handling Objections** - Possible pushback and responses
4. **Closing** - How to end the conversation with next steps
5. **Timing** - Best time to send each message

Write in the SAME language as the context. Be strategic but natural.`,
      },
      {
        role: "user",
        content: `**Context:** ${context}\n\n**Goal:** ${goal}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.4,
        maxTokens: 800,
      });

      return this.success(`🎯 **Chat Strategy**\n\n${response}`, "serious");
    } catch (err) {
      return this.error(`Chat strategy failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Professional reply
  private async professionalReply(message: string, context: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Write a PROFESSIONAL WhatsApp reply. Rules:
- Same language as the incoming message
- Formal but warm tone
- Clear and concise
- Address all points raised
- Include next steps if appropriate
- Minimal emojis`,
      },
      {
        role: "user",
        content: `**Message:** ${message}\n**Context:** ${context || ""}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.4,
        maxTokens: 400,
      });

      return this.success(`👔 **Professional Reply**\n\n${response}`, "normal");
    } catch (err) {
      return this.error(`Professional reply failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Friendly reply
  private async friendlyReply(message: string, context: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Write a FRIENDLY WhatsApp reply. Rules:
- Same language as the incoming message
- Warm, casual tone
- Use emojis naturally
- Keep it short and fun
- Match the sender's energy level`,
      },
      {
        role: "user",
        content: `**Message:** ${message}\n**Context:** ${context || ""}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.7,
        maxTokens: 300,
      });

      return this.success(`😊 **Friendly Reply**\n\n${response}`, "happy");
    } catch (err) {
      return this.error(`Friendly reply failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Negotiate via WhatsApp chat
  private async negotiateChat(message: string, goal: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `You are negotiating via WhatsApp. Write a strategic reply.

RULES:
- Same language as the incoming message
- Be firm but friendly
- Use the "feel-felt-found" technique
- Always move toward your goal
- Don't give away leverage
- Suggest win-win solutions
- Keep messages SHORT (WhatsApp style)`,
      },
      {
        role: "user",
        content: `**Their Message:** ${message}\n\n**My Goal:** ${goal}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.5,
        maxTokens: 400,
      });

      return this.success(`🤝 **Negotiation Reply**\n\n${response}`, "serious");
    } catch (err) {
      return this.error(`Negotiation reply failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Follow up message
  private async followUp(context: string, daysSinceLastContact: number): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Write a follow-up WhatsApp message. Rules:
- Same language as the context
- Be gentle, not pushy
- Add value (share something useful related to the context)
- Include a clear but soft call-to-action
- Acknowledge they might be busy
- Keep it SHORT and natural

Days since last contact: ${daysSinceLastContact}
${daysSinceLastContact > 7 ? "It's been a while — be extra gentle." : "Recent contact — be direct but warm."}`,
      },
      {
        role: "user",
        content: `**Context:** ${context}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.5,
        maxTokens: 300,
      });

      return this.success(`📤 **Follow-Up Message**\n\n${response}`, "encouraging");
    } catch (err) {
      return this.error(`Follow-up generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }
}
