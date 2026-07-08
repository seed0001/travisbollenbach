import type { Metadata } from "next";
import ArenaLobby from "@/components/ArenaLobby";

export const metadata: Metadata = {
  title: "The Arena — Travis Bollenbach",
  description:
    "Inside the Superdome: a lobby of 3D worlds. Walk up to a pod and step into the game.",
};

export default function ArenaPage() {
  return (
    <main>
      <ArenaLobby />
    </main>
  );
}
