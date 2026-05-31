// JARVIS Hybrid - Agent API Route
// Direct agent interaction endpoint (for desktop connector)

import { NextRequest, NextResponse } from "next/server";
import { AgentCore } from "@/lib/agent-core";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent, action, params, userId, apiKeys } = body as {
      agent: string;
      action: string;
      params: Record<string, unknown>;
      userId: string;
      apiKeys?: Record<string, string>;
    };

    if (!agent || !action || !userId) {
      return NextResponse.json(
        { error: "agent, action, and userId are required" },
        { status: 400 }
      );
    }

    const agentCore = new AgentCore();
    const keys = {
      groq: apiKeys?.groq || process.env.GROQ_API_KEY || "",
      gemini: apiKeys?.gemini || process.env.GEMINI_API_KEY || "",
      openai: apiKeys?.openai || process.env.OPENAI_API_KEY || "",
      zai: apiKeys?.zai || process.env.ZAI_API_KEY || "",
    };

    const response = await agentCore.processMessage(
      userId,
      `[Direct Agent Call] ${agent}: ${action} - ${JSON.stringify(params)}`,
      keys
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Agent API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Agent error occurred",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Desktop connector reports local task results
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, success, result, error } = body as {
      taskId: string;
      success: boolean;
      result?: Record<string, unknown>;
      error?: string;
    };

    console.log(`[Agent API] Local task result received: ${taskId}`, {
      success,
      result,
      error,
    });

    return NextResponse.json({
      success: true,
      message: "Task result received",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
