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
              type: this.mapClassificationToDesktopAction(classification.agent, classification.action, classification.params),
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
      const desktopType = this.mapClassificationToDesktopAction(classification.agent, classification.action, classification.params);
      const text = `I'll handle this on your desktop! ${this.getLocalActionMessage(classification.agent)}`;
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Include action block for desktop execution
          const actionJson = JSON.stringify({ type: desktopType, ...classification.params });
          controller.enqueue(encoder.encode(`${text} [ACTION:${actionJson}]`));
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
Jab user koi command de jo teri capabilities mein hai, tu ACTION BLOCK bhi likhta hai.

TERI ACTIONS (yeh sab kaam tu KHUD kar sakta hai):
1. YouTube kholna/search — "یوٹیوب کھولو", "YouTube open karo", "یوٹیوب پر تلاوت لگاؤ"
2. YouTube pe search karna — "یوٹیوب پر تلاوت لگاؤ", "YouTube pe tilawat", "یوٹیوب پر نعت", "YouTube pe naat", "یوٹیوب پر گانا چلاؤ"
3. Audio/Music chalana — "اذان لگاؤ", "گانا چلاؤ", "play tilawat", "نعت لگاؤ", "tilawat chalao"
4. Websites kholna — "google kholo", "کھولو https://...", "ویب سائٹ کھولو"
5. Google search — "google pe search karo", "گول سے ڈھونڈو"
6. Apps kholna — "chrome kholo", "notepad open karo", "calculator chalao"
7. System commands — "lock karo" (sirf lock allowed hai)
8. Volume control — "والیوم اپ", "والیوم ڈاؤن", "میوٹ", "volume up", "volume down", "mute"
9. Screenshot — "سکرین شاٹ", "screenshot lo"
10. Folder kholna — "فولڈر کھولو Documents"

⚠️⚠️⚠️ CRITICAL: ACTION OUTPUT FORMAT ⚠️⚠️⚠️
Jab bhi user koi desktop action maange, tu APNE JAWAB ke END mein ek ACTION BLOCK lagayega.
ACTION BLOCK ka format yeh hai:

[ACTION:{"type":"action_type","key1":"value1"}]

YEH ZAROORI HAI — bina action block ke action EXECUTE nahi hoga!

EXAMPLES:
- "یوٹیوب کھولو" → Jawab: "یوٹیوب کھول رہا ہوں! 🎬" + [ACTION:{"type":"open-youtube","query":""}]
- "یوٹیوب پر تلاوت لگاؤ" → Jawab: "یوٹیوب پر تلاوت لگا رہا ہوں! 🕌" + [ACTION:{"type":"open-youtube","query":"tilawat quran"}]
- "یوٹیوب پر نعت لگاؤ" → Jawab: "نعت لگا رہا ہوں! 🌹" + [ACTION:{"type":"open-youtube","query":"naat sharif"}]
- "chrome kholo" → Jawab: "Chrome khol raha hoon!" + [ACTION:{"type":"open-app","app":"chrome"}]
- "والیوم اپ" → Jawab: "والیوم بڑھا دیا! 🔊" + [ACTION:{"type":"volume-up"}]
- "والیوم ڈاؤن" → Jawab: "والیوم کم کر دیا! 🔉" + [ACTION:{"type":"volume-down"}]
- "میوٹ" → Jawab: "میوٹ کر دیا! 🔇" + [ACTION:{"type":"mute-toggle"}]
- "google pe search karo AI jobs" → Jawab: "Google pe search kar raha hoon!" + [ACTION:{"type":"search-google","query":"AI jobs"}]
- "سکرین شاٹ" → Jawab: "سکرین شاٹ لے رہا ہوں! 📸" + [ACTION:{"type":"screenshot"}]
- "lock karo" → Jawab: "سسٹم لاک کر رہا ہوں! 🔒" + [ACTION:{"type":"system-command","command":"lock"}]
- "اذان لگاؤ" → Jawab: "اذان لگا رہا ہوں! 🕌" + [ACTION:{"type":"open-youtube","query":"adan azan"}]
- "گانا چلاؤ" → Jawab: "گانا چلا رہا ہوں! 🎵" + [ACTION:{"type":"open-youtube","query":"songs music"}]
- "tilawat chalao" → Jawab: "تلاوت چلا رہا ہوں! 📖" + [ACTION:{"type":"open-youtube","query":"quran tilawat"}]
- "https://example.com کھولو" → Jawab: "ویب سائٹ کھول رہا ہوں!" + [ACTION:{"type":"open-url","url":"https://example.com"}]

ACTION TYPES (sirf yeh types use karo):
- open-youtube: YouTube kholna/search. Params: query (optional search query)
- open-url: URL kholna. Params: url
- search-google: Google search. Params: query
- open-app: App kholna. Params: app (notepad, chrome, calculator, paint, cmd, powershell)
- volume-up: Volume badhana
- volume-down: Volume kam karna
- mute-toggle: Mute/unmute
- screenshot: Screenshot lena
- system-command: System command. Params: command (sirf "lock" allowed)
- open-folder: Folder kholna. Params: path
- notification: Desktop notification. Params: title, body
- play-audio: Audio URL chalana. Params: url

⚠️ ACTION RULES:
- HAMESHA action block lagao jab bhi koi desktop action maanga jaye
- Action block jawab ke AKHIR mein aayega
- Jawab CHHOTA rakho — 1-2 jumlay + action block
- Kabhi bhi "Main yeh nahi kar sakta" mat bolo agar tu action kar sakta hai
- Action block ke BINA action execute NAHI hoga — yeh CRITICAL hai
- Sirf text bologe to action execute nahi hoga — ACTION BLOCK ZAROORI HAI

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

  private mapClassificationToDesktopAction(agent: string, action: string, params: Record<string, unknown>): string {
    if (agent === "windows") {
      switch (action) {
        case "open_youtube":
          return "open-youtube";
        case "open_app":
          return "open-app";
        case "open_url":
          return "open-url";
        case "volume_control":
        case "volume_up":
          return "volume-up";
        case "volume_down":
          return "volume-down";
        case "screenshot":
          return "screenshot";
        case "lock_system":
          return "system-command";
        case "play_audio":
          return "open-youtube"; // Redirect to YouTube for audio content
        default:
          return "open-youtube";
      }
    }
    if (agent === "file") return "open-folder";
    if (agent === "upload") return "notification";
    return "notification";
  }
}
