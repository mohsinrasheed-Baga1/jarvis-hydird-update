// JARVIS Hybrid - Health Check API

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "online",
    service: "JARVIS Hybrid Cloud",
    version: "2.0.0",
    timestamp: Date.now(),
    providers: {
      groq: !!process.env.GROQ_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      zai: !!process.env.ZAI_API_KEY,
    },
    note: "Users can also provide API keys from the frontend Settings panel",
    uptime: process.uptime(),
  });
}
