import { NextResponse } from "next/server";
import { countUsers } from "@/lib/auth";
import { dayKey, readAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

// Written by server.mjs (same process); absent under `next dev`
type LobbyPresence = { count: number; hostOnline: boolean };

function lobbyPresence(): LobbyPresence {
  const presence = (globalThis as { __lobbyPresence?: LobbyPresence })
    .__lobbyPresence;
  return presence ?? { count: 0, hostOnline: false };
}

export async function GET() {
  const [analytics, members] = await Promise.all([
    readAnalytics(),
    countUsers(),
  ]);

  const today = analytics[dayKey()];
  const visitorsToday = today?.uniques.length ?? 0;
  const visitsToday = today
    ? Object.values(today.views).reduce((sum, n) => sum + n, 0)
    : 0;

  let recentVisits = 0;
  for (const day of Object.values(analytics)) {
    for (const views of Object.values(day.views)) {
      recentVisits += views;
    }
  }

  const presence = lobbyPresence();

  return NextResponse.json(
    {
      onlineNow: presence.count,
      hostOnline: presence.hostOnline,
      members,
      visitorsToday,
      visitsToday,
      recentVisits,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
