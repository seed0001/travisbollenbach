import type { Metadata } from "next";
import Link from "next/link";
import MatrixRain from "@/components/MatrixRain";
import Reveal from "@/components/Reveal";
import { channels, rabbitHole, site } from "@/lib/content";

export const metadata: Metadata = {
  title: "The Rabbit Hole — Travis Bollenbach",
  description:
    "Character creation, AI consciousness, worlds and simulation, story as code — and a rendered world you can walk through. You took the red pill.",
};

export default function RabbitHole() {
  return (
    <main className="scanlines relative min-h-svh text-ink">
      <MatrixRain intensity={0.35} />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-void/80" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 pb-28">
        {/* Header */}
        <header className="flex items-center justify-between py-6">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-ink transition-colors hover:text-matrix"
          >
            Travis<span className="text-matrix">.</span>Bollenbach
          </Link>
          <Link
            href="/storefront"
            className="text-xs uppercase tracking-[0.25em] text-ink-dim transition-colors hover:text-pill-blue"
          >
            take the blue pill instead →
          </Link>
        </header>

        {/* Hero */}
        <section className="pb-16 pt-16 md:pt-24">
          <Reveal>
            <p className="glow-green mb-4 text-xs uppercase tracking-[0.35em] text-matrix">
              You took the red pill
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              How deep does
              <span className="glow-green block text-matrix">
                the code go?
              </span>
            </h1>
            <p className="mt-6 max-w-2xl leading-relaxed text-ink-soft">
              {rabbitHole.intro}
            </p>
          </Reveal>
        </section>

        {/* Channels */}
        <section className="space-y-16 py-8">
          {channels.map((channel, i) => (
            <Reveal key={channel.id} delay={i * 0.05}>
              <article
                id={channel.id}
                className="rounded-3xl border border-line bg-surface/70 p-8 backdrop-blur-sm transition-colors hover:border-matrix-dim md:p-10"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
                  channel {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink md:text-3xl">
                  {channel.title}
                </h2>
                <p className="glow-green mt-2 text-matrix">
                  {channel.question}
                </p>
                <div className="mt-6 space-y-4 leading-relaxed text-ink-soft">
                  {channel.body.map((paragraph) => (
                    <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                  ))}
                </div>
              </article>
            </Reveal>
          ))}
        </section>

        {/* Game portal */}
        <section className="pt-12">
          <Reveal>
            <Link
              href={rabbitHole.gameCta.href}
              className="group block rounded-3xl border border-matrix-dim bg-matrix-dark/40 p-10 text-center transition-all hover:border-matrix hover:shadow-[0_0_60px_rgba(0,255,102,0.15)] md:p-16"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-ink-dim">
                the door is open
              </p>
              <h2 className="glow-green mt-4 text-3xl font-bold tracking-tight text-matrix md:text-5xl">
                {rabbitHole.gameCta.title}
              </h2>
              <p className="mx-auto mt-5 max-w-xl leading-relaxed text-ink-soft">
                {rabbitHole.gameCta.description}
              </p>
              <span className="mt-8 inline-block rounded-full border border-matrix px-8 py-3 font-bold uppercase tracking-widest text-matrix transition-all group-hover:bg-matrix group-hover:text-void">
                jack in →
              </span>
            </Link>
          </Reveal>
        </section>

        <footer className="mt-20 flex flex-col items-center gap-2 border-t border-line pt-8 text-center text-xs text-ink-dim">
          <p>
            © {new Date().getFullYear()} {site.name}. There is no spoon.
          </p>
          <Link
            href="/"
            className="uppercase tracking-[0.25em] transition-colors hover:text-ink-soft"
          >
            ← back to the choice
          </Link>
        </footer>
      </div>
    </main>
  );
}
