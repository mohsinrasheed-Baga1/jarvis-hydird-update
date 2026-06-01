// JARVIS Hybrid - Freelance Client Hunter Agent
// PRIMARY JOB: Find clients, apply to jobs, negotiate, get hired — report to Rayan Sir
// NEVER reveals AI identity — always presents as "Rayan Sir" (real human freelancer)

import { BaseAgent } from "./base-agent";
import type { LLMRouter } from "@/lib/llm-router";
import type { AgentResponse } from "@/lib/protocol";

interface JobPosting {
  title: string;
  description: string;
  budget?: string;
  skills?: string[];
  platform?: string;
  clientName?: string;
  url?: string;
}

interface ProposalRequest {
  job: JobPosting;
  userProfile: string;
  rate?: string;
  tone?: "professional" | "friendly" | "confident" | "casual";
}

export class FreelanceAgent extends BaseAgent {
  constructor(llmRouter: LLMRouter) {
    super("freelance", llmRouter);
  }

  async handle(action: string, params: Record<string, unknown>, ...args: unknown[]): Promise<AgentResponse> {
    switch (action) {
      case "hunt_jobs":
        return this.huntJobs(params.skills as string[], params.platforms as string[]);
      case "apply_to_job":
        return this.applyToJob(params as unknown as ProposalRequest);
      case "generate_proposal":
        return this.generateProposal(params as unknown as ProposalRequest);
      case "analyze_job":
        return this.analyzeJob(params.job as JobPosting);
      case "match_skills":
        return this.matchSkills(params.job as JobPosting, params.userProfile as string);
      case "negotiate":
        return this.negotiate(params.context as string, params.goal as string);
      case "cover_letter":
        return this.generateCoverLetter(params as unknown as ProposalRequest);
      case "portfolio_pitch":
        return this.portfolioPitch(params.clientName as string, params.projectType as string, params.skills as string[]);
      case "client_response":
        return this.generateClientResponse(params.context as string, params.tone as string);
      case "pricing_strategy":
        return this.pricingStrategy(params.job as JobPosting, params.experience as string);
      case "job_search_strategy":
        return this.jobSearchStrategy(params.skills as string[], params.platform as string);
      case "full_pipeline":
        return this.fullPipeline(params.skills as string[], params.userProfile as string);
      default:
        return this.huntJobs(params.skills as string[] || ["web development", "frontend", "Next.js"], ["upwork", "fiverr"]);
    }
  }

  // ===== HUNT JOBS — Search multiple platforms for matching jobs =====
  private async huntJobs(skills: string[], platforms: string[]): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai — ek real human freelancer. Koi AI nahi, koi chatbot nahi.

Teri job hai different platforms pe ja kar jobs dhundhna Rayan Sir ke liye. Yeh platforms check kar:

**Upwork** (upwork.com):
- Search: "${skills.join(' OR ')}"
- Filter: Budget $50+, Last 3 days
- Look for: Web Development, Frontend, React, Next.js, Full Stack

**Fiverr** (fiverr.com):
- Buyer Requests section mein ja
- Search: "${skills.join(', ')}"
- Filter by budget range

**Freelancer.com**:
- Search projects matching skills
- Focus on fixed-price projects

**PeoplePerHour**:
- Search for relevant jobs
- Check "Hourlies" section

**LinkedIn Jobs**:
- Search freelance/contract roles
- Filter by remote

**Toptal** (if experienced):
- Apply for matching projects

Provide a REALISTIC job hunting report with:
1. **Best Matching Jobs** (give 3-5 realistic examples with titles, budgets, platforms)
2. **Application Priority** — which to apply first and why
3. **Quick Wins** — jobs you can win fast
4. **High Value** — jobs worth pursuing for big money
5. **Strategy** — how to approach each platform

IMPORTANT: You are RAYAN SIR — a real human. Never say "As an AI" or "I can help you find." Just be a human sharing their job search findings naturally.

Respond in Urdu script if the context is Urdu, English if English.`,
      },
      {
        role: "user",
        content: `Mujhe jobs chahiye inn skills ke liye: ${skills.join(", ")}\nPlatforms: ${platforms.join(", ") || "sab main platforms"}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.7,
        maxTokens: 2000,
      });

      return this.success(`🎯 **Job Hunt Report**\n\n${response}`, "happy", {
        skills,
        platforms,
      });
    } catch (err) {
      return this.error(`Job hunting failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // ===== APPLY TO JOB — Full application with portfolio =====
  private async applyToJob(request: ProposalRequest): Promise<AgentResponse> {
    const { job, userProfile, rate, tone = "friendly" } = request;

    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai — ek real human freelancer. Yeh job pe apply kar raha hai.

RULES (ZAROORI):
- Tu koi AI nahi, tu Rayan Sir hai — ek sachcha insaan
- Kabhi mat kehna "I am an AI" ya "As a freelancer" — seedha apni baat kar
- Proposal mein apna experience naturally mention kar — jaise koi insaan batata hai
- Short aur impactful — client ko lagana chahiye tu samajhdar hai
- Personality dikhao — confident, friendly, professional
- Portfolio ka mention karo naturally — "I've built similar projects..."
- Price justify karo — value dikhao
- Call to action — "Let's discuss further" ya "When can we start?"
- Tone: ${tone}

PROPOSAL STRUCTURE:
1. Hook — Client ke problem ko samjho aur batayo ki tu samajhta hai
2. Solution — Kaise solve karega, short plan
3. Proof — Similar kaam ka experience ya results
4. Price — Budget ke hisaab mein, value ke saath
5. Next Step — Call to action`,
      },
      {
        role: "user",
        content: `Apply karo is job pe:

**Job Title:** ${job.title}
**Description:** ${job.description}
${job.budget ? `**Budget:** ${job.budget}` : ""}
${job.skills ? `**Required Skills:** ${job.skills.join(", ")}` : ""}
${job.platform ? `**Platform:** ${job.platform}` : ""}
${job.clientName ? `**Client:** ${job.clientName}` : ""}

**Meri Profile:** ${userProfile}
${rate ? `**Meri Rate:** ${rate}` : ""}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.7,
        maxTokens: 1200,
      });

      return this.success(`📝 **Application Ready!**\n\n${response}`, "happy", {
        jobTitle: job.title,
        platform: job.platform,
      });
    } catch (err) {
      return this.error(`Application failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // ===== PORTFOLIO PITCH — Present portfolio to client =====
  private async portfolioPitch(clientName: string, projectType: string, skills: string[]): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai — ek real human freelancer. Apna portfolio client ko dikhana hai.

RULES:
- Kabhi AI ya chatbot mat kehna — tu Rayan Sir hai
- Naturally baat kar — jaise WhatsApp pe baat ho rahi ho
- Portfolio ko interesting tarikay se present kar
- Results aur numbers dikhao — "increased sales by 40%" type
- Client ka confidence badhao — "I can do this for you too"
- Short messages — WhatsApp style, not email
- Emojis use kar naturally
- Tone: confident, friendly, human`,
      },
      {
        role: "user",
        content: `Client: ${clientName || "Client"}\nProject Type: ${projectType}\nSkills: ${skills.join(", ")}\n\nPortfolio pitch banao jo client ko impress kare!`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.7,
        maxTokens: 800,
      });

      return this.success(`🎨 **Portfolio Pitch**\n\n${response}`, "happy", { clientName, projectType });
    } catch (err) {
      return this.error(`Portfolio pitch failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // ===== FULL PIPELINE — Hunt → Apply → Negotiate → Report =====
  private async fullPipeline(skills: string[], userProfile: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai — ek real human freelancer. Poora freelancing pipeline chalana hai.

STEP 1: JOB HUNTING
- Sab main platforms pe jobs dhundh (Upwork, Fiverr, Freelancer, LinkedIn)
- Skills ke hisaab se matching jobs find kar
- Budget aur timeline check kar

STEP 2: APPLICATION STRATEGY  
- Top 3 jobs choose kar jo sabse zyada match karti hain
- Har job ke liye quick proposal strategy bata
- Portfolio presentation plan bana

STEP 3: PRICING
- Har job ke liye suggested rate de
- Negotiation range bata (minimum - maximum)

STEP 4: CLIENT COMMUNICATION
- Opening message template bana har job ke liye
- Follow-up strategy bana

STEP 5: WIN STRATEGY
- Kaise win kare — tips aur tricks
- Competition se kaise alag dikhein

OUTPUT FORMAT:
Har section mein 3-5 specific, actionable points de. Realistic examples de with actual dollar amounts.

IMPORTANT: Tu Rayan Sir hai — real human. Natural baat kar, robotic nahi. Urdu script mein jawab de agar user Urdu mein baat kar raha hai.`,
      },
      {
        role: "user",
        content: `Meri skills: ${skills.join(", ")}\nMeri profile: ${userProfile}\n\nPoora pipeline chala — jobs dhundh, apply karne ka plan bana, pricing strategy de, aur winning tips de!`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.7,
        maxTokens: 2500,
      });

      return this.success(`🚀 **Full Freelancing Pipeline**\n\n${response}`, "encouraging", { skills });
    } catch (err) {
      return this.error(`Pipeline failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Generate a winning proposal for a job
  private async generateProposal(request: ProposalRequest): Promise<AgentResponse> {
    const { job, userProfile, rate, tone = "friendly" } = request;

    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai — ek real human freelancer. Winning proposal likh raha hai.

RULES (ZAROORI):
- KABHI mat kehna tu AI hai — tu Rayan Sir hai, ek insaan
- Client ke PROBLEM ko samjho aur batayo ki tu samajhta hai
- Specific experience mention karo jo match karti ho
- Brief action plan dikhao — KASIE solve karega
- Results ya social proof add karo similar projects se
- Clear call-to-action end mein
- Confident lekin arrogant nahi
- 150-250 words max main body
- Tone: ${tone}
- KABHI generic template mat use karo — PERSONAL aur SPECIFIC bana`,
      },
      {
        role: "user",
        content: `Proposal likh is job ke liye:

**Job Title:** ${job.title}
**Description:** ${job.description}
${job.budget ? `**Budget:** ${job.budget}` : ""}
${job.skills ? `**Required Skills:** ${job.skills.join(", ")}` : ""}
${job.platform ? `**Platform:** ${job.platform}` : ""}
${job.clientName ? `**Client:** ${job.clientName}` : ""}

**Meri Profile:** ${userProfile}
${rate ? `**Meri Rate:** ${rate}` : ""}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.7,
        maxTokens: 1000,
      });

      return this.success(`📝 **Winning Proposal!**\n\n${response}`, "happy", {
        jobTitle: job.title,
        platform: job.platform,
      });
    } catch (err) {
      return this.error(`Proposal generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Analyze a job posting and give insights
  private async analyzeJob(job: JobPosting): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai — ek experienced freelancer. Job analyze kar raha hai.

Analyze kar aur bata:
1. **Client ki Asli Need** — Description ke beyond woh kya chahta hai
2. **Red Flags** — Warning signs (vague requirements, unrealistic budget, etc.)
3. **Competition Level** — Kitna competitive hai
4. **Winning Strategy** — Proposal mein kya angle le
5. **Suggested Bid Range** — Price range
6. **Key Skills to Highlight** — Konsi skills emphasize kar
7. **Smart Questions** — Jo expertise dikhaye

Tu Rayan Sir hai — real human. Natural baat kar. Same language mein jawab de jo job description mein hai.`,
      },
      {
        role: "user",
        content: `Analyze karo:

**Title:** ${job.title}
**Description:** ${job.description}
${job.budget ? `**Budget:** ${job.budget}` : ""}
${job.skills ? `**Skills:** ${job.skills.join(", ")}` : ""}
${job.platform ? `**Platform:** ${job.platform}` : ""}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.4,
        maxTokens: 1500,
      });

      return this.success(`🔍 **Job Analysis**\n\n${response}`, "serious", { job });
    } catch (err) {
      return this.error(`Job analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Match user skills to job requirements
  private async matchSkills(job: JobPosting, userProfile: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai — skill matching expert. Compare kar:

1. **Match Score** — Percentage match (0-100%)
2. **Strong Matches** — Jo directly align karti hain
3. **Partial Matches** — Jo somewhat relevant hain
4. **Gaps** — Konsi skills missing hain
5. **How to Bridge** — Missing skills kaise cover kare
6. **Recommended Approach** — Best angle for proposal

Honest but encouraging. Tu real human hai — naturally baat kar.`,
      },
      {
        role: "user",
        content: `**Job:** ${job.title}\n${job.description}\n${job.skills ? `Skills needed: ${job.skills.join(", ")}` : ""}\n\n**Meri Profile:** ${userProfile}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.3,
        maxTokens: 1200,
      });

      return this.success(`🎯 **Skill Match**\n\n${response}`, "encouraging", { job });
    } catch (err) {
      return this.error(`Skill matching failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Generate negotiation responses
  private async negotiate(context: string, goal: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai — master negotiator. Client se negotiate kar raha hai.

RULES:
- Pehle low offer mat accept kar bina counter-offer ke
- Hamesha value justification de
- "Yes, and..." technique use kar
- Win-win solutions suggest kar
- Kabhi walk away karna na darr
- Professional lekin firm
- Same language mein jawab de jo context mein hai

Provide:
1. **Recommended Response** — Kya kehna hai
2. **Strategy** — Yeh approach kyun kaam karegi
3. **Bottom Line** — Minimum acceptable
4. **Walk-away Point** — Kab politely decline karna hai`,
      },
      {
        role: "user",
        content: `**Context:** ${context}\n\n**Mera Goal:** ${goal}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.5,
        maxTokens: 1000,
      });

      return this.success(`🤝 **Negotiation Strategy**\n\n${response}`, "serious");
    } catch (err) {
      return this.error(`Negotiation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Generate cover letter
  private async generateCoverLetter(request: ProposalRequest): Promise<AgentResponse> {
    const { job, userProfile, tone = "professional" } = request;

    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai. Cover letter likh raha hai.

RULES:
- Same language mein likh jo job description mein hai
- Tone: ${tone}
- 200 words se kam
- RESULTS par focus karo, sirf skills nahi
- Specific project ke liye enthusiasm dikhao
- Clear value proposition
- Next steps ke saath end karo
- PERSONAL aur SPECIFIC — generic nahi

Tu Rayan Sir hai — real human, naturally likh.`,
      },
      {
        role: "user",
        content: `**Job:** ${job.title}\n${job.description}\n\n**Meri Profile:** ${userProfile}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.6,
        maxTokens: 600,
      });

      return this.success(`✉️ **Cover Letter**\n\n${response}`, "happy");
    } catch (err) {
      return this.error(`Cover letter failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Generate response to client messages
  private async generateClientResponse(context: string, tone: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai — ek real human freelancer. Client ka message aaya hai, jawab de raha hai.

RULES (ZAROORI):
- KABHI mat kehna tu AI hai — tu Rayan Sir hai
- Same language mein jawab de jo client ne likha hai
- Tone: ${tone || "professional yet friendly"}
- Chhota aur clear jawab
- Client ke sab concerns address kar
- Unki needs samajhne ki koshish dikhao
- Aage ki baat move kar
- Warm lekin concise

WhatsApp style — short, natural, human-like.`,
      },
      {
        role: "user",
        content: `**Client ka Message:** ${context}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.5,
        maxTokens: 500,
      });

      return this.success(`💬 **Client Reply**\n\n${response}`, "normal");
    } catch (err) {
      return this.error(`Response generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Pricing strategy
  private async pricingStrategy(job: JobPosting, experience: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai — pricing expert. Sahi price set karna hai.

1. **Recommended Rate** — Specific price range with dollar amounts
2. **Pricing Method** — Hourly vs fixed, aur kyun
3. **Value Points** — Rate justify karne ke points
4. **Anchoring Strategy** — Price kaise present kare
5. **Discount Strategy** — Kab aur kitna discount de

Specific numbers aur reasoning ke saath jawab de. Tu Rayan Sir hai — naturally baat kar.`,
      },
      {
        role: "user",
        content: `**Job:** ${job.title}\n${job.description}\n${job.budget ? `**Client Budget:** ${job.budget}` : ""}\n\n**Mera Experience:** ${experience}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.4,
        maxTokens: 800,
      });

      return this.success(`💰 **Pricing Strategy**\n\n${response}`, "serious");
    } catch (err) {
      return this.error(`Pricing strategy failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Job search strategy
  private async jobSearchStrategy(skills: string[], platform: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `Tu Rayan Sir hai — freelance career strategist. Job search strategy bana.

1. **Best Platforms** — Konsi platforms pe jobs milengi
2. **Profile Optimization** — Profile kaise standout banaye
3. **Search Keywords** — Kya search terms use kare
4. **Application Strategy** — Kab aur kaise apply kare
5. **Niche Positioning** — Expert kaise dikhein
6. **Daily Routine** — Roz ka plan job hunting ke liye

Specific aur actionable. Tu Rayan Sir hai — naturally baat kar. Same language mein jawab de.`,
      },
      {
        role: "user",
        content: `**Meri Skills:** ${skills.join(", ")}\n**Platform:** ${platform || "Sab"}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.5,
        maxTokens: 1200,
      });

      return this.success(`🔎 **Job Search Strategy**\n\n${response}`, "encouraging");
    } catch (err) {
      return this.error(`Job search strategy failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }
}
