import { nav, site } from "@/lib/content";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div>
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-ink"
          >
            Travis<span className="text-accent">.</span>Bollenbach
          </a>
          <p className="mt-1 text-sm text-ink-dim">
            © {year} {site.name}. Built with intent.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-ink-soft transition-colors hover:text-ink"
            >
              {item.label}
            </a>
          ))}
          <a
            href={`mailto:${site.email}`}
            className="text-sm text-ink-soft transition-colors hover:text-ink"
          >
            Email
          </a>
        </div>
      </div>
    </footer>
  );
}
