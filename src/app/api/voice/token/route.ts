import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";

const ROOM_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;
const IDENTITY_PATTERN = /^[a-zA-Z0-9_.:-]{1,96}$/;

function clean(value: unknown, pattern: RegExp, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return pattern.test(trimmed) ? trimmed : fallback;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const room = clean(body.room, ROOM_PATTERN, "main-lobby");
  const identity = clean(
    body.identity,
    IDENTITY_PATTERN,
    `player-${crypto.randomUUID()}`,
  );

  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    return NextResponse.json(
      {
        error:
          "Voice service is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in Railway.",
      },
      { status: 503 },
    );
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    ttl: "2h",
  });
  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  return NextResponse.json({
    url,
    token: await token.toJwt(),
  });
}
