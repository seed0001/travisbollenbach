import type { Metadata } from "next";
import GameLobbyPage from "@/components/GameLobbyPage";

export const metadata: Metadata = {
  title: "Travis Bollenbach - Game Lobby",
  description: "Enter the game lobby and preview the level door map.",
  robots: { index: false, follow: false },
};

export default function Home() {
  return <GameLobbyPage />;
}
