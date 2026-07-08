import type { Metadata } from "next";
import Link from "next/link";
import AccountPanel from "@/components/AccountPanel";

export const metadata: Metadata = {
  title: "Access — Travis Bollenbach",
  description: "Log in or create an account.",
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <main className="scanlines relative min-h-svh text-ink">
      <div className="relative z-10 mx-auto max-w-xl px-6 pb-28">
        <header className="flex items-center justify-between py-6">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-ink transition-colors hover:text-matrix"
          >
            Travis<span className="text-matrix">.</span>Bollenbach
          </Link>
        </header>

        <section className="pb-10 pt-16 md:pt-24">
          <p className="glow-green mb-4 text-xs uppercase tracking-[0.35em] text-matrix">
            restricted terminal
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Who goes
            <span className="glow-green block text-matrix">there?</span>
          </h1>
        </section>

        <AccountPanel />

        <footer className="mt-20 border-t border-line pt-8 text-center text-xs text-ink-dim">
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
