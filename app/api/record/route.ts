// JARVIS Hybrid - Recording API
// Generates TTS audio for recording with speed control

import { NextRequest, NextResponse } from "next/server";

interface RecordRequest {
  text: string;
  lang: "ur" | "en";
  speed: "slow" | "normal" | "fast";
  apiKey?: string;
}

const SPEED_PRESETS: Record<string, { rate: number; pitch: number }> = {
  slow: { rate: 0.65, pitch: 0.9 },
  normal: { rate: 0.88, pitch: 1.0 },
  fast: { rate: 1.3, pitch: 1.05 },
};

export async function POST(request: NextRequest) {
  try {
    const body: RecordRequest = await request.json();
    const { text, lang = "ur", speed = "normal", apiKey } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const speedPreset = SPEED_PRESETS[speed] || SPEED_PRESETS.normal;

    // Try OpenAI TTS first if key provided
    if (apiKey) {
      try {
        const voice = lang === "ur" ? "alloy" : "nova";
        const res = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "tts-1-hd",
            input: text.substring(0, 4096),
            voice,
            speed: speedPreset.rate,
          }),
        });

        if (res.ok) {
          const audioBuffer = await res.arrayBuffer();
          if (audioBuffer.byteLength > 500) {
            return new NextResponse(audioBuffer, {
              headers: {
                "Content-Type": "audio/mpeg",
                "Content-Disposition": `attachment; filename="jarvis-recording-${Date.now()}.mp3"`,
                "X-TTS-Provider": "openai-recording",
                "X-Speed": speed,
                "X-Language": lang,
              },
            });
          }
        }
      } catch (err) {
        console.warn("[Record API] OpenAI TTS failed:", err);
      }
    }

    // Try Google Translate TTS as fallback
    const targetLang = lang === "ur" ? "ur" : "en";
    const chunks = text.match(new RegExp(`.{1,200}`, "g")) || [text];
    const firstChunk = chunks[0] || text;
    const encoded = encodeURIComponent(firstChunk.substring(0, 200));

    const ttsUrls = [
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${targetLang}&q=${encoded}`,
      `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${targetLang}&q=${encoded}`,
    ];

    for (const ttsUrl of ttsUrls) {
      try {
        const response = await fetch(ttsUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "audio/mpeg, */*",
            Referer: "https://translate.google.com/",
          },
          redirect: "follow",
        });

        if (response.ok) {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("audio") || contentType.includes("mpeg")) {
            const audioBuffer = await response.arrayBuffer();
            if (audioBuffer.byteLength > 500) {
              return new NextResponse(audioBuffer, {
                headers: {
                  "Content-Type": "audio/mpeg",
                  "Content-Disposition": `attachment; filename="jarvis-recording-${Date.now()}.mp3"`,
                  "X-TTS-Provider": "google-translate-recording",
                  "X-Speed": speed,
                  "X-Language": lang,
                },
              });
            }
          }
        }
      } catch { continue; }
    }

    // If all else fails, return a JSON response indicating browser TTS should be used
    return NextResponse.json({
      useBrowserTTS: true,
      lang,
      speed,
      rate: speedPreset.rate,
      pitch: speedPreset.pitch,
      text: text.substring(0, 5000),
      message: "Server TTS unavailable. Use browser TTS with provided settings.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Recording failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
