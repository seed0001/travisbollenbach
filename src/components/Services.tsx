import { services } from "@/lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function Services() {
  return (
    <section id="services" className="relative px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Work With Me"
          title="Services & business."
          description="Bring me in for the whole thing or just the part you need. Here's how I help teams and founders ship."
        />

        <div className="grid gap-6 md:grid-cols-3">
          {services.map((service, i) => (
            <Reveal key={service.title} delay={i * 0.1}>
              <div className="flex h-full flex-col rounded-3xl border border-line bg-surface/40 p-8 transition-colors hover:border-accent/50">
                <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 font-display text-lg font-bold text-accent">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="font-display text-xl font-bold text-ink">
                  {service.title}
                </h3>
                <p className="mt-3 text-ink-soft">{service.description}</p>
                <ul className="mt-6 space-y-2 border-t border-line pt-6">
                  {service.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-center gap-3 text-sm text-ink-soft"
                    >
                      <span className="text-accent">→</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
