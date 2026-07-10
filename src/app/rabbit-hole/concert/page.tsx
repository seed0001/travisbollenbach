import type { Metadata } from "next";
import ConcertHall from "@/components/ConcertHall";

export const metadata: Metadata = {
  title: "The Concert Hall — Travis Bollenbach",
  description:
    "A multi-level concert hall in the round: a sunken center stage ringed by balconies, with a VRM performer pacing the stage.",
};

export default function ConcertPage() {
  // Blockout / outline. Hand a `.vrm` (or `.glb`) URL to `artistSrc` to drop
  // the real performer onto the stage:
  //   <ConcertHall artistSrc="/uploads/your-artist.vrm" />
  return (
    <main>
      <ConcertHall />
    </main>
  );
}
