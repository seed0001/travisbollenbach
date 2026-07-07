import type { Metadata } from "next";
import CharacterWorkshop from "@/components/CharacterWorkshop";

export const metadata: Metadata = {
  title: "Character Creation — Travis Bollenbach",
  description:
    "The studio: name a character, write its persona, and meet it face to face in a bright 3D room — a conversation with something you wrote into being.",
};

export default function CharacterCreationPage() {
  return <CharacterWorkshop />;
}
