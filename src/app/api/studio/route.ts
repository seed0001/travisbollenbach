import { NextRequest, NextResponse } from "next/server";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import { getStudiosByOwner, updateStudio } from "@/lib/studios";

export const dynamic = "force-dynamic";

async function sessionUser(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  return getUserBySession(token);
}

// The studios the signed-in visitor owns (empty if none / not signed in).
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ studios: [] });
  return NextResponse.json({ studios: await getStudiosByOwner(user.id) });
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
    },
    { userId: user.id, isAdmin: user.role === "admin" },
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }
  return NextResponse.json({ studio: result });
}
