// JARVIS Hybrid - Product Hunter Agent (Cloud)
// Handles product research, trending analysis, and market insights

import { BaseAgent } from "./base-agent";
import type { LLMRouter } from "@/lib/llm-router";
import type { AgentResponse } from "@/lib/protocol";

export class ProductHunterAgent extends BaseAgent {
  constructor(llmRouter: LLMRouter) {
    super("product_hunter", llmRouter);
  }

  async handle(action: string, params: Record<string, unknown>): Promise<AgentResponse> {
    switch (action) {
      case "trending":
        return this.getTrendingProducts(params.category as string);
      case "analyze":
        return this.analyzeProduct(params.product as string, params.market as string);
      case "seo":
        return this.generateSEO(params.product as string, params.description as string);
      case "competitors":
        return this.analyzeCompetitors(params.product as string, params.niche as string);
      default:
        return this.getTrendingProducts(action);
    }
  }

  private async getTrendingProducts(category?: string): Promise<AgentResponse> {
    const catText = category ? ` in the "${category}" category` : "";
    const prompt = [
      {
        role: "system",
        content: `You are a product research expert. Analyze current market trends and suggest trending products${catText}.
Provide:
1. Top 5 trending products with brief descriptions
2. Why they're trending (market demand, seasonality, etc.)
3. Estimated price range
4. Target audience
5. Sales channel recommendations (Etsy, Amazon, Redbubble, etc.)

Format clearly with numbers and bullet points.`,
      },
      { role: "user", content: `What are the trending products${catText} right now?` },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.5,
        maxTokens: 2000,
      });

      return this.success(`🔥 **Trending Products${catText}**\n\n${response}`, "happy", {
        category: category || "general",
        source: "ai-analysis",
      });
    } catch (err) {
      return this.error(`Product research failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  private async analyzeProduct(product: string, market?: string): Promise<AgentResponse> {
    if (!product) {
      return this.error("Product name is required for analysis");
    }

    const marketText = market ? ` in the ${market} market` : "";
    const prompt = [
      {
        role: "system",
        content: `You are a market analyst. Analyze this product: "${product}"${marketText}.
Provide:
1. Market demand analysis
2. Competition level (low/medium/high)
3. Price recommendations
4. Best platforms to sell
5. Marketing strategy suggestions
6. Potential challenges
7. Profit margin estimates`,
      },
      { role: "user", content: `Analyze: ${product}` },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.4,
        maxTokens: 2000,
      });

      return this.success(`📊 **Product Analysis: ${product}**\n\n${response}`, "serious", {
        product,
        market: market || "global",
      });
    } catch (err) {
      return this.error(`Analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  private async generateSEO(product: string, description?: string): Promise<AgentResponse> {
    if (!product) {
      return this.error("Product name is required for SEO generation");
    }

    const descText = description ? `\nDescription: ${description}` : "";
    const prompt = [
      {
        role: "system",
        content: `Generate SEO-optimized listing for this product: "${product}"${descText}

Provide:
1. **Title** (SEO-optimized, under 140 chars)
2. **Description** (engaging, keyword-rich, 200+ words)
3. **Tags** (13 relevant tags for platforms like Redbubble/Etsy)
4. **Keywords** (primary and secondary)
5. **Category suggestions**
6. **Pricing strategy**

Make it ready to copy-paste for Redbubble, Amazon Merch, or Etsy.`,
      },
      { role: "user", content: `Generate SEO listing for: ${product}` },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.6,
        maxTokens: 2500,
      });

      return this.success(`🎯 **SEO Listing: ${product}**\n\n${response}`, "happy", {
        product,
        type: "seo-listing",
      });
    } catch (err) {
      return this.error(`SEO generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  private async analyzeCompetitors(product: string, niche?: string): Promise<AgentResponse> {
    if (!product) {
      return this.error("Product name is required for competitor analysis");
    }

    const nicheText = niche ? ` in the "${niche}" niche` : "";
    const prompt = [
      {
        role: "system",
        content: `Analyze competitors for: "${product}"${nicheText}.
Provide:
1. Main competitors and their strategies
2. Price comparison
3. Unique selling points to differentiate
4. Gaps in the market
5. Recommended positioning strategy`,
      },
      { role: "user", content: `Analyze competitors for: ${product}` },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.4,
        maxTokens: 1500,
      });

      return this.success(`⚔️ **Competitor Analysis: ${product}**\n\n${response}`, "serious", {
        product,
        niche: niche || "general",
      });
    } catch (err) {
      return this.error(`Competitor analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }
}
