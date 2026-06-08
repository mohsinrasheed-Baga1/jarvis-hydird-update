import { NextRequest, NextResponse } from "next/server";

// ===== JARVIS TTS API — 100% NATURAL VOICES + MULTI-KEY =====
// Priority: ElevenLabs Turbo v2.5 (BEST) → Sarvam AI → OpenAI TTS HD → Google Translate
// MULTI-KEY: accepts comma-separated keys, rotates on rate limit

interface TTSRequest {
  text: string;
  lang?: string;
  emotion?: string;
  voiceId?: string;
  elevenlabsKey?: string;  // comma-separated for multi-key
  openaiKey?: string;      // comma-separated for multi-key
  sarvamKey?: string;      // comma-separated for multi-key
}

// Parse comma-separated keys into array
function parseKeys(keyStr?: string): string[] {
  if (!keyStr) return [];
  return keyStr.split(",").map(k => k.trim()).filter(k => k.length > 0);
}

// ===== ELEVENLABS TURBO v2.5 — The Gold Standard =====
async function tryElevenLabs(
  text: string,
  lang: string,
  emotion: string,
  apiKeys: string[],
  preferredVoiceId?: string
): Promise<Response | null> {
  if (apiKeys.length === 0) return null;

  // Best voice IDs for Hindi/Urdu — same as YouTube Hindi AI agents
  const voiceIds: Record<string, string> = {
    ur: "Xb7hH8MSUJpWjnnlVkGX",   // Matilda — natural Hindi/Urdu
    en: "EXAVITQu4vr4xnSDxMaL",    // Bella — natural English
  };
  const voiceId = preferredVoiceId?.trim() || voiceIds[lang] || voiceIds.ur;

  const emotionSettings: Record<string, { stability: number; similarity: number; style: number }> = {
    happy:       { stability: 0.35, similarity: 0.75, style: 0.8 },
    serious:     { stability: 0.55, similarity: 0.8,  style: 0.4 },
    sympathetic: { stability: 0.5,  similarity: 0.78, style: 0.6 },
    surprised:   { stability: 0.3,  similarity: 0.72, style: 0.85 },
    encouraging: { stability: 0.4,  similarity: 0.76, style: 0.7 },
    normal:      { stability: 0.4,  similarity: 0.78, style: 0.55 },
  };
  const settings = emotionSettings[emotion] || emotionSettings.normal;

  // Try each key — if one hits rate limit, try next
  for (const apiKey of apiKeys) {
    // Try turbo v2.5 first (BEST for Hindi/Urdu)
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
            text: text.substring(0, 5000),
            model_id: "eleven_turbo_v2_5",
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
          console.log(`[TTS] ElevenLabs Turbo v2.5 SUCCESS, size: ${audioBuffer.byteLength}, key: ${apiKey.substring(0, 8)}...`);
          return new NextResponse(audioBuffer, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "public, max-age=3600",
              "X-TTS-Provider": "elevenlabs-turbo",
            },
          });
        }
      } else if (response.status === 429 || response.status === 401) {
        // Rate limited or unauthorized — try next key
        const errBody = await response.text().catch(() => "");
        console.warn(`[TTS] ElevenLabs key ${apiKey.substring(0, 8)}... failed (${response.status}): ${errBody.substring(0, 100)}`);
        continue;
      } else {
        console.warn(`[TTS] ElevenLabs turbo failed: ${response.status}`);
      }
    } catch (err) {
      console.warn(`[TTS] ElevenLabs key ${apiKey.substring(0, 8)}... error:`, err);
      continue;
    }

    // Fallback to multilingual_v2 with same key
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

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        if (audioBuffer.byteLength > 500) {
          console.log(`[TTS] ElevenLabs multilingual_v2 SUCCESS, size: ${audioBuffer.byteLength}`);
          return new NextResponse(audioBuffer, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "public, max-age=3600",
              "X-TTS-Provider": "elevenlabs-v2",
            },
          });
        }
      } else if (response.status === 429) {
        continue; // Try next key
      }
    } catch {
      continue;
    }
  }

  return null;
}

// ===== SARVAM AI — Indian TTS, Natural Hindi/Urdu =====
async function trySarvamAI(
  text: string,
  lang: string,
  emotion: string,
  apiKeys: string[]
): Promise<Response | null> {
  if (apiKeys.length === 0) return null;

  const targetLang = lang === "ur" ? "hi-IN" : "en";
  const speakerMap: Record<string, string> = {
    happy: "anushka", serious: "meera", sympathetic: "meera",
    surprised: "anushka", encouraging: "anushka", normal: "anushka",
  };
  const speakerId = targetLang === "en" ? "anushka" : (speakerMap[emotion] || "anushka");
  const paceMap: Record<string, number> = {
    happy: 1.1, serious: 0.9, sympathetic: 0.95,
    surprised: 1.05, encouraging: 1.0, normal: 1.0,
  };

  for (const apiKey of apiKeys) {
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
          pace: paceMap[emotion] || 1.0,
          loudness: 1.5,
          speech_sample_rate: 24000,
          enable_preprocessing: true,
          model: "bulbul:v1",
        }),
      });

      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("audio") || contentType.includes("wav") || contentType.includes("mpeg") || contentType.includes("octet-stream")) {
          const audioBuffer = await response.arrayBuffer();
          if (audioBuffer.byteLength > 500) {
            console.log(`[TTS] Sarvam AI SUCCESS, size: ${audioBuffer.byteLength}, key: ${apiKey.substring(0, 8)}...`);
            return new NextResponse(audioBuffer, {
              headers: { "Content-Type": contentType.includes("wav") ? "audio/wav" : "audio/mpeg", "Cache-Control": "public, max-age=3600", "X-TTS-Provider": "sarvam-ai" },
            });
          }
        }
        // Try JSON response (base64 audio)
        try {
          const json = await response.json();
          if (json.audios && json.audios[0]) {
            const audioBuffer = Buffer.from(json.audios[0], "base64");
            if (audioBuffer.byteLength > 500) {
              console.log(`[TTS] Sarvam AI base64 SUCCESS, size: ${audioBuffer.byteLength}`);
              return new NextResponse(audioBuffer, {
                headers: { "Content-Type": "audio/wav", "Cache-Control": "public, max-age=3600", "X-TTS-Provider": "sarvam-ai" },
              });
            }
          }
        } catch { /* not JSON */ }
      } else if (response.status === 429 || response.status === 401) {
        const errBody = await response.text().catch(() => "");
        console.warn(`[TTS] Sarvam key ${apiKey.substring(0, 8)}... failed (${response.status}): ${errBody.substring(0, 100)}`);
        continue;
      } else {
        console.warn(`[TTS] Sarvam AI failed: ${response.status}`);
      }
    } catch (err) {
      console.warn(`[TTS] Sarvam key ${apiKey.substring(0, 8)}... error:`, err);
      continue;
    }
  }
  return null;
}

// ===== OPENAI TTS HD =====
async function tryOpenAITTS(
  text: string,
  lang: string,
  emotion: string,
  apiKeys: string[]
): Promise<Response | null> {
  if (apiKeys.length === 0) return null;

  const voiceMap: Record<string, string> = {
    happy: "nova", serious: "nova", sympathetic: "shimmer",
    surprised: "nova", encouraging: "nova", normal: "nova",
  };
  const voice = lang === "ur" ? "alloy" : (voiceMap[emotion] || "nova");

  for (const apiKey of apiKeys) {
    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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
          console.log(`[TTS] OpenAI TTS HD SUCCESS, size: ${audioBuffer.byteLength}, key: ${apiKey.substring(0, 8)}...`);
          return new NextResponse(audioBuffer, {
            headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=3600", "X-TTS-Provider": "openai" },
          });
        }
      } else if (response.status === 429 || response.status === 401) {
        const errBody = await response.text().catch(() => "");
        console.warn(`[TTS] OpenAI key ${apiKey.substring(0, 8)}... failed (${response.status}): ${errBody.substring(0, 100)}`);
        continue;
      } else {
        console.warn(`[TTS] OpenAI TTS failed: ${response.status}`);
      }
    } catch (err) {
      console.warn(`[TTS] OpenAI key ${apiKey.substring(0, 8)}... error:`, err);
      continue;
    }
  }
  return null;
}

// ===== GOOGLE TRANSLATE TTS — Free but robotic (LAST resort) =====
async function tryGoogleTranslate(text: string, lang: string): Promise<Response | null> {
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
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "audio/mpeg, audio/mp3, */*",
          Referer: "https://translate.google.com/",
        },
        redirect: "follow",
      });
      if (response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("audio") || contentType.includes("mpeg") || contentType.includes("mp3")) {
          const audioBuffer = await response.arrayBuffer();
          if (audioBuffer.byteLength > 500) {
            console.log(`[TTS] Google Translate SUCCESS, size: ${audioBuffer.byteLength}`);
            return new NextResponse(audioBuffer, {
              headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=3600", "X-TTS-Provider": "google-translate" },
            });
          }
        }
      }
    } catch { continue; }
  }
  return null;
}

// ===== STREAMELEMENTS — Free last resort =====
async function tryStreamElements(text: string, lang: string): Promise<Response | null> {
  const voice = lang === "ur" ? "Urdu" : "Brian";
  const encoded = encodeURIComponent(text.substring(0, 500));
  try {
    const response = await fetch(`https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encoded}`, { headers: { Accept: "audio/mpeg" } });
    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      if (audioBuffer.byteLength > 500) {
        return new NextResponse(audioBuffer, { headers: { "Content-Type": "audio/mpeg", "X-TTS-Provider": "streamelements" } });
      }
    }
  } catch {}
  return null;
}

// ===== MAIN HANDLER =====
export async function POST(req: NextRequest) {
  try {
    const body: TTSRequest = await req.json();
    const { text, lang = "ur", emotion = "normal" } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Parse multi-keys (comma-separated)
    const elevenlabsKeys = parseKeys(body.elevenlabsKey || process.env.ELEVENLABS_API_KEY);
    const sarvamKeys = parseKeys(body.sarvamKey || process.env.SARVAM_API_KEY);
    const openaiKeys = parseKeys(body.openaiKey || process.env.OPENAI_API_KEY);

    console.log(`[TTS] Request: lang=${lang}, emotion=${emotion}, text="${text.substring(0, 50)}..."`);
    console.log(`[TTS] Keys: elevenLabs=${elevenlabsKeys.length}, sarvam=${sarvamKeys.length}, openai=${openaiKeys.length}`);

    // Priority 1: ElevenLabs Turbo v2.5 — THE BEST
    if (elevenlabsKeys.length > 0) {
      const result = await tryElevenLabs(text, lang, emotion, elevenlabsKeys, body.voiceId || process.env.ELEVENLABS_VOICE_ID);
      if (result) return result;
    }

    // Priority 2: Sarvam AI — Natural Hindi/Urdu
    if (sarvamKeys.length > 0) {
      const result = await trySarvamAI(text, lang, emotion, sarvamKeys);
      if (result) return result;
    }

    // Priority 3: OpenAI TTS HD
    if (openaiKeys.length > 0) {
      const result = await tryOpenAITTS(text, lang, emotion, openaiKeys);
      if (result) return result;
    }

    // Priority 4: Google Translate (robotic but free)
    const googleResult = await tryGoogleTranslate(text, lang);
    if (googleResult) return googleResult;

    // Priority 5: StreamElements
    const streamResult = await tryStreamElements(text, lang);
    if (streamResult) return streamResult;

    console.error("[TTS] ALL providers failed!");
    return NextResponse.json({ error: "TTS service unavailable" }, { status: 503 });
  } catch (error) {
    console.error("[TTS API Error]", error);
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
