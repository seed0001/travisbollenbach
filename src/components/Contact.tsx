import { site } from "@/lib/content";
import Reveal from "./Reveal";

export default function Contact() {
  return (
    <section id="contact" className="relative px-6 py-28">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-line bg-gradient-to-br from-surface/80 to-bg-soft/60 p-10 text-center sm:p-16">
            <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-accent/20 blur-[90px]" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-accent-3/20 blur-[90px]" />

            <p className="relative font-mono text-sm uppercase tracking-[0.2em] text-accent">
              Let&apos;s build
            </p>
            <h2 className="relative mt-4 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-6xl">
              Got something in mind?
            </h2>
            <p className="relative mx-auto mt-5 max-w-xl text-lg text-ink-soft">
              Whether it&apos;s a product to build, a brand to shape, or a launch
              to pull off — I&apos;d love to hear about it.
            </p>

            <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
              <a
                href={`mailto:${site.email}`}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 font-semibold text-bg shadow-glow transition-transform hover:scale-[1.03]"
              >
                {site.email}
              </a>
              <a
                href="#top"
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/40 px-7 py-3.5 font-semibold text-ink transition-colors hover:border-ink-dim"
              >
                Back to top ↑
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
