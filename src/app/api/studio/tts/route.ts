import { NextRequest, NextResponse } from "next/server";
import { getStudio } from "@/lib/studios";
import { fishTts, FISH_TEXT_LIMIT } from "@/lib/fish";
import { clientIp, rateLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Every synth spends the owner's Fish credits. This covers both the walk-up
// greeting (fired on each pass) and spoken chat replies, so keep the cap loose
// enough for a normal visit but bounded per IP.
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const unit = (body as { unit?: unknown })?.unit;
  const text = (body as { text?: unknown })?.text;
  if (typeof unit !== "string" || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const studio = await getStudio(unit);
  if (!studio) {
    return NextResponse.json({ error: "Unknown unit." }, { status: 404 });
  }
  if (!studio.fishApiKey.trim()) {
    return NextResponse.json(
      { error: "This shop has no voice configured.", reason: "not_configured" },
      { status: 503 },
    );
  }

  if (rateLimited("tts", clientIp(request), RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Voice rate limit reached. Try again later." },
      { status: 429 },
    );
  }

  const result = await fishTts(studio.fishApiKey, text.slice(0, FISH_TEXT_LIMIT), {
    voiceId: studio.fishVoiceId,
  });

  if (!result.ok) {
    const status = result.reason === "not_configured" ? 503 : 502;
    return NextResponse.json(
      { error: result.message, reason: result.reason },
      { status },
    );
  }

  return new NextResponse(result.audio, {
    status: 200,
    headers: { "Content-Type": result.contentType, "Cache-Control": "no-store" },
  });
}
