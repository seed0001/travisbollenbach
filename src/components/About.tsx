import { stats } from "@/lib/content";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

export default function About() {
  return (
    <section id="about" className="relative px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading eyebrow="About" title="One person, many lanes." />
            <Reveal className="space-y-5 text-lg text-ink-soft">
              <p>
                I&apos;ve never fit neatly into one box — and I stopped trying.
                I&apos;m an engineer who cares about how things look, a designer
                who can ship the code, and a founder who sweats both.
              </p>
              <p>
                That overlap is the point. The best products come from people who
                can move between the technical, the visual, and the strategic
                without losing the thread. That&apos;s the space I live in.
              </p>
              <p>
                This site is my home base — a living showcase of what I make and
                an open door if you want to build something together.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-line bg-surface/40 p-7"
                >
                  <div className="font-display text-4xl font-extrabold text-gradient">
                    {stat.value}
                  </div>
                  <div className="mt-2 text-sm text-ink-soft">{stat.label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
