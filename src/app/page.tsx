import type { Metadata } from "next";
import ChoiceScreen from "@/components/ChoiceScreen";

export const metadata: Metadata = {
  title: "Travis Bollenbach - Choose",
  description:
    "Choose the professional portfolio or enter an immersive 3D environment.",
};

export default function Home() {
  return <ChoiceScreen />;
}
