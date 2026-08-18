import type { Metadata } from "next";
import Hero from "@/components/Hero";

export const metadata: Metadata = {
  title: "Travis Bollenbach",
  description:
    "Independent, self-taught software builder — AI agents, Discord bots, small business software, interactive 3D experiences, and AI content pipelines.",
};

export default function Home() {
  return <Hero />;
}
