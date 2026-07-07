import type { Metadata } from "next";
import ChoiceScreen from "@/components/ChoiceScreen";

export const metadata: Metadata = {
  title: "Travis Bollenbach — Choose",
  description:
    "Blue pill: tools and applications built for the real world. Red pill: character creation, AI consciousness, and a world you can walk through. Choose.",
};

export default function Home() {
  return (
    <main>
      <ChoiceScreen />
    </main>
  );
}
