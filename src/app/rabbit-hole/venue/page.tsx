import type { Metadata } from "next";
import VenueChoice from "@/components/VenueChoice";

export const metadata: Metadata = {
  title: "The Colossus — Travis Bollenbach",
  description:
    "Step into The Colossus: the Game Arena, a lobby of playable 3D worlds; the Concert Hall, a hall in the round with a live stage; or the Movie Theater, a single-screen cinema for your own films.",
};

export default function VenuePage() {
  return <VenueChoice />;
}
