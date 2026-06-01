import { NextRequest, NextResponse } from "next/server";

// ===== JARVIS TTS API — 100% NATURAL VOICES =====
// Priority: ElevenLabs Turbo v2.5 (BEST) → Sarvam AI (Hindi/Urdu natural) → OpenAI TTS HD → Google Translate
// All voices configured for maximum naturalness — sounds like a real human

interface TTSRequest {
  text: string;
  lang?: string;
  emotion?: string;
  voiceId?: string;
  elevenlabsKey?: string;
  openaiKey?: string;
  sarvamKey?: string;
}

// ===== ELEVENLABS TURBO v2.5 — The Gold Standard for Natural Voice =====
// This is what YouTube Hindi AI agents use — 100% natural, emotional, human-like
async function tryElevenLabs(
  text: string,
  lang: string,
  emotion: string,
  apiKey?: string
): Promise<Response | null> {
  if (!apiKey) return null;

  // Best voices for Hindi/Urdu — these are the voices that sound 100% natural
  // These are the same voices used by popular Hindi AI agents on YouTube
  const voiceIds: Record<string, string> = {
    // Hindi/Urdu — warm, natural female voice (like YouTube Hindi AI agents)
    ur: "Xb7hH8MSUJpWjnnlVkGX",   // Matilda — extremely natural for Hindi/Urdu
    // English — natural, friendly female voice
    en: "EXAVITQu4vr4xnSDxMaL",    // Bella — most natural English female
  };

  const voiceId = voiceIds[lang] || voiceIds.ur;

  // Emotion-based voice settings — tuned for maximum naturalness
  const emotionSettings: Record<string, { stability: number; similarity: number; style: number }> = {
    happy:       { stability: 0.35, similarity: 0.75, style: 0.8 },   // More expressive, less stable = more natural
    serious:     { stability: 0.55, similarity: 0.8,  style: 0.4 },   // Controlled but human
    sympathetic: { stability: 0.5,  similarity: 0.78, style: 0.6 },   // Warm, caring
    surprised:   { stability: 0.3,  similarity: 0.72, style: 0.85 },  // Very expressive
    encouraging: { stability: 0.4,  similarity: 0.76, style: 0.7 },   // Uplifting
    normal:      { stability: 0.4,  similarity: 0.78, style: 0.55 },  // Natural conversation
  };

  const settings = emotionSettings[emotion] || emotionSettings.normal;

  try {
    // Use eleven_turbo_v2_5 — THE BEST model for Hindi/Urdu natural speech
    // This model handles Hindi/Urdu natively with perfect pronunciation
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
          text: text.substring(0, 5000), // Increased limit — turbo v2.5 handles long text well
          model_id: "eleven_turbo_v2_5", // LATEST model — best for Hindi/Urdu natural speech
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarity,
            style: settings.style,
            use_speaker_boost: true,
          },
          output_format: "mp3_44100_128",
        }),
      }
    );

    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      if (audioBuffer.byteLength > 500) {
        console.log(`[TTS] ElevenLabs Turbo v2.5 success, size: ${audioBuffer.byteLength}`);
        return new NextResponse(audioBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=3600",
            "X-TTS-Provider": "elevenlabs-turbo",
          },
        });
      }
    }
    // Fallback: try with multilingual_v2 model if turbo fails
    console.warn("[TTS] ElevenLabs turbo v2.5 failed, trying multilingual_v2...");
    const fallbackResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.substring(0, 5000),
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarity,
            style: settings.style,
            use_speaker_boost: true,
          },
          output_format: "mp3_44100_128",
        }),
      }
    );
    if (fallbackResponse.ok) {
      const audioBuffer = await fallbackResponse.arrayBuffer();
      if (audioBuffer.byteLength > 500) {
        console.log(`[TTS] ElevenLabs multilingual_v2 fallback success, size: ${audioBuffer.byteLength}`);
        return new NextResponse(audioBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=3600",
            "X-TTS-Provider": "elevenlabs-v2",
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

// ===== SARVAM AI — Indian TTS, Extremely Natural Hindi/Urdu =====
// Built by Indian AI company specifically for Indian languages
// Free tier available: https://sarvam.ai
async function trySarvamAI(
  text: string,
  lang: string,
  emotion: string,
  apiKey?: string
): Promise<Response | null> {
  if (!apiKey) return null;

  // Sarvam AI supports Hindi natively — Urdu script also works since it's phonetically similar
  // Language codes: hi-IN for Hindi, if Urdu doesn't work, Hindi reads Urdu well
  const targetLang = lang === "ur" ? "hi-IN" : "en";

  // Speaker IDs — natural voices
  // anushka = young female, meera = mature female, diya = clear female
  const speakerMap: Record<string, string> = {
    happy: "anushka",
    serious: "meera",
    sympathetic: "meera",
    surprised: "anushka",
    encouraging: "anushka",
    normal: "anushka", // anushka is the most natural-sounding voice
  };

  const speakerId = targetLang === "en" ? "anushka" : (speakerMap[emotion] || "anushka");

  // Speed based on emotion
  const speedMap: Record<string, number> = {
    happy: 1.1,
    serious: 0.9,
    sympathetic: 0.95,
    surprised: 1.05,
    encouraging: 1.0,
    normal: 1.0,
  };
  const pace = speedMap[emotion] || 1.0;

  try {
    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey,
      },
      body: JSON.stringify({
        inputs: [text.substring(0, 3000)],
        target_language_code: targetLang,
        speaker_id: speakerId,
        pitch: 0,
        pace: pace,
        loudness: 1.5,
        speech_sample_rate: 24000,
        enable_preprocessing: true,
        model: "bulbul:v1",
      }),
    });

    if (response.ok) {
      // Sarvam returns audio in various formats
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("audio") || contentType.includes("wav") || contentType.includes("mpeg") || contentType.includes("octet-stream")) {
        const audioBuffer = await response.arrayBuffer();
        if (audioBuffer.byteLength > 500) {
          console.log(`[TTS] Sarvam AI success, size: ${audioBuffer.byteLength}, type: ${contentType}`);
          return new NextResponse(audioBuffer, {
            headers: {
              "Content-Type": contentType.includes("wav") ? "audio/wav" : "audio/mpeg",
              "Cache-Control": "public, max-age=3600",
              "X-TTS-Provider": "sarvam-ai",
            },
          });
        }
      }

      // Try to parse as JSON (might return base64)
      try {
        const json = await response.json();
        if (json.audios && json.audios[0]) {
          const base64Audio = json.audios[0];
          const audioBuffer = Buffer.from(base64Audio, "base64");
          if (audioBuffer.byteLength > 500) {
            console.log(`[TTS] Sarvam AI base64 success, size: ${audioBuffer.byteLength}`);
            return new NextResponse(audioBuffer, {
              headers: {
                "Content-Type": "audio/wav",
                "Cache-Control": "public, max-age=3600",
                "X-TTS-Provider": "sarvam-ai",
              },
            });
          }
        }
      } catch {
        // Not JSON, already handled above
      }
    }

    console.warn("[TTS] Sarvam AI response not ok");
    return null;
  } catch (err) {
    console.warn("[TTS] Sarvam AI failed:", err);
    return null;
  }
}

// ===== OPENAI TTS HD — Natural Voice =====
async function tryOpenAITTS(
  text: string,
  lang: string,
  emotion: string,
  apiKey?: string
): Promise<Response | null> {
  if (!apiKey) return null;

  // OpenAI TTS voices — natural but slightly less natural than ElevenLabs
  // For Hindi/Urdu: alloy handles multilingual well
  // For English: nova is most natural female voice
  const voiceMap: Record<string, string> = {
    happy: "nova",
    serious: "nova",
    sympathetic: "shimmer",
    surprised: "nova",
    encouraging: "nova",
    normal: "nova",
  };

  const voice = lang === "ur" ? "alloy" : (voiceMap[emotion] || "nova");

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
        speed: emotion === "happy" || emotion === "surprised" ? 1.05 : emotion === "serious" ? 0.95 : 1.0,
      }),
    });

    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      if (audioBuffer.byteLength > 500) {
        console.log(`[TTS] OpenAI TTS HD success, size: ${audioBuffer.byteLength}`);
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

// ===== GOOGLE TRANSLATE TTS — Free but robotic (LAST resort) =====
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

// ===== STREAMELEMENTS TTS — Free alternative (last resort) =====
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
    const { text, lang = "ur", emotion = "normal", elevenlabsKey, openaiKey, sarvamKey } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Priority 1: ElevenLabs Turbo v2.5 — THE BEST natural voice
    // This is what YouTube Hindi AI agents use — 100% natural, emotional
    if (elevenlabsKey) {
      const result = await tryElevenLabs(text, lang, emotion, elevenlabsKey);
      if (result) return result;
    }

    // Priority 2: Sarvam AI — Indian TTS, extremely natural Hindi/Urdu
    // Built specifically for Indian languages — free tier available
    if (sarvamKey) {
      const result = await trySarvamAI(text, lang, emotion, sarvamKey);
      if (result) return result;
    }

    // Priority 3: OpenAI TTS HD — natural but less than ElevenLabs/Sarvam
    if (openaiKey) {
      const result = await tryOpenAITTS(text, lang, emotion, openaiKey);
      if (result) return result;
    }

    // Priority 4: Google Translate TTS (free but robotic — last resort)
    const googleResult = await tryGoogleTranslate(text, lang);
    if (googleResult) return googleResult;

    // Priority 5: StreamElements (free alternative)
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
