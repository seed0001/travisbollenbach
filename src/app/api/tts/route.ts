import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import { normalize, readSettings } from "@/lib/settings";

// ---------------------------------------------------------------------------
// The voice of the machine. One endpoint, two engines, picked by tier:
//   tier "low"  → Edge TTS  — Microsoft's neural voices, free, no key
//   tier "high" → Fish Audio — premium voices, keyed, paid per use
// Lower levels of the game speak through Edge; the deeper, more expensive
// minds speak through Fish. No Fish key saved → high tier falls back to Edge,
// so the game never goes mute over a missing credential.
// ---------------------------------------------------------------------------

const FISH_URL = process.env.FISH_AUDIO_URL ?? "https://api.fish.audio/v1/tts";
const MAX_TEXT = 600;
const RATE_LIMIT = 60; // syntheses per window per user
const RATE_WINDOW_MS = 10 * 60 * 1000;

const recent = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const stamps = (recent.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (stamps.length >= RATE_LIMIT) {
    recent.set(key, stamps);
    return true;
  }
  stamps.push(now);
  recent.set(key, stamps);
  return false;
}

async function synthesizeEdge(text: string, voice: string): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    audioStream.on("end", () => resolve(Buffer.concat(chunks)));
    audioStream.on("error", reject);
  });
}

async function synthesizeFish(
  text: string,
  apiKey: string,
  voiceId: string,
): Promise<Buffer> {
  const response = await fetch(FISH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      format: "mp3",
      ...(voiceId ? { reference_id: voiceId } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`fish audio ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const user = await getUserBySession(token);
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (isRateLimited(user.id)) {
    return NextResponse.json(
      { error: "The voice needs a rest. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const rawText = (body as { text?: unknown })?.text;
  const tier = (body as { tier?: unknown })?.tier === "high" ? "high" : "low";
  if (typeof rawText !== "string") {
    return NextResponse.json({ error: "Nothing to say." }, { status: 400 });
  }
  const text = rawText.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
  if (!text) {
    return NextResponse.json({ error: "Nothing to say." }, { status: 400 });
  }

  const settings = await readSettings();
  const edgeVoice =
    normalize(settings.edgeVoice) || "en-US-ChristopherNeural";
  const fishKey =
    normalize(settings.fishAudioApiKey) ||
    normalize(process.env.FISH_AUDIO_API_KEY);
  const fishVoice = normalize(settings.fishVoiceId);

  try {
    let audio: Buffer;
    let engine: string;
    if (tier === "high" && fishKey) {
      try {
        audio = await synthesizeFish(text, fishKey, fishVoice);
        engine = "fish";
      } catch (error) {
        // premium voice down — degrade to Edge rather than going mute
        console.error("tts: fish audio failed, falling back to edge", error);
        audio = await synthesizeEdge(text, edgeVoice);
        engine = "edge-fallback";
      }
    } else {
      audio = await synthesizeEdge(text, edgeVoice);
      engine = "edge";
    }
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-TTS-Engine": engine,
      },
    });
  } catch (error) {
    console.error("tts: synthesis failed", error);
    return NextResponse.json(
      { error: "voice_unavailable" },
      { status: 503 },
    );
  }
}
