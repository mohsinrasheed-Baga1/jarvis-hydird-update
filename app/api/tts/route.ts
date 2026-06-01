import { NextRequest, NextResponse } from "next/server";

// ===== JARVIS TTS API =====
// Priority: ElevenLabs (natural) → OpenAI TTS (natural) → Google Translate (free)
// Supports both Urdu and English with natural, emotional voices

interface TTSRequest {
  text: string;
  lang?: string;
  emotion?: string;
  voiceId?: string;
  elevenlabsKey?: string;
  openaiKey?: string;
}

// ===== ELEVENLABS — Most Natural Voice =====
async function tryElevenLabs(
  text: string,
  lang: string,
  emotion: string,
  apiKey?: string
): Promise<Response | null> {
  if (!apiKey) return null;

  // ElevenLabs voice IDs for natural voices
  const urduVoiceId = "onwK4e9ZLuTAKqWW03F9"; // Female multilingual
  const englishVoiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel - natural female

  const voiceId = lang === "ur" ? urduVoiceId : englishVoiceId;

  const emotionSettings: Record<string, { stability: number; similarity: number; style: number }> = {
    happy: { stability: 0.4, similarity: 0.8, style: 0.7 },
    serious: { stability: 0.7, similarity: 0.85, style: 0.3 },
    sympathetic: { stability: 0.6, similarity: 0.8, style: 0.5 },
    surprised: { stability: 0.3, similarity: 0.75, style: 0.8 },
    encouraging: { stability: 0.45, similarity: 0.8, style: 0.6 },
    normal: { stability: 0.5, similarity: 0.8, style: 0.4 },
  };

  const settings = emotionSettings[emotion] || emotionSettings.normal;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.substring(0, 500),
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarity,
            style: settings.style,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      if (audioBuffer.byteLength > 500) {
        console.log(`[TTS] ElevenLabs success, size: ${audioBuffer.byteLength}`);
        return new NextResponse(audioBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=3600",
            "X-TTS-Provider": "elevenlabs",
          },
        });
      }
    }
    return null;
  } catch (err) {
    console.warn("[TTS] ElevenLabs failed:", err);
    return null;
  }
}

// ===== OPENAI TTS — Natural Voice (uses existing OpenAI key!) =====
async function tryOpenAITTS(
  text: string,
  lang: string,
  emotion: string,
  apiKey?: string
): Promise<Response | null> {
  if (!apiKey) return null;

  // OpenAI TTS voices - alloy is great for multilingual
  const voiceMap: Record<string, string> = {
    happy: "nova",       // Upbeat, friendly
    serious: "onyx",     // Deep, authoritative
    sympathetic: "shimmer", // Warm, gentle
    surprised: "fable",  // Expressive
    encouraging: "nova",  // Friendly, uplifting
    normal: "alloy",     // Neutral, clear
  };

  const voice = lang === "ur" ? "alloy" : (voiceMap[emotion] || "alloy");

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "tts-1-hd",
        input: text.substring(0, 4096),
        voice: voice,
        speed: emotion === "happy" || emotion === "surprised" ? 1.1 : emotion === "serious" ? 0.9 : 1.0,
      }),
    });

    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      if (audioBuffer.byteLength > 500) {
        console.log(`[TTS] OpenAI TTS success, size: ${audioBuffer.byteLength}`);
        return new NextResponse(audioBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=3600",
            "X-TTS-Provider": "openai",
          },
        });
      }
    }
    console.warn("[TTS] OpenAI TTS response not ok");
    return null;
  } catch (err) {
    console.warn("[TTS] OpenAI TTS failed:", err);
    return null;
  }
}

// ===== GOOGLE TRANSLATE TTS — Good quality, free =====
async function tryGoogleTranslate(
  text: string,
  lang: string
): Promise<Response | null> {
  const targetLang = lang === "ur" ? "ur" : "en";
  const cleanText = text.substring(0, 200);
  const encoded = encodeURIComponent(cleanText);

  const ttsUrls = [
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${targetLang}&q=${encoded}`,
    `https://translate.google.com/translate_tts?ie=UTF-8&tl=${targetLang}&q=${encoded}&client=dict-chrome-ex`,
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${targetLang}&q=${encoded}`,
  ];

  for (const ttsUrl of ttsUrls) {
    try {
      const response = await fetch(ttsUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "audio/mpeg, audio/mp3, */*",
          "Accept-Language": "en-US,en;q=0.9,ur;q=0.8",
          Referer: "https://translate.google.com/",
        },
        redirect: "follow",
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (
          contentType.includes("audio") ||
          contentType.includes("mpeg") ||
          contentType.includes("mp3")
        ) {
          const audioBuffer = await response.arrayBuffer();
          if (audioBuffer.byteLength > 500) {
            console.log(
              `[TTS] Google Translate success, size: ${audioBuffer.byteLength}`
            );
            return new NextResponse(audioBuffer, {
              headers: {
                "Content-Type": "audio/mpeg",
                "Cache-Control": "public, max-age=3600",
                "X-TTS-Provider": "google-translate",
              },
            });
          }
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ===== STREAMELEMENTS TTS — Free alternative =====
async function tryStreamElements(
  text: string,
  lang: string
): Promise<Response | null> {
  const voice = lang === "ur" ? "Urdu" : "Brian";
  const encoded = encodeURIComponent(text.substring(0, 500));

  try {
    const response = await fetch(
      `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encoded}`,
      {
        headers: {
          Accept: "audio/mpeg",
        },
      }
    );

    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      if (audioBuffer.byteLength > 500) {
        console.log(
          `[TTS] StreamElements success, size: ${audioBuffer.byteLength}`
        );
        return new NextResponse(audioBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=3600",
            "X-TTS-Provider": "streamelements",
          },
        });
      }
    }
    return null;
  } catch (err) {
    console.warn("[TTS] StreamElements failed:", err);
    return null;
  }
}

// ===== MAIN HANDLER =====
export async function POST(req: NextRequest) {
  try {
    const body: TTSRequest = await req.json();
    const { text, lang = "ur", emotion = "normal", elevenlabsKey, openaiKey } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Priority 1: ElevenLabs (most natural, requires API key)
    if (elevenlabsKey) {
      const result = await tryElevenLabs(text, lang, emotion, elevenlabsKey);
      if (result) return result;
    }

    // Priority 2: OpenAI TTS (natural, uses existing OpenAI key!)
    if (openaiKey) {
      const result = await tryOpenAITTS(text, lang, emotion, openaiKey);
      if (result) return result;
    }

    // Priority 3: Google Translate TTS (free, decent quality)
    const googleResult = await tryGoogleTranslate(text, lang);
    if (googleResult) return googleResult;

    // Priority 4: StreamElements (free alternative)
    const streamResult = await tryStreamElements(text, lang);
    if (streamResult) return streamResult;

    // All providers failed
    console.error("[TTS] All TTS providers failed");
    return NextResponse.json(
      { error: "TTS service unavailable" },
      { status: 503 }
    );
  } catch (error) {
    console.error("[TTS API Error]", error);
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
