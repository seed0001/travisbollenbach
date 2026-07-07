import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Travis Bollenbach — Welcome",
  description:
    "Welcome. The lobby is open — jack in and play. Vibe Market is live — host your custom builds, one-offs, and services.",
};

// The front door: a plain welcome, what's live, and what's on the way.
// The lobby launches the game; the marketplace points at vibemarket.biz.
export default function Home() {
  return (
    <main className="scanlines relative flex min-h-svh flex-col items-center justify-center bg-black px-6 py-16 text-ink">
      <div className="relative z-10 w-full max-w-3xl text-center">
        <p className="glow-green mb-4 text-xs uppercase tracking-[0.35em] text-matrix">
          travis bollenbach
        </p>
        <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          Welcome<span className="glow-green text-matrix">.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl leading-relaxed text-ink-soft">
          This place is a game, and it is being built while you stand in it.
          Two doors are open right now.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* available now — the lobby */}
          <Link
            href="/lobby"
            className="group flex flex-col rounded-3xl border border-matrix-dim bg-matrix-dark/40 p-8 text-left transition-all hover:border-matrix hover:shadow-[0_0_60px_rgba(0,255,102,0.15)]"
          >
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-matrix">
              available now
            </p>
            <h2 className="glow-green mt-3 text-3xl font-bold tracking-tight text-matrix">
              The Lobby
            </h2>
            <p className="mt-3 grow leading-relaxed text-ink-soft">
              The Nexus — a shared island where the game begins. Sign in, take
              a form, and stand with everyone else who is jacked in right now.
              Talk out loud: voices carry by distance. The first escape rooms
              open behind its sealed gates soon.
            </p>
            <span className="mt-6 inline-block self-start rounded-full border border-matrix px-6 py-3 text-xs font-bold uppercase tracking-widest text-matrix transition-all group-hover:bg-matrix group-hover:text-black">
              jack in →
            </span>
          </Link>

          {/* live — Vibe Market */}
          <a
            href="https://vibemarket.biz"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col rounded-3xl border border-line bg-surface/60 p-8 text-left transition-all hover:border-pill-blue hover:shadow-[0_0_60px_rgba(56,189,248,0.15)]"
          >
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-pill-blue">
              live now
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink">
              Vibe Market
            </h2>
            <p className="mt-3 grow leading-relaxed text-ink-soft">
              The marketplace is open. Come host your custom builds, your
              crazy one-offs — or even your time and services. Check out
              vibemarket.biz.
            </p>
            <span className="mt-6 inline-block self-start rounded-full border border-pill-blue px-6 py-3 text-xs font-bold uppercase tracking-widest text-pill-blue transition-all group-hover:bg-pill-blue group-hover:text-black">
              visit vibemarket.biz →
            </span>
          </a>
        </div>

        <p className="mt-12 text-xs uppercase tracking-[0.25em] text-ink-dim">
          <Link
            href="/account"
            className="underline-offset-4 transition-colors hover:text-matrix hover:underline"
          >
            log in / sign up
          </Link>
          <span className="mx-3">·</span>
          progress, XP, and your avatar live on your account
        </p>
      </div>
    </main>
  );
}
