// JARVIS Hybrid - Task Manager
// Orchestrates autonomous tasks: break down → execute → report
// Works with FreelanceAgent, WhatsAppAgent, and other agents

import { BaseAgent } from "./base-agent";
import type { LLMRouter } from "@/lib/llm-router";
import type { AgentResponse } from "@/lib/protocol";
import { FreelanceAgent } from "./freelance-agent";
import { WhatsAppAgent } from "./whatsapp-agent";

export interface AutonomousTask {
  id: string;
  type: string;
  description: string;
  status: "pending" | "planning" | "executing" | "completed" | "failed" | "paused";
  steps: TaskStep[];
  currentStep: number;
  result?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TaskStep {
  id: string;
  description: string;
  agent: string;
  action: string;
  params: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  result?: string;
}

export class TaskManager extends BaseAgent {
  constructor(llmRouter: LLMRouter) {
    super("task_manager", llmRouter);
  }

  async handle(action: string, params: Record<string, unknown>, ...args: unknown[]): Promise<AgentResponse> {
    switch (action) {
      case "plan":
        return this.planTask(params.description as string, params.context as string);
      case "execute_freelance":
        return this.executeFreelanceTask(params as Record<string, unknown>);
      case "execute_whatsapp":
        return this.executeWhatsAppTask(params as Record<string, unknown>);
      case "quick_proposal":
        return this.quickProposal(params.jobDescription as string, params.userProfile as string);
      case "quick_reply":
        return this.quickReply(params.message as string, params.tone as string);
      case "daily_plan":
        return this.generateDailyPlan(params.skills as string[], params.goals as string);
      default:
        return this.planTask(params.description as string, "");
    }
  }

  // Plan a complex autonomous task
  private async planTask(description: string, context: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `You are an autonomous task planner for JARVIS AI. Break down the user's task into executable steps.

Available Agents:
- **freelance**: generate_proposal, analyze_job, match_skills, negotiate, cover_letter, client_response, pricing_strategy, job_search_strategy
- **whatsapp**: draft_message, auto_reply, chat_strategy, professional_reply, friendly_reply, negotiate_chat, follow_up
- **browser**: search, scrape, summarize
- **code**: write, debug, review

For each step, provide:
1. Step description
2. Which agent to use
3. What action to call
4. Required parameters

Respond with ONLY valid JSON:
{
  "title": "Task Title",
  "steps": [
    {
      "description": "What this step does",
      "agent": "agent_name",
      "action": "action_name",
      "params": {}
    }
  ],
  "estimatedTime": "X minutes",
  "requiresDesktop": true/false
}

Be practical. Only include steps that can actually be executed. If a task requires browser automation (like actually clicking Apply on Upwork), mark requiresDesktop: true.`,
      },
      {
        role: "user",
        content: `**Task:** ${description}\n${context ? `**Context:** ${context}` : ""}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.3,
        maxTokens: 1500,
      });

      const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const plan = JSON.parse(cleaned);

      return this.success(`📋 **Task Plan: ${plan.title}**\n\n${plan.steps.map((s: TaskStep, i: number) => `${i + 1}. **${s.description}** → ${s.agent}.${s.action}`).join("\n")}\n\n⏱️ Estimated: ${plan.estimatedTime || "N/A"}\n${plan.requiresDesktop ? "🖥️ Requires desktop agent for some steps" : "☁️ Fully cloud-executable"}`, "serious", plan);
    } catch (err) {
      // Fallback: return a basic plan
      return this.success(`📋 **Task Plan**\n\nTask: ${description}\n\nI'll break this down and execute step by step. Tell me more details to get started!`, "encouraging");
    }
  }

  // Execute a freelancing task end-to-end
  private async executeFreelanceTask(params: Record<string, unknown>): Promise<AgentResponse> {
    const freelanceAgent = new FreelanceAgent(this.llmRouter);
    const { jobTitle, jobDescription, userProfile, budget, platform, action = "generate_proposal" } = params;

    const job = {
      title: jobTitle as string,
      description: jobDescription as string,
      budget: budget as string,
      platform: platform as string,
    };

    try {
      // Step 1: Analyze the job first
      const analysis = await freelanceAgent.handle("analyze_job", { job });
      
      // Step 2: Generate proposal
      const proposal = await freelanceAgent.handle(action as string, {
        job,
        userProfile: userProfile || "Experienced freelancer",
        tone: "professional",
      });

      return this.success(
        `🚀 **Freelance Task Complete!**\n\n---\n${analysis.message}\n\n---\n${proposal.message}`,
        "happy",
        { job, analysis: analysis.data, proposal: proposal.data }
      );
    } catch (err) {
      return this.error(`Freelance task failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Execute a WhatsApp task
  private async executeWhatsAppTask(params: Record<string, unknown>): Promise<AgentResponse> {
    const whatsappAgent = new WhatsAppAgent(this.llmRouter);
    const { message, context, action = "auto_reply", tone } = params;

    try {
      const result = await whatsappAgent.handle(action as string, {
        message,
        context,
        tone: tone || "professional",
      });

      return this.success(`📱 **WhatsApp Task Complete!**\n\n${result.message}`, "happy");
    } catch (err) {
      return this.error(`WhatsApp task failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Quick proposal generation
  private async quickProposal(jobDescription: string, userProfile: string): Promise<AgentResponse> {
    const freelanceAgent = new FreelanceAgent(this.llmRouter);

    try {
      const result = await freelanceAgent.handle("generate_proposal", {
        job: { title: "Job", description: jobDescription },
        userProfile: userProfile || "Experienced professional",
        tone: "confident",
      });

      return result;
    } catch (err) {
      return this.error(`Quick proposal failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Quick reply
  private async quickReply(message: string, tone: string): Promise<AgentResponse> {
    const whatsappAgent = new WhatsAppAgent(this.llmRouter);

    try {
      const result = await whatsappAgent.handle(
        tone === "professional" ? "professional_reply" : tone === "friendly" ? "friendly_reply" : "auto_reply",
        { message, tone: tone || "friendly" }
      );

      return result;
    } catch (err) {
      return this.error(`Quick reply failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  // Generate daily freelancing plan
  private async generateDailyPlan(skills: string[], goals: string): Promise<AgentResponse> {
    const prompt = [
      {
        role: "system",
        content: `You are a freelance career coach. Create a daily action plan for a freelancer.

Provide:
1. **Morning Routine** (first 2 hours) - Profile updates, job browsing
2. **Active Hours** (4-6 hours) - Applying, working, communicating
3. **Evening Review** (1 hour) - Follow-ups, planning tomorrow
4. **Weekly Goals** - What to achieve this week
5. **Priority Tasks** - Most impactful things to do today
6. **Scripts/Templates** - Ready-to-use messages for today

Be specific and actionable. Include actual message templates they can use.`,
      },
      {
        role: "user",
        content: `**Skills:** ${skills.join(", ") || "General"}\n**Goals:** ${goals || "Get more clients and earn more"}`,
      },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.5,
        maxTokens: 2000,
      });

      return this.success(`📅 **Daily Freelance Plan**\n\n${response}`, "encouraging");
    } catch (err) {
      return this.error(`Daily plan generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }
}
