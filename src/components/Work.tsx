import { projects } from "@/lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function Work() {
  return (
    <section id="work" className="relative px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Selected Work"
          title="Things I've shipped."
          description="A cross-section of software, design, and business projects — different disciplines, same obsession with getting the details right."
        />

        <div className="grid gap-6 md:grid-cols-2">
          {projects.map((project, i) => (
            <Reveal key={project.title} delay={i * 0.08}>
              <article className="group relative h-full overflow-hidden rounded-3xl border border-line bg-surface/40 p-8 transition-colors hover:border-ink-dim/60">
                <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100 md:opacity-0" />

                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-line px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink-soft">
                    {project.category}
                  </span>
                  <span className="font-mono text-sm text-ink-dim">
                    {project.year}
                  </span>
                </div>

                <h3 className="mt-6 font-display text-2xl font-bold text-ink transition-colors group-hover:text-accent">
                  {project.title}
                </h3>
                <p className="mt-3 text-ink-soft">{project.description}</p>

                <div className="mt-6 flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-bg-soft px-2.5 py-1 font-mono text-xs text-ink-dim"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
