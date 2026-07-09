import { NextRequest, NextResponse } from "next/server";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import { getStudiosByOwner, toOwnerStudio, updateStudio } from "@/lib/studios";

export const dynamic = "force-dynamic";

async function sessionUser(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  return getUserBySession(token);
}

// The studios the signed-in visitor owns (empty if none / not signed in).
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ studios: [] });
  const owned = await getStudiosByOwner(user.id);
  // Owner-safe: strip raw API keys before they ever reach the browser.
  return NextResponse.json({ studios: owned.map(toOwnerStudio) });
}

// Update one of the visitor's own units (or any unit, if they're an admin).
export async function PATCH(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const unit = (body as { unit?: unknown })?.unit;
  if (typeof unit !== "string") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const result = await updateStudio(
    unit,
    {
      studioName: (body as { studioName?: unknown }).studioName,
      proprietor: (body as { proprietor?: unknown }).proprietor,
      tagline: (body as { tagline?: unknown }).tagline,
      walls: (body as { walls?: unknown }).walls,
      links: (body as { links?: unknown }).links,
      vrmSrc: (body as { vrmSrc?: unknown }).vrmSrc,
      avatarScale: (body as { avatarScale?: unknown }).avatarScale,
      avatarYaw: (body as { avatarYaw?: unknown }).avatarYaw,
      gameName: (body as { gameName?: unknown }).gameName,
      gameTagline: (body as { gameTagline?: unknown }).gameTagline,
      gameUrl: (body as { gameUrl?: unknown }).gameUrl,
      audioMode: (body as { audioMode?: unknown }).audioMode,
      audioText: (body as { audioText?: unknown }).audioText,
      audioUrl: (body as { audioUrl?: unknown }).audioUrl,
      aiEnabled: (body as { aiEnabled?: unknown }).aiEnabled,
      aiName: (body as { aiName?: unknown }).aiName,
      aiPersona: (body as { aiPersona?: unknown }).aiPersona,
      openRouterModel: (body as { openRouterModel?: unknown }).openRouterModel,
      openRouterKey: (body as { openRouterKey?: unknown }).openRouterKey,
      fishVoiceId: (body as { fishVoiceId?: unknown }).fishVoiceId,
      fishApiKey: (body as { fishApiKey?: unknown }).fishApiKey,
    },
    { userId: user.id, isAdmin: user.role === "admin" },
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  // Owner-safe: never echo the saved keys back.
  return NextResponse.json({ studio: toOwnerStudio(result) });
}
