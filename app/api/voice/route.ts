// JARVIS Hybrid - Voice API Route
// Handles browser voice fallbacks that need a server-side API key.

import { NextRequest, NextResponse } from "next/server";

type APIKeys = {
  openai?: string;
  groq?: string;
};

function parseKeys(raw: FormDataEntryValue | null): APIKeys {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    return JSON.parse(raw) as APIKeys;
  } catch {
    return {};
  }
}

async function transcribeWithOpenAI(audio: File, apiKey: string, language: string) {
  const form = new FormData();
  form.append("file", audio, audio.name || "voice.webm");
  form.append("model", "whisper-1");
  if (language === "ur") form.append("language", "ur");
  if (language === "en") form.append("language", "en");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(details || `OpenAI STT failed: ${response.status}`);
  }

  const json = await response.json();
  return String(json.text || "").trim();
}

async function transcribeWithGroq(audio: File, apiKey: string, language: string) {
  const form = new FormData();
  form.append("file", audio, audio.name || "voice.webm");
  form.append("model", "whisper-large-v3-turbo");
  if (language === "ur") form.append("language", "ur");
  if (language === "en") form.append("language", "en");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(details || `Groq STT failed: ${response.status}`);
  }

  const json = await response.json();
  return String(json.text || "").trim();
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const action = String(form.get("action") || "");
      if (action !== "stt") {
        return NextResponse.json({ error: "Invalid multipart action. Use 'stt'" }, { status: 400 });
      }

      const audio = form.get("audio");
      if (!(audio instanceof File)) {
        return NextResponse.json({ error: "audio file is required" }, { status: 400 });
      }

      const language = String(form.get("language") || "ur");
      const keys = parseKeys(form.get("apiKeys"));
      const openaiKey = keys.openai || process.env.OPENAI_API_KEY || "";
      const groqKey = keys.groq || process.env.GROQ_API_KEY || "";
      if (!openaiKey.trim() && !groqKey.trim()) {
        return NextResponse.json(
          { success: false, error: "OpenAI or Groq API key is required for recorded voice transcription" },
          { status: 400 }
        );
      }

      let text = "";
      let method = "";
      if (groqKey.trim()) {
        try {
          text = await transcribeWithGroq(audio, groqKey, language);
          method = "groq-whisper";
        } catch (error) {
          console.warn("[Voice STT] Groq failed:", error);
        }
      }
      if (!text && openaiKey.trim()) {
        text = await transcribeWithOpenAI(audio, openaiKey, language);
        method = "openai-whisper";
      }

      return NextResponse.json({ success: true, text, language, method });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "tts": {
        const { text, lang } = body;
        return NextResponse.json({
          success: true,
          text,
          lang: lang || "auto",
          method: "use-api-tts",
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
