import type { Metadata } from "next";
import MovieTheater from "@/components/MovieTheater";

export const metadata: Metadata = {
  title: "The Movie Theater — Travis Bollenbach",
  description:
    "A single-screen cinema inside The Colossus: stepped rows under a starfield ceiling and a giant screen that plays your own films.",
};

export default function TheaterPage() {
  return (
    <main>
      <MovieTheater />
    </main>
  );
}
