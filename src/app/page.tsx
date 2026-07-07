import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Travis Bollenbach — Under Construction",
  description: "Site under construction. Back soon.",
  robots: { index: false, follow: false },
};

// Temporary static landing page — no links, no entry points. The full site
// (ChoiceScreen and everything behind it) stays in the tree, just unrouted,
// until it's ready for release.
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-[#0a0a0f] px-6 text-center">
      <div
        aria-hidden
        className="h-16 w-16 animate-spin rounded-full border-4 border-white/15 border-t-white/80 [animation-duration:1.6s]"
      />
      <div>
        <h1 className="text-lg font-semibold tracking-wide text-white/90">
          Site under construction
        </h1>
        <p className="mt-2 text-sm text-white/50">Back soon.</p>
      </div>
    </main>
  );
}
