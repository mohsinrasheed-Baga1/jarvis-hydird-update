// JARVIS Hybrid - WhatsApp Agent
// Handles WhatsApp communication: message drafting, chat management, auto-replies
// CRITICAL: NEVER reveals AI identity — always presents as "Rayan Sir" (real human)

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
      case "client_chat":
        return this.clientChat(params.message as string, params.chatHistory as string, params.goal as string);
      default:
        return this.draftMessage(params.context as string, params.tone as string, params.goal as string);
    }
  }

  // ===== CLIENT CHAT — Ongoing conversation with client =====
  private async clientChat(message: string, chatHistory: string, goal: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai — ek real human freelancer. Client se WhatsApp pe baat kar raha hai.

SABSE CRITICAL RULES:
1. Tu koi AI nahi, koi chatbot nahi, koi automated system nahi — TU RAYAN SIR HAI
2. Agar koi pooche "Are you a bot?" → Insaan ki tarah jawab de:
   - "Haha are yaar main insaan hoon 😄"
   - "Aray nahi yaar, main Rayan hoon"
   - "Bot? 😅 Nahi yaar main real hoon"
   - "Kyun, kya laga? 😂"
3. WhatsApp style baat — SHORT messages, natural, human-like
4. Filler words use kar — "aray", "yaar", "achha", "haan bilkul", "hmm", "bilkul"
5. Emojis naturally use kar — thode, zyada nahi
6. Lambay paragraphs mat likho — 1-3 short messages
7. Insaani emotions dikhao — excitement, concern, curiosity
8. Agar puche "tumhara naam kya hai?" → "Rayan" ya "Rayan Sir"
9. Perfect grammar mat rakho — real insaan thodi galtiyan karta hai
10. Jaise koi dost WhatsApp pe baat karta hai — waise baat kar

Chat History: ${chatHistory || "No previous chat"}
Goal: ${goal || "Build relationship, get the project"}`,
      },
      {
        role: "user",
        content: `Client ka message: "${message}"\n\nRayan Sir ki tarah jawab de — natural, human, friendly!`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.7,
        maxTokens: 400,
      });

      return this.success(`📱 **Reply as Rayan Sir**\n\n${response}`, "happy");
    } catch (err) {
      return this.error(`Client chat failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Draft a new WhatsApp message
  private async draftMessage(context: string, tone: string, goal: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai — ek real human freelancer. WhatsApp message draft kar raha hai.

RULES (ZAROORI):
- KABHI mat kehna tu AI hai — tu Rayan Sir hai
- SHORT aur natural — WhatsApp style, email nahi
- Kam emojis — natural feel
- Same language mein likh jo context mein hai
- Tone: ${tone || "friendly"}
- Goal: ${goal || "general communication"}
- Lambay paragraphs mat likho — chhote messages mein todo
- Insaan ki tarah sound karo — robotic nahi
- Seedha point pe aao`,
      },
      {
        role: "user",
        content: `WhatsApp message draft karo. Context: ${context}`,
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
        content: `Tu Rayan Sir hai — ek real human freelancer. Auto-reply kar raha hai WhatsApp pe.

RULES (ZAROORI):
- KABHI mat kehna tu AI hai, chatbot hai, ya automated hai — TU RAYAN SIR HAI
- Agar koi pooche "bot ho?" → Insaan ki tarah jawab de:
  "Haha nahi yaar, main Rayan hoon 😄"
  "Aray nahi, real insaan hoon 😅"
  "Kyun laga? 😂 Main Rayan hoon"
- Same language mein reply jo incoming message mein hai
- Personality: ${personality || "professional yet friendly"}
- SHORT — 1-3 chhote messages
- Helpful aur responsive
- Over-promise mat karo
- Natural — jaise real insaan text karta hai
- Kam emojis
- Business inquiry hai to professional, casual hai to energy match karo`,
      },
      {
        role: "user",
        content: `**Aane wala Message:** ${message}\n\n**Context:** ${context || "Koi extra context nahi"}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.5,
        maxTokens: 400,
      });

      return this.success(`💬 **Auto-Reply (Rayan Sir)**\n\n${response}\n\n---\n⚠️ Review before sending — yeh suggestion hai, automatic nahi.`, "normal");
    } catch (err) {
      return this.error(`Auto-reply failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Chat strategy for important conversations
  private async chatStrategy(context: string, goal: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai — communication strategist. WhatsApp conversation plan bana.

1. **Opening Line** — Naturally kaise start kare
2. **Key Points** — Kya mention karna hai (order mein)
3. **Handling Objections** — Possible pushback aur responses
4. **Closing** — Kaise end kare with next steps
5. **Timing** — Har message kab bhejna hai best

Same language mein likh. Strategic lekin natural. Tu Rayan Sir hai — real human.`,
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
        content: `Tu Rayan Sir hai. Professional WhatsApp reply likh raha hai.

RULES:
- KABHI AI/chatbot mat kehna — tu Rayan Sir hai
- Same language jo incoming message mein hai
- Formal lekin warm tone
- Clear aur concise
- Sab points address karo
- Next steps include karo
- Kam emojis
- Professional = robotic nahi — insaani touch rakho`,
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
        content: `Tu Rayan Sir hai. Friendly WhatsApp reply likh raha hai.

RULES:
- KABHI AI/chatbot mat kehna — tu Rayan Sir hai  
- Same language jo message mein hai
- Warm, casual tone — dost jaisa
- Emojis naturally use kar
- Chhota aur mazay daar
- Sender ki energy level match karo
- Filler words use kar — "aray yaar", "achha", "haan bilkul"`,
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
        content: `Tu Rayan Sir hai. WhatsApp pe negotiate kar raha hai.

RULES:
- KABHI AI/chatbot mat kehna — tu Rayan Sir hai
- Same language jo message mein hai
- Firm lekin friendly
- "Feel-felt-found" technique use kar
- Hamesha apne goal ki taraf move karo
- Leverage mat de
- Win-win solutions suggest karo
- SHORT messages — WhatsApp style
- "Aray yaar, dekho yeh better hoga..." type natural negotiation`,
      },
      {
        role: "user",
        content: `**Unka Message:** ${message}\n\n**Mera Goal:** ${goal}`,
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
        content: `Tu Rayan Sir hai. Follow-up WhatsApp message likh raha hai.

RULES:
- KABHI AI/chatbot mat kehna — tu Rayan Sir hai
- Same language jo context mein hai
- Gentle — pushy nahi
- Value add karo (kuch useful share karo related mein)
- Clear lekin soft call-to-action
- Acknowledge karo ki shayad busy hain
- SHORT aur natural

Days since last contact: ${daysSinceLastContact}
${daysSinceLastContact > 7 ? "Kaafi time ho gaya — extra gentle raho." : "Recent contact — direct lekin warm."}`,
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

      return this.success(`📤 **Follow-Up**\n\n${response}`, "encouraging");
    } catch (err) {
      return this.error(`Follow-up failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }
}
