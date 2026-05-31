// JARVIS Hybrid - Voice API Route
// Proxy for web-based voice (TTS/STT) - delegates to browser APIs

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "tts": {
        // For web deployment, TTS is handled by browser's SpeechSynthesis API
        // This endpoint just returns the text for the client to speak
        const { text, lang } = body;
        return NextResponse.json({
          success: true,
          text,
          lang: lang || "auto",
          method: "browser-speech-synthesis",
        });
      }
      case "stt": {
        // STT is handled by browser's SpeechRecognition API
        return NextResponse.json({
          success: true,
          method: "browser-speech-recognition",
          supported: true,
        });
      }
      default:
        return NextResponse.json({ error: "Invalid action. Use 'tts' or 'stt'" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
