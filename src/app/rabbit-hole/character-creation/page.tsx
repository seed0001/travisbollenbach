import type { Metadata } from "next";
import CharacterWorkshop from "@/components/CharacterWorkshop";

export const metadata: Metadata = {
  title: "Character Creation — Travis Bollenbach",
  description:
    "Level 01 of the rabbit hole: craft a persona statement, compile an AI character, and talk with it inside a rendered chamber of the construct.",
};

export default function CharacterCreationPage() {
  return <CharacterWorkshop />;
}
