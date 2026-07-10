import type { Metadata } from "next";
import ConcertHall from "@/components/ConcertHall";

export const metadata: Metadata = {
  title: "The Concert Hall — Travis Bollenbach",
  description:
    "A multi-level concert hall in the round: Luna sings and dances on the sunken center stage with lip sync and VRMA choreography.",
};

export default function ConcertPage() {
  // Luna performs the default setlist; pass `track` to open on another song:
  //   <ConcertHall track={LUNA_CONCERT_TRACKS[1]} />
  return (
    <main>
      <ConcertHall />
    </main>
  );
}
