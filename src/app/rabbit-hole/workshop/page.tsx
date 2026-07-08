import type { Metadata } from "next";
import MatrixRain from "@/components/MatrixRain";
import Workshop from "@/components/Workshop";
import { openRouterConfigured } from "@/lib/openrouter";

export const metadata: Metadata = {
  title: "Character Workshop — Travis Bollenbach",
  description:
    "Design an AI persona — a character or a professional tool — and talk to it live.",
};

// Reads the live env each request to know whether the AI backend is connected.
export const dynamic = "force-dynamic";

export default function WorkshopPage() {
  return (
    <main className="scanlines relative min-h-svh bg-[#090b10] text-ink">
      <MatrixRain color="143, 179, 255" intensity={0.14} speed={0.22} />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_50%_8%,rgba(143,179,255,0.14),transparent_28rem),linear-gradient(180deg,rgba(9,11,16,0.68),rgba(9,11,16,0.96))]" />
      <Workshop configured={openRouterConfigured()} />
    </main>
  );
}
