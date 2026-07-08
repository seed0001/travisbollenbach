import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import GalaxyRoomClient from "@/components/GalaxyRoomClient";

export const metadata: Metadata = {
  title: "Room 01 — The Galaxy",
  description:
    "A star fighter, nine uncharted worlds, and twelve shards of light.",
  robots: { index: false },
};

// rooms are for players — session checked on every request
export const dynamic = "force-dynamic";

export default async function GalaxyRoomPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? "";
  const user = await getUserBySession(token);
  if (!user) {
    redirect("/account?next=/rooms/galaxy");
  }
  return <GalaxyRoomClient />;
}
