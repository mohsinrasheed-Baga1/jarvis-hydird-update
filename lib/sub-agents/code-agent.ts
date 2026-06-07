// JARVIS Hybrid - Code Agent (Cloud)
// Handles code writing, debugging, review, and explanation

import { BaseAgent } from "./base-agent";
import type { LLMRouter } from "@/lib/llm-router";
import type { AgentResponse } from "@/lib/protocol";

export class CodeAgent extends BaseAgent {
  constructor(llmRouter: LLMRouter) {
    super("code", llmRouter);
  }

  async handle(
    action: string,
    params: Record<string, unknown>,
    userMessage?: string
  ): Promise<AgentResponse> {
    switch (action) {
      case "write":
        return this.writeCode(params.description as string || userMessage || "");
      case "debug":
        return this.debugCode(params.code as string, params.error as string);
      case "review":
        return this.reviewCode(params.code as string, params.language as string);
      case "explain":
        return this.explainCode(params.code as string, params.language as string);
      case "convert":
        return this.convertCode(
          params.code as string,
          params.from as string,
          params.to as string
        );
      default:
        return this.writeCode(userMessage || action);
    }
  }

  private async writeCode(description: string): Promise<AgentResponse> {
    if (!description) {
      return this.error("Please describe what code you want me to write");
    }

    const prompt = [
      {
        role: "system",
        content: `You are an expert programmer. Write clean, efficient, and well-commented code based on the user's description.

Rules:
1. Always include a brief explanation before the code
2. Use proper language detection (Python, JavaScript, TypeScript, etc.)
3. Add helpful comments
4. Follow best practices and design patterns
5. Include error handling
6. Format code in markdown code blocks with language tags`,
      },
      { role: "user", content: `Write code: ${description}` },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.3,
        maxTokens: 3000,
      });

      return this.success(`💻 **Code Generated**\n\n${response}`, "happy", {
        type: "code-generated",
        description,
      });
    } catch (err) {
      return this.error(`Code generation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  private async debugCode(code: string, error?: string): Promise<AgentResponse> {
    if (!code) {
      return this.error("Please provide the code to debug");
    }

    const errorText = error ? `\nError message: ${error}` : "";
    const prompt = [
      {
        role: "system",
        content: `You are a debugging expert. Analyze the following code and find bugs/issues.

Code:
\`\`\`
${code}
\`\`\`
${errorText}

Provide:
1. The bug/issue identified
2. Why it occurs
3. The fixed code
4. Tips to avoid similar issues`,
      },
      { role: "user", content: "Debug this code" },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.2,
        maxTokens: 2000,
      });

      return this.success(`🐛 **Debug Result**\n\n${response}`, "serious", {
        type: "debug-result",
      });
    } catch (err) {
      return this.error(`Debugging failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  private async reviewCode(code: string, language?: string): Promise<AgentResponse> {
    if (!code) {
      return this.error("Please provide the code to review");
    }

    const langText = language ? ` (${language})` : "";
    const prompt = [
      {
        role: "system",
        content: `You are a senior code reviewer. Review this code${langText}:

\`\`\`
${code}
\`\`\`

Provide:
1. Overall quality score (1-10)
2. Strengths
3. Issues found (bugs, anti-patterns, security concerns)
4. Performance suggestions
5. Readability improvements
6. Refactored version if needed`,
      },
      { role: "user", content: "Review this code" },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.3,
        maxTokens: 2500,
      });

      return this.success(`🔍 **Code Review**\n\n${response}`, "serious", {
        type: "code-review",
        language: language || "auto-detected",
      });
    } catch (err) {
      return this.error(`Code review failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  private async explainCode(code: string, language?: string): Promise<AgentResponse> {
    if (!code) {
      return this.error("Please provide the code to explain");
    }

    const langText = language ? ` (${language})` : "";
    const prompt = [
      {
        role: "system",
        content: `Explain this code${langText} in simple terms:

\`\`\`
${code}
\`\`\`

Break down:
1. What the code does overall
2. Line-by-line or section-by-section explanation
3. Key concepts used
4. Expected input/output`,
      },
      { role: "user", content: "Explain this code" },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.4,
        maxTokens: 2000,
      });

      return this.success(`📖 **Code Explanation**\n\n${response}`, "normal", {
        type: "code-explanation",
      });
    } catch (err) {
      return this.error(`Explanation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  private async convertCode(
    code: string,
    from: string,
    to: string
  ): Promise<AgentResponse> {
    if (!code || !from || !to) {
      return this.error("Please provide code, source language, and target language");
    }

    const prompt = [
      {
        role: "system",
        content: `Convert this ${from} code to ${to}:

\`\`\`${from}
${code}
\`\`\`

Provide:
1. The converted code in ${to}
2. Any notable differences between the two versions
3. Any language-specific adaptations made`,
      },
      { role: "user", content: `Convert from ${from} to ${to}` },
    ];

    try {
      const response = await this.llmRouter.chat(prompt, {
        temperature: 0.2,
        maxTokens: 3000,
      });

      return this.success(`🔄 **Code Conversion: ${from} → ${to}**\n\n${response}`, "happy", {
        type: "code-conversion",
        from,
        to,
      });
    } catch (err) {
      return this.error(`Conversion failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }
}
