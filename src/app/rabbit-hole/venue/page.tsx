import type { Metadata } from "next";
import VenueChoice from "@/components/VenueChoice";

export const metadata: Metadata = {
  title: "The Colossus — Travis Bollenbach",
  description:
    "Step into The Colossus: choose the Game Arena, a lobby of playable 3D worlds, or the Concert Hall, a hall in the round with a live stage.",
};

export default function VenuePage() {
  return <VenueChoice />;
}
