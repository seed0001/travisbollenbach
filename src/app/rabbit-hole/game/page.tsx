import type { Metadata } from "next";
import ConstructGame from "@/components/ConstructGame";

export const metadata: Metadata = {
  title: "The Construct — Travis Bollenbach",
  description:
    "A rendered world you can walk through. Five questions stand in the dark — go stand next to one.",
};

export default function GamePage() {
  return (
    <main>
      <ConstructGame />
    </main>
  );
}
