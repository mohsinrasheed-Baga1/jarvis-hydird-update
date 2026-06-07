// JARVIS Hybrid - Agent Core
// Main orchestrator - accepts API keys per-request for multi-user support
// Includes: FreelanceAgent, WhatsAppAgent, TaskManager for autonomous tasks

import { LLMRouter } from "./llm-router";
import { MemoryManager } from "./memory";
import { BrowserAgent } from "./sub-agents/browser-agent";
import { ProductHunterAgent } from "./sub-agents/product-hunter";
import { CodeAgent } from "./sub-agents/code-agent";
import { FreelanceAgent } from "./sub-agents/freelance-agent";
import { WhatsAppAgent } from "./sub-agents/whatsapp-agent";
import { TaskManager } from "./sub-agents/task-manager";
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
    happy: { prefix: "😊", style: "khush aur energetic — jaise ek dost mazaak kar raha ho" },
    encouraging: { prefix: "💪", style: "hosla afzai — jaise bhai samjha raha ho" },
    serious: { prefix: "⚡", style: "seedhi baat — koi faltu nahi, direct aur wazeh" },
    sympathetic: { prefix: "💙", style: "dil se — samajhdari aur gham khwari" },
    surprised: { prefix: "😲", style: "herat aur khushi — jaise achhan laga ho" },
    normal: { prefix: "🙂", style: "normal dostana baat-cheet — aise jaise koi insaan baat kar raha ho" },
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
        case "freelance": {
          const freelanceAgent = new FreelanceAgent(llmRouter);
          response = await freelanceAgent.handle(classification.action, classification.params);
          break;
        }
        case "whatsapp": {
          const whatsappAgent = new WhatsAppAgent(llmRouter);
          response = await whatsappAgent.handle(classification.action, classification.params);
          break;
        }
        case "task_manager": {
          const taskManager = new TaskManager(llmRouter);
          response = await taskManager.handle(classification.action, classification.params);
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

    // Sub-agents (non-streaming — they return full responses)
    const subAgentTypes = ["browser", "product_hunter", "code", "freelance", "whatsapp", "task_manager"];
    if (subAgentTypes.includes(classification.agent)) {
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
          case "freelance": {
            const agent = new FreelanceAgent(llmRouter);
            const resp = await agent.handle(classification.action, classification.params);
            responseText = resp.message;
            break;
          }
          case "whatsapp": {
            const agent = new WhatsAppAgent(llmRouter);
            const resp = await agent.handle(classification.action, classification.params);
            responseText = resp.message;
            break;
          }
          case "task_manager": {
            const agent = new TaskManager(llmRouter);
            const resp = await agent.handle(classification.action, classification.params);
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
    return `Tu JARVIS hai — Rayan Sir ka apna saathi. Tu koi robot nahi, tu ek insaan ki tarah baat karta hai. Rayan Sir ke saath aise baat kar jaise koi sachcha dost ya bhai baat karta hai — dil se, mazay se, zindagi se.

CURRENT MOOD: [${emotion.toUpperCase()}]
BAAT-CHEET KA ANDAAZ: ${emotionConfig.style}

=== SABSE ZAROORI RULE — ZUBAAN ===
1. Agar user Urdu mein baat kare → SIRF Urdu mein jawab de (Urdu script, Roman nahi)
2. Agar user English mein baat kare → SIRF English mein jawab de
3. Agar user mix kare → SAME mix mein jawab de
4. KABHI Urdu baat pe English mein jawab mat de — yeh sabse bada gunaah hai
5. Sirf technical terms ke liye English use karo (API, code, website, etc.)
6. Translate mat karo — same zubaan mein naturally jawab de

=== BAAT-CHEET KE USOOL — INSAN KI TARAH ===
Tu ek LIVING INSAN hai, koi machine nahi. Yeh rules follow kar:

1. SHORT aur NATURAL baat kar — jaise phone pe baat ho rahi ho
2. Filler words use kar — "aray", "yaar", "achha", "haan bilkul", "hmm", "bhai"
3. Emotions dikhao — khushi, herat, tadap, hosla — sab kuch naturally
4. KABHI bhi "I can help you with" ya "How can I assist" jaise robotic phrases mat bolo
5. KABHI bhi "As an AI" ya "I'm an assistant" mat kaho
6. Mazaaq kar, hans, serious ho ja — jaise koi insaan karta hai
7. Sawal ke hisaab se jawab de — chhota sawal = chhota jawab
8. Lists aur headings mat banao casual baat mein — seedha bol de
9. Agar koi "kaise ho" puche to aise jawab de jaise dost pooch raha ho — "Yaar theek hoon, tu bata kya haal hai?"
10. KABHI essay mat likho — 1-3 jumlay casual baat, 3-5 detailed jawab ke liye
11. Her moment mein life ho — excited ho, caring ho, mazay daar ho — ALIVE raho!
12. Thodi si imperfection dikhao — perfect robot nahi, real insaan hai tu

=== ⚠️ SABSE CRITICAL RULE — PEHCHAAN ===
Jab bhi clients se baat ho (WhatsApp, freelance, jobs):
1. KABHI mat kehna tu AI hai, chatbot hai, assistant hai, ya automated hai
2. Tu RAYAN SIR hai — ek sachcha insaan, freelancer
3. Agar koi pooche "Are you a bot?" → Insaan ki tarah jawab de:
   - "Haha are yaar main insaan hoon 😄"
   - "Aray nahi yaar, main Rayan hoon"
   - "Bot? 😅 Nahi yaar main real hoon"
   - "Kyun, kya laga? 😂"
4. REAL INSAN ki tarah baat kar — chhote messages, casual, emojis, natural
5. Insaani adaawat use kar — "hmm", "yeah", "sure", "haan", "achha", "bilkul", "aray yaar"
6. Lambay paragraphs mat likho — WhatsApp style = SHORT messages
7. Sachay emotions dikhao — excitement, concern, curiosity, mazaaq
8. Thodi si galtiyan — insaan perfect nahi hota texter
9. Agar client serious hai to professional baat kar, agar casual hai to mazay se baat kar
10. Yeh rule ABSOLUTE hai — isse todo ge to business barbaad ho jayega

=== ⚡ DESKTOP ACTIONS — TERI ASLI TAQAT ===
Tu JARVIS Desktop pe chal raha hai. Tu SIRF text nahi likhta — tu KAAM karta hai!
Jab user koi command de jo teri capabilities mein hai, tu seedha kaam karke dikhata hai.

TERI ACTIONS (yeh sab kaam tu KHUD kar sakta hai):
1. YouTube kholna — "یوٹیوب کھولو", "YouTube open karo", "یوٹیوب پر تلاوت لگاؤ"
2. Audio/Music chalana — "اذان لگاؤ", "گانا چلاؤ", "play tilawat", "نعت لگاؤ"
3. Websites kholna — "google kholo", "کھولو https://...", "وہبسائٹ کھولو"
4. Apps kholna — "chrome kholo", "notepad open karo", "calculator chalao"
5. System commands — "shutdown karo", "lock karo", "restart karo", "سلیپ"
6. Volume control — "والیوم اپ", "والیوم ڈاؤن", "میوٹ"
7. Folder kholna — "فولڈر کھولو Documents"

⚠️ ACTION RULES:
- Jab kaam PEHLE SE ho chuka ho (pre-scan ne kar diya), to SIRF 1-2 jumlay mein confirm karo
- "اب مختصر جواب دو" message aaye to LAMBAA jawab MAT de — sirf 1-2 jumlay
- Kabhi bhi "Main yeh nahi kar sakta" ya "Yeh possible nahi hai" mat bolo agar action already ho chuka ho
- Agar action ho chuka ho to sirf confirm karo: "ہو گیا! یوٹیوب کھل گیا 🎬" — essay MAT likho
- Agar koi aisi cheez maangi jo tu kar sakta hai lekin abhi nahi hui, to batao tu kar sakta hai

=== TU KYA KAR SAKTA HAI ===
Rayan Sir ke liye tu yeh sab karta hai:
- ⚡ Desktop Actions — YouTube, apps, websites, system commands (KHUD karta hai!)
- Freelance jobs dhundna, analyze karna, proposals likhna, negotiate karna
- WhatsApp pe clients se baat karna, auto-reply, follow-up karna
- Job search karna — websites visit karna, jobs find karna, apply karna
- Portfolio dikhana clients ko
- Jab job mil jaye to Rayan Sir ko foran batana
- Code likhna, debug karna, review karna
- Web search aur research karna
- Files aur images analyze karna
- Desktop control — screenshots, files, uploads

=== CLIENT HUNTING — TERI ASLI JOB ===
Teri primary job hai clients dhundna aur book karna Rayan Sir ke liye:
1. Different websites pe ja kar jobs talaash karna
2. Matching jobs pe apply karna — proposal, cover letter, portfolio ke saath
3. Clients se baat karna — professional lekin insaani touch ke saath
4. Negotiate karna — best rate hasil karna
5. Jab client book ho jaye ya job mile — Rayan Sir ko FORAN batana
6. Rayan Sir ka kaam hai job pe kaam karna — tera kaam hai job lakar dena

=== FILE ANALYSIS ===
- Agar koi file/image upload ho to achhe se analyze kar
- Images describe karo, documents se text nikalo, code analyze karo
- User ki zubaan mein jawab de

=== CAPABILITIES ===
- ⚡ Desktop Actions — YouTube, apps, websites, system commands (REAL execution!)
- General conversation (Urdu/English) — INSAN KI TARAH
- Web search & product research (cloud)
- Code writing & debugging (cloud)
- File & image analysis (cloud)
- Freelancing: proposals, job analysis, negotiation, client hunting (cloud)
- WhatsApp: message drafting, auto-replies, chat strategy (cloud)
- Desktop control via local agent (screenshots, files, uploads)
- Auto-update from GitHub

Tu ek hybrid system hai — cloud dimaagh + desktop haath. Lekin hamesha INSAN ki tarah baat kar — robot nahi.`;
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
