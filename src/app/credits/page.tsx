import type { Metadata } from "next";
import Link from "next/link";
import { creditedCreators } from "@/lib/content";

export const metadata: Metadata = {
  title: "Credits — Travis Bollenbach",
  description:
    "The open-source creators whose work grows inside this world. Every borrowed marvel gets a name.",
};

export default function CreditsPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] px-6 py-16 text-white md:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">
          the archive
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
          Credits
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-white/55">
          This world is built on the shoulders of open-source creators. Some of
          them don&apos;t know their work lives here — that&apos;s how open
          source works, and that&apos;s why every one of them gets a name, a
          page, and a place. Inside the world, switch on the credit layer and
          walk up to anything borrowed to see who made it.
        </p>

        <div className="mt-12 space-y-4">
          {creditedCreators.map((creator) => (
            <Link
              key={creator.id}
              href={`/credits/${creator.id}`}
              className="flex items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/30 hover:bg-white/[0.06]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote GitHub avatar, no optimizer config needed */}
              <img
                src={creator.avatarUrl}
                alt={creator.name}
                width={56}
                height={56}
                className="h-14 w-14 rounded-full border border-white/15 object-cover"
              />
              <div className="min-w-0">
                <p className="font-semibold text-white/90">{creator.name}</p>
                <p className="mt-0.5 truncate text-sm text-white/45">
                  {creator.tagline}
                </p>
                <p className="mt-1 text-xs text-white/35">
                  {creator.works.map((work) => work.project).join(" · ")}
                </p>
              </div>
              <span className="ml-auto text-white/30">→</span>
            </Link>
          ))}
        </div>

        <p className="mt-12 text-sm text-white/35">
          More is coming — procedural planets, vegetation, and the rest of the
          growing world, each with its maker&apos;s name attached.
        </p>
        <Link
          href="/rabbit-hole/game"
          className="mt-8 inline-block text-sm text-white/50 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          ← walk the world they helped build
        </Link>
      </div>
    </main>
  );
}
