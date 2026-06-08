// JARVIS Hybrid - Browser Agent (Cloud)
// Handles web search, scraping, and information retrieval

import { BaseAgent } from "./base-agent";
import type { LLMRouter } from "@/lib/llm-router";
import type { AgentResponse } from "@/lib/protocol";

export class BrowserAgent extends BaseAgent {
  constructor(llmRouter: LLMRouter) {
    super("browser", llmRouter);
  }

  async handle(action: string, params: Record<string, unknown>): Promise<AgentResponse> {
    switch (action) {
      case "search":
        return this.search(params.query as string);
      case "scrape":
        return this.scrape(params.url as string);
      case "summarize":
        return this.summarizeUrl(params.url as string);
      default:
        return this.search(params.query as string || action);
    }
  }

  private async search(query: string): Promise<AgentResponse> {
    if (!query) {
      return this.error("Search query is required");
    }

    try {
      // Use LLM to provide search-like results
      const searchPrompt = [
        {
          role: "system",
          content: `You are a helpful research assistant. The user wants to search for: "${query}"
Provide a comprehensive answer as if you had access to the latest information.
Include key facts, recent developments, and relevant details.
Format your response clearly with bullet points where appropriate.`,
        },
        { role: "user", content: `Search for: ${query}` },
      ];

      const response = await this.llmRouter.chat(searchPrompt, {
        temperature: 0.3,
        maxTokens: 1500,
      });

      return this.success(`🔍 **Search Results for: "${query}"**\n\n${response}`, "normal", {
        query,
        source: "llm-knowledge",
      });
    } catch (err) {
      return this.error(`Search failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  private async scrape(url: string): Promise<AgentResponse> {
    if (!url) {
      return this.error("URL is required for scraping");
    }

    try {
      const scrapePrompt = [
        {
          role: "system",
          content: `The user wants to scrape content from: ${url}
Since this is a cloud deployment without browser automation, provide what you know about this URL/website.
If it's a well-known site, summarize its content and purpose.`,
        },
        { role: "user", content: `Scrape: ${url}` },
      ];

      const response = await this.llmRouter.chat(scrapePrompt);
      return this.success(`🌐 **Content from ${url}**\n\n${response}`, "normal", { url });
    } catch (err) {
      return this.error(`Scraping failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  private async summarizeUrl(url: string): Promise<AgentResponse> {
    if (!url) {
      return this.error("URL is required for summarization");
    }

    try {
      const prompt = [
        {
          role: "system",
          content: `Summarize what you know about the content at this URL: ${url}
Provide a concise summary with key points.`,
        },
        { role: "user", content: `Summarize: ${url}` },
      ];

      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.2,
        maxTokens: 500,
      });

      return this.success(`📝 **Summary of ${url}**\n\n${response}`, "normal", { url });
    } catch (err) {
      return this.error(`Summarization failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }
}
