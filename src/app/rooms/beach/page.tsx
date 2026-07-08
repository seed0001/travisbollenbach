import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import BeachRoomClient from "@/components/BeachRoomClient";

export const metadata: Metadata = {
  title: "Room 02 — The Shore",
  description: "A warm cove, rolling surf, and ten shells in the sand.",
  robots: { index: false },
};

// rooms are for players — session checked on every request
export const dynamic = "force-dynamic";

export default async function BeachRoomPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? "";
  const user = await getUserBySession(token);
  if (!user) {
    redirect("/account?next=/rooms/beach");
  }
  return <BeachRoomClient />;
}
