import type { Metadata } from "next";
import ConstructGame from "@/components/ConstructGameClient";

export const metadata: Metadata = {
  title: "The Construct — Travis Bollenbach",
  description:
    "An open world grown from a single seed. Five questions stand in the meadow — go stand next to one.",
};

export default function GamePage() {
  return (
    <main>
      <ConstructGame />
    </main>
  );
}
