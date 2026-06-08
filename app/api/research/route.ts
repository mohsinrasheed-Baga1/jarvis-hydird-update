// JARVIS Hybrid - Research / Multi-AI Consultation API
// Consults multiple AI providers and merges responses

import { NextRequest, NextResponse } from "next/server";
import type { APIKeys } from "@/lib/protocol";

interface ResearchRequest {
  query: string;
  apiKeys: APIKeys;
}

interface ResearchResult {
  source: string;
  response: string;
  error?: string;
}

async function queryGroq(query: string, apiKey: string): Promise<ResearchResult> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are a research assistant. Provide detailed, factual, well-structured answers. Use markdown formatting." },
          { role: "user", content: query },
        ],
        max_tokens: 1024,
        temperature: 0.5,
      }),
    });
    if (!res.ok) return { source: "Groq", response: "", error: `HTTP ${res.status}` };
    const data = await res.json();
    return { source: "Groq", response: data.choices?.[0]?.message?.content || "" };
  } catch (e) {
    return { source: "Groq", response: "", error: e instanceof Error ? e.message : "Unknown error" };
  }
}

async function queryGemini(query: string, apiKey: string): Promise<ResearchResult> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `You are a research assistant. Provide detailed, factual answers.\n\n${query}` }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.5 },
        }),
      }
    );
    if (!res.ok) return { source: "Gemini", response: "", error: `HTTP ${res.status}` };
    const data = await res.json();
    return { source: "Gemini", response: data.candidates?.[0]?.content?.parts?.[0]?.text || "" };
  } catch (e) {
    return { source: "Gemini", response: "", error: e instanceof Error ? e.message : "Unknown error" };
  }
}

async function queryOpenAI(query: string, apiKey: string): Promise<ResearchResult> {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a research assistant. Provide detailed, factual, well-structured answers." },
          { role: "user", content: query },
        ],
        max_tokens: 1024,
        temperature: 0.5,
      }),
    });
    if (!res.ok) return { source: "OpenAI", response: "", error: `HTTP ${res.status}` };
    const data = await res.json();
    return { source: "OpenAI", response: data.choices?.[0]?.message?.content || "" };
  } catch (e) {
    return { source: "OpenAI", response: "", error: e instanceof Error ? e.message : "Unknown error" };
  }
}

async function queryXAI(query: string, apiKey: string): Promise<ResearchResult> {
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "grok-2",
        messages: [
          { role: "system", content: "You are a research assistant. Provide detailed, factual answers." },
          { role: "user", content: query },
        ],
        max_tokens: 1024,
        temperature: 0.5,
      }),
    });
    if (!res.ok) return { source: "xAI/Grok", response: "", error: `HTTP ${res.status}` };
    const data = await res.json();
    return { source: "xAI/Grok", response: data.choices?.[0]?.message?.content || "" };
  } catch (e) {
    return { source: "xAI/Grok", response: "", error: e instanceof Error ? e.message : "Unknown error" };
  }
}

async function queryAnthropic(query: string, apiKey: string): Promise<ResearchResult> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        system: "You are a research assistant. Provide detailed, factual, well-structured answers.",
        messages: [{ role: "user", content: query }],
      }),
    });
    if (!res.ok) return { source: "Claude", response: "", error: `HTTP ${res.status}` };
    const data = await res.json();
    return { source: "Claude", response: data.content?.[0]?.text || "" };
  } catch (e) {
    return { source: "Claude", response: "", error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ResearchRequest = await request.json();
    const { query, apiKeys } = body;

    if (!query || !query.trim()) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const results: ResearchResult[] = [];
    const promises: Promise<ResearchResult>[] = [];

    if (apiKeys.groq) promises.push(queryGroq(query, apiKeys.groq));
    if (apiKeys.gemini) promises.push(queryGemini(query, apiKeys.gemini));
    if (apiKeys.openai) promises.push(queryOpenAI(query, apiKeys.openai));
    if (apiKeys.xai) promises.push(queryXAI(query, apiKeys.xai));
    if (apiKeys.anthropic) promises.push(queryAnthropic(query, apiKeys.anthropic));

    if (promises.length === 0) {
      return NextResponse.json({
        results: [],
        combinedSummary: "No API keys configured. Add API keys in Settings to use multi-AI research.",
      });
    }

    const responses = await Promise.allSettled(promises);

    for (const r of responses) {
      if (r.status === "fulfilled" && r.value.response) {
        results.push(r.value);
      } else if (r.status === "fulfilled" && r.value.error) {
        results.push(r.value);
      }
    }

    // Create a combined summary
    const successfulResults = results.filter(r => r.response);
    const combinedSummary = successfulResults.length > 0
      ? `Research completed from ${successfulResults.length} AI source(s): ${successfulResults.map(r => r.source).join(", ")}`
      : "All AI providers failed. Check your API keys.";

    return NextResponse.json({ results, combinedSummary });
  } catch (error) {
    return NextResponse.json(
      { error: "Research failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
