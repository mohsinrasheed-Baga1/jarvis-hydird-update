// JARVIS Hybrid - Freelance Agent
// Handles freelancing automation: proposals, job matching, client communication, negotiation

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
}

interface ProposalRequest {
  job: JobPosting;
  userProfile: string;
  rate?: string;
  tone?: "professional" | "friendly" | "confident";
}

export class FreelanceAgent extends BaseAgent {
  constructor(llmRouter: LLMRouter) {
    super("freelance", llmRouter);
  }

  async handle(action: string, params: Record<string, unknown>, ...args: unknown[]): Promise<AgentResponse> {
    switch (action) {
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
      case "client_response":
        return this.generateClientResponse(params.context as string, params.tone as string);
      case "pricing_strategy":
        return this.pricingStrategy(params.job as JobPosting, params.experience as string);
      case "job_search_strategy":
        return this.jobSearchStrategy(params.skills as string[], params.platform as string);
      default:
        return this.generateProposal(params as unknown as ProposalRequest);
    }
  }

  // Generate a winning proposal for a job
  private async generateProposal(request: ProposalRequest): Promise<AgentResponse> {
    const { job, userProfile, rate, tone = "professional" } = request;

    const prompt = [
      {
        role: "system",
        content: `You are an expert freelancer who writes WINNING proposals. You understand client psychology and know how to stand out from competition.

RULES:
- Write in the SAME language as the job description (if Urdu, write Urdu; if English, write English)
- Start with a hook that shows you understand the client's PROBLEM
- Mention specific relevant experience that matches their needs
- Include a brief action plan showing HOW you'll solve their problem
- Add social proof or results from similar projects
- End with a clear call-to-action
- Be confident but not arrogant
- Keep it concise (150-250 words max for the main body)
- Tone: ${tone}

DO NOT use generic templates. Make it PERSONAL and SPECIFIC to this job.`,
      },
      {
        role: "user",
        content: `Generate a winning proposal for this job:

**Job Title:** ${job.title}
**Description:** ${job.description}
${job.budget ? `**Budget:** ${job.budget}` : ""}
${job.skills ? `**Required Skills:** ${job.skills.join(", ")}` : ""}
${job.platform ? `**Platform:** ${job.platform}` : ""}
${job.clientName ? `**Client:** ${job.clientName}` : ""}

**My Profile:** ${userProfile}
${rate ? `**My Rate:** ${rate}` : ""}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.7,
        maxTokens: 1000,
      });

      return this.success(`📝 **Winning Proposal Generated!**\n\n${response}\n\n---\n💡 *Tip: Customize the proposal further based on any additional details about the client.*`, "happy", {
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
        content: `You are a freelance career advisor. Analyze this job posting and provide:
1. **Client Intent** - What they REALLY want (beyond the description)
2. **Red Flags** - Any warning signs (vague requirements, unrealistic budget, etc.)
3. **Competition Level** - How competitive this job likely is
4. **Winning Strategy** - What angle to take in your proposal
5. **Suggested Bid Range** - What price range to target
6. **Key Skills to Highlight** - Which of your skills to emphasize
7. **Questions to Ask** - Smart questions that show expertise

Respond in the SAME language as the job description. Be specific and actionable.`,
      },
      {
        role: "user",
        content: `Analyze this job posting:

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
        content: `You are a skill matching expert. Compare the job requirements with the user's profile and provide:
1. **Match Score** - Percentage match (0-100%)
2. **Strong Matches** - Skills that directly align
3. **Partial Matches** - Skills that are somewhat relevant
4. **Gaps** - Required skills the user lacks
5. **How to Bridge Gaps** - Suggestions for addressing missing skills
6. **Recommended Approach** - Best angle for the proposal given the match level

Be honest but encouraging. Respond in English.`,
      },
      {
        role: "user",
        content: `**Job:** ${job.title}\n${job.description}\n${job.skills ? `Skills needed: ${job.skills.join(", ")}` : ""}\n\n**User Profile:** ${userProfile}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.3,
        maxTokens: 1200,
      });

      return this.success(`🎯 **Skill Match Analysis**\n\n${response}`, "encouraging", { job });
    } catch (err) {
      return this.error(`Skill matching failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Generate negotiation responses
  private async negotiate(context: string, goal: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `You are a master negotiator for freelancers. Help the user negotiate effectively.

RULES:
- Never accept the first low offer without counter-offering
- Always provide value justification
- Use the "Yes, and..." technique
- Suggest win-win solutions
- Know when to walk away
- Be professional but firm
- Respond in the SAME language as the context

Provide:
1. **Recommended Response** - What to say back
2. **Strategy** - Why this approach works
3. **Bottom Line** - The minimum acceptable offer
4. **Walk-away Point** - When to politely decline`,
      },
      {
        role: "user",
        content: `**Context:** ${context}\n\n**My Goal:** ${goal}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.5,
        maxTokens: 1000,
      });

      return this.success(`🤝 **Negotiation Strategy**\n\n${response}`, "serious");
    } catch (err) {
      return this.error(`Negotiation help failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Generate cover letter
  private async generateCoverLetter(request: ProposalRequest): Promise<AgentResponse> {
    const { job, userProfile, tone = "professional" } = request;

    const prompt = [
      {
        role: "system",
        content: `Write a professional cover letter for a freelance job application.

RULES:
- Write in the SAME language as the job description
- Tone: ${tone}
- Keep it under 200 words
- Focus on RESULTS, not just skills
- Show enthusiasm for the specific project
- Include a clear value proposition
- End with next steps

Make it PERSONAL and SPECIFIC. No generic phrases.`,
      },
      {
        role: "user",
        content: `**Job:** ${job.title}\n${job.description}\n\n**My Profile:** ${userProfile}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.6,
        maxTokens: 600,
      });

      return this.success(`✉️ **Cover Letter**\n\n${response}`, "happy");
    } catch (err) {
      return this.error(`Cover letter generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Generate response to client messages
  private async generateClientResponse(context: string, tone: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `You are a professional freelancer responding to a client message.

RULES:
- Respond in the SAME language as the client
- Tone: ${tone || "professional"}
- Be prompt and clear
- Address all their concerns
- Show you understand their needs
- Move the conversation forward
- Keep it concise but warm`,
      },
      {
        role: "user",
        content: `**Client Message:** ${context}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.5,
        maxTokens: 500,
      });

      return this.success(`💬 **Suggested Response**\n\n${response}`, "normal");
    } catch (err) {
      return this.error(`Response generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Pricing strategy
  private async pricingStrategy(job: JobPosting, experience: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `You are a freelance pricing expert. Help the user set the right price.

Provide:
1. **Recommended Rate** - Specific price range
2. **Pricing Method** - Hourly vs fixed, and why
3. **Value Points** - What to emphasize to justify the rate
4. **Anchoring Strategy** - How to present the price
5. **Discount Strategy** - If and when to offer discounts

Respond in English with specific numbers and reasoning.`,
      },
      {
        role: "user",
        content: `**Job:** ${job.title}\n${job.description}\n${job.budget ? `**Client Budget:** ${job.budget}` : ""}\n\n**My Experience:** ${experience}`,
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
        content: `You are a freelance career strategist. Help the user find and win jobs.

Provide:
1. **Best Platforms** - Where to find jobs matching their skills
2. **Profile Optimization** - How to make their profile stand out
3. **Search Keywords** - What terms to search for
4. **Application Strategy** - When and how to apply
5. **Niche Positioning** - How to position themselves as an expert
6. **Daily Routine** - Suggested daily actions for job hunting

Be specific and actionable. Respond in the user's likely language based on the context.`,
      },
      {
        role: "user",
        content: `**My Skills:** ${skills.join(", ")}\n**Target Platform:** ${platform || "All"}`,
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
