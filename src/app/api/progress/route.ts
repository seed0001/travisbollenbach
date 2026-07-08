import { NextRequest, NextResponse } from "next/server";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import {
  collectShard,
  getProgress,
  markLobbyJoin,
  setAvatarHue,
} from "@/lib/progress";
import {
  GALAXY_CLEAR_XP,
  GALAXY_ROOM_ID,
  SHARD_COUNT,
  SHARD_XP,
  isShardId,
} from "@/lib/space";

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
  const { avatarHue, joinedLobby, collectShard: shardId } = (body ?? {}) as {
    avatarHue?: unknown;
    joinedLobby?: unknown;
    collectShard?: unknown;
  };

  if (typeof avatarHue === "number" && Number.isFinite(avatarHue)) {
    return NextResponse.json({ progress: await setAvatarHue(user.id, avatarHue) });
  }
  if (joinedLobby === true) {
    return NextResponse.json({ progress: await markLobbyJoin(user.id) });
  }
  if (typeof shardId === "string") {
    if (!isShardId(shardId)) {
      return NextResponse.json({ error: "Unknown shard." }, { status: 400 });
    }
    const result = await collectShard(user.id, shardId, {
      shardXp: SHARD_XP,
      totalShards: SHARD_COUNT,
      clearXp: GALAXY_CLEAR_XP,
      roomId: GALAXY_ROOM_ID,
    });
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}
