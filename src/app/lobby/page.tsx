import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import LobbyClient from "@/components/LobbyClient";

export const metadata: Metadata = {
  title: "The Nexus — Travis Bollenbach",
  description: "The lobby of the game. Sign in, take a form, meet the others.",
  robots: { index: false },
};

// the gate is the whole point — check the session on every request
export const dynamic = "force-dynamic";

export default async function LobbyPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? "";
  const user = await getUserBySession(token);
  if (!user) {
    redirect("/account?next=/lobby");
  }
  return <LobbyClient />;
}
