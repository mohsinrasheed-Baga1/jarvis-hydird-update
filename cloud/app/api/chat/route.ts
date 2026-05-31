// JARVIS Hybrid - Chat API Route
// Accepts API keys from frontend per-request

import { NextRequest, NextResponse } from "next/server";
import { AgentCore } from "@/lib/agent-core";
import type { JarvisMessage, APIKeys, LLMProvider } from "@/lib/protocol";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, userId, history, stream, apiKeys, activeProvider } = body as {
      message: string;
      userId: string;
      history?: JarvisMessage[];
      stream?: boolean;
      apiKeys?: APIKeys;
      activeProvider?: LLMProvider;
    };

    if (!message || !userId) {
      return NextResponse.json(
        { error: "message and userId are required" },
        { status: 400 }
      );
    }

    // Use provided API keys (from frontend settings) or fall back to env vars
    const keys: APIKeys = {
      groq: apiKeys?.groq || process.env.GROQ_API_KEY || "",
      gemini: apiKeys?.gemini || process.env.GEMINI_API_KEY || "",
      openai: apiKeys?.openai || process.env.OPENAI_API_KEY || "",
      zai: apiKeys?.zai || process.env.ZAI_API_KEY || "",
    };

    // Check if at least one key is available
    const hasAnyKey = Object.values(keys).some((k) => k && k.trim().length > 0);
    if (!hasAnyKey) {
      return NextResponse.json({
        success: false,
        message: "⚠️ کوئی API Key موجود نہیں۔ براہ کرم Settings میں جا کر کم از کم ایک API Key ڈالیں۔\n\nAvailable providers:\n• Groq (Free) - console.groq.com\n• Gemini (Free) - aistudio.google.com\n• OpenAI - platform.openai.com\n• ZAI - open.bigmodel.cn",
        emotion: "encouraging",
        error: "No API keys configured",
      });
    }

    const agentCore = new AgentCore();

    // Streaming response
    if (stream) {
      const { stream: responseStream, classification, emotion } =
        await agentCore.processMessageStream(userId, message, keys, history || [], activeProvider);

      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          // Send metadata first
          const metadata = JSON.stringify({ type: "meta", classification, emotion });
          controller.enqueue(encoder.encode(`data: ${metadata}\n\n`));

          const reader = responseStream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = new TextDecoder().decode(value);
              const data = JSON.stringify({ type: "content", content: chunk });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // Regular response
    const response = await agentCore.processMessage(userId, message, keys, history || [], activeProvider);
    return NextResponse.json(response);
  } catch (error) {
    console.error("[Chat API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Server error occurred",
        emotion: "sympathetic",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
