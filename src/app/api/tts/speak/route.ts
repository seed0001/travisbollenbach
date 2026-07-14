import { NextRequest, NextResponse } from "next/server";

// Fish Audio text-to-speech. POST { text } and get back an audio/mpeg blob.
// This is the contract the in-world voices already expect (see LunaTTS). Set
// FISH_AUDIO_API_KEY in the deploy env; optionally FISH_AUDIO_VOICE_ID to pick
// a specific voice model, and FISH_AUDIO_MODEL to pin the TTS model version.

export const dynamic = "force-dynamic";

const FISH_TTS_URL = "https://api.fish.audio/v1/tts";
const MAX_TEXT = 2000;

function readKey(): string | null {
  const raw = process.env.FISH_AUDIO_API_KEY;
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^["']|["']$/g, "").trim();
  return cleaned || null;
}

export async function POST(request: NextRequest) {
  const key = readKey();
  if (!key) {
    return NextResponse.json(
      { error: "The voice backend isn't connected yet." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const text =
    body && typeof (body as { text?: unknown }).text === "string"
      ? (body as { text: string }).text.trim().slice(0, MAX_TEXT)
      : "";
  if (!text) {
    return NextResponse.json({ error: "Nothing to say." }, { status: 400 });
  }

  const referenceId = process.env.FISH_AUDIO_VOICE_ID?.trim() || undefined;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  // Fish selects the TTS model version via a header (e.g. "speech-1.6", "s1").
  const model = process.env.FISH_AUDIO_MODEL?.trim();
  if (model) headers["model"] = model;

  let upstream: Response;
  try {
    upstream = await fetch(FISH_TTS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text,
        reference_id: referenceId,
        format: "mp3",
        mp3_bitrate: 128,
        normalize: true,
        latency: "normal",
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the voice backend." },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    const status = upstream.status;
    const message =
      status === 401 || status === 403
        ? "The Fish Audio key was rejected."
        : status === 402 || /credit|quota|balance/i.test(detail)
          ? "The Fish Audio account is out of credits."
          : status === 429
            ? "The voice backend is rate limited right now."
            : "The voice backend returned an error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const audio = await upstream.arrayBuffer();
  return new Response(audio, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
