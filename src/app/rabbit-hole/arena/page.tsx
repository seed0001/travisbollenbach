import type { Metadata } from "next";
import ArenaLobby from "@/components/ArenaLobby";
import { getPublicArenaGames } from "@/lib/studios";

export const metadata: Metadata = {
  title: "The Arena — Travis Bollenbach",
  description:
    "Inside the Superdome: a lobby of 3D worlds. Walk up to a pod and step into the game.",
};

// Pods reflect live studio ownership, so read them fresh on each visit.
export const dynamic = "force-dynamic";

export default async function ArenaPage() {
  const games = await getPublicArenaGames();
  return (
    <main>
      <ArenaLobby games={games} />
    </main>
  );
}
