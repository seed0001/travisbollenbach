import { NextRequest, NextResponse } from "next/server";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import { getProgress, markLobbyJoin, setAvatarHue } from "@/lib/progress";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const user = await getUserBySession(token);
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  return NextResponse.json({ progress: await getProgress(user.id) });
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const user = await getUserBySession(token);
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const { avatarHue, joinedLobby } = (body ?? {}) as {
    avatarHue?: unknown;
    joinedLobby?: unknown;
  };

  if (typeof avatarHue === "number" && Number.isFinite(avatarHue)) {
    return NextResponse.json({ progress: await setAvatarHue(user.id, avatarHue) });
  }
  if (joinedLobby === true) {
    return NextResponse.json({ progress: await markLobbyJoin(user.id) });
  }
  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}
