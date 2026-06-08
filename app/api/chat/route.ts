// JARVIS Hybrid - Chat API Route
// Accepts API keys + file uploads from frontend

import { NextRequest, NextResponse } from "next/server";
import { AgentCore } from "@/lib/agent-core";
import type { JarvisMessage, APIKeys, LLMProvider } from "@/lib/protocol";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let payload: {
      message: string;
      userId: string;
      history?: JarvisMessage[];
      stream?: boolean;
      apiKeys?: APIKeys;
      activeProvider?: LLMProvider;
      file?: { name: string; type: string; dataUrl: string } | null;
    };

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const uploaded = form.get("file");
      let file: { name: string; type: string; dataUrl: string } | null = null;

      if (uploaded instanceof File) {
        const bytes = Buffer.from(await uploaded.arrayBuffer());
        const base64 = bytes.toString("base64");
        file = {
          name: uploaded.name,
          type: uploaded.type || "application/octet-stream",
          dataUrl: `data:${uploaded.type || "application/octet-stream"};base64,${base64}`,
        };
      }

      let parsedKeys: APIKeys = {};
      const rawKeys = form.get("apiKeys");
      if (typeof rawKeys === "string" && rawKeys.trim()) {
        try { parsedKeys = JSON.parse(rawKeys); } catch { parsedKeys = {}; }
      }

      payload = {
        message: String(form.get("message") || "Please analyze this file."),
        userId: String(form.get("userId") || ""),
        stream: false,
        apiKeys: parsedKeys,
        activeProvider: (String(form.get("activeProvider") || "groq") as LLMProvider),
        file,
      };
    } else {
      payload = await request.json();
    }

    const { message, userId, history, stream, apiKeys, activeProvider, file } = payload;

    if (!message || !userId) {
      return NextResponse.json({ error: "message and userId are required" }, { status: 400 });
    }

    const keys: APIKeys = {
      groq: apiKeys?.groq || process.env.GROQ_API_KEY || "",
      gemini: apiKeys?.gemini || process.env.GEMINI_API_KEY || "",
      openai: apiKeys?.openai || process.env.OPENAI_API_KEY || "",
      zai: apiKeys?.zai || process.env.ZAI_API_KEY || "",
    };

    const hasAnyKey = Object.values(keys).some((k) => k && k.trim().length > 0);
    if (!hasAnyKey) {
      return NextResponse.json({
        success: false,
        message: "⚠️ کوئی API Key موجود نہیں۔ Settings میں جا کر API Key ڈالیں۔",
        emotion: "encouraging",
        error: "No API keys configured",
      });
    }

    // If file is attached, modify the message to include file context
    let enhancedMessage = message;
    if (file) {
      enhancedMessage = `[User uploaded file: ${file.name} (${file.type})]\n\nUser's message: ${message}\n\nNote: The file has been shared as a base64 data URL. If it's an image, describe and analyze it. If it's a document, extract and analyze the content.]`;
    }

    const agentCore = new AgentCore();

    // Streaming response
    if (stream) {
      const { stream: responseStream, classification, emotion } =
        await agentCore.processMessageStream(userId, enhancedMessage, keys, history || [], activeProvider);

      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
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
    const response = await agentCore.processMessage(userId, enhancedMessage, keys, history || [], activeProvider);
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
