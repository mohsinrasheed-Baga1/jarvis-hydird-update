import { NextRequest, NextResponse } from "next/server";

// Server-side TTS endpoint — bypasses CORS restrictions
// Google Translate TTS works from server-side but is blocked by CORS in browser

export async function POST(req: NextRequest) {
  try {
    const { text, lang } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const targetLang = lang === "ur" ? "ur" : "en";
    const cleanText = text.substring(0, 200);
    const encoded = encodeURIComponent(cleanText);

    // Try multiple Google TTS endpoints
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
          if (contentType.includes("audio") || contentType.includes("mpeg") || contentType.includes("mp3")) {
            const audioBuffer = await response.arrayBuffer();
            if (audioBuffer.byteLength > 500) {
              // Valid audio (more than 500 bytes)
              console.log(`[TTS] Success with URL variant, size: ${audioBuffer.byteLength}`);
              return new NextResponse(audioBuffer, {
                headers: {
                  "Content-Type": "audio/mpeg",
                  "Cache-Control": "public, max-age=3600",
                  "Access-Control-Allow-Origin": "*",
                },
              });
            }
          }
        }
      } catch (fetchErr) {
        console.warn(`[TTS] URL variant failed:`, fetchErr);
        continue;
      }
    }

    // All URL variants failed — return error
    console.error("[TTS] All Google TTS endpoints failed");
    return NextResponse.json({ error: "TTS service unavailable" }, { status: 503 });
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
