import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Guestbook from "@/components/Guestbook";
import MatrixRain from "@/components/MatrixRain";
import Reveal from "@/components/Reveal";
import { about, channels, rabbitHole, site } from "@/lib/content";
import portrait from "../../../public/travis-and-dog.jpg";

export const metadata: Metadata = {
  title: "Immersive Environment - Travis Bollenbach",
  description:
    "An immersive 3D environment for character creation, AI consciousness, worlds, simulation, and story systems.",
};

export default function RabbitHole() {
  return (
    <main className="scanlines relative min-h-svh bg-[#090b10] text-ink">
      <MatrixRain color="143, 179, 255" intensity={0.16} speed={0.22} />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(circle_at_50%_8%,rgba(143,179,255,0.14),transparent_28rem),linear-gradient(180deg,rgba(9,11,16,0.68),rgba(9,11,16,0.96))]" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 pb-28">
        <header className="flex items-center justify-between py-6">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-ink transition-colors hover:text-[#b8c9ff]"
          >
            Travis<span className="text-[#8fb3ff]">.</span>Bollenbach
          </Link>
          <Link
            href="/storefront"
            className="text-xs uppercase tracking-[0.22em] text-ink-dim transition-colors hover:text-[#b8c9ff]"
          >
            view portfolio
          </Link>
        </header>

        <section className="pb-16 pt-16 md:pt-24">
          <Reveal>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-[#8fb3ff]">
              immersive environment
            </p>
            <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight text-white md:text-6xl">
              Step into the ideas behind the work.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-soft">
              This side is not the portfolio. It is an interactive environment
              for identity, simulation, machine intelligence, and story systems.
            </p>
          </Reveal>
        </section>

        <section className="space-y-5 py-8">
          {channels.map((channel, i) => (
            <Reveal key={channel.id} delay={i * 0.04}>
              <article
                id={channel.id}
                className="rounded-lg border border-white/10 bg-white/[0.055] p-8 backdrop-blur-md transition-colors hover:border-white/22 md:p-10"
              >
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-ink-dim">
                  signal {String(i + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-white md:text-3xl">
                  {channel.title}
                </h2>
                <p className="mt-2 text-[#b8c9ff]">{channel.question}</p>
                <div className="mt-6 space-y-4 leading-relaxed text-ink-soft">
                  {channel.body.map((paragraph) => (
                    <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                  ))}
                </div>
              </article>
            </Reveal>
          ))}
        </section>

        <section id="architect" className="pt-8">
          <Reveal>
            <div className="grid items-center gap-10 rounded-lg border border-white/10 bg-white/[0.055] p-8 backdrop-blur-md md:grid-cols-[minmax(0,300px)_1fr] md:p-10">
              <div className="matrix-photo relative mx-auto w-full max-w-[300px] overflow-hidden rounded-lg border border-white/12">
                <Image
                  src={portrait}
                  alt={about.photoAlt}
                  placeholder="blur"
                  sizes="(min-width: 768px) 300px, 90vw"
                  className="h-auto w-full"
                />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-dim">
                  {about.rabbitHole.eyebrow}
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-[#dbe5ff] md:text-3xl">
                  {about.rabbitHole.title}
                </h2>
                <div className="mt-5 space-y-4 leading-relaxed text-ink-soft">
                  {about.rabbitHole.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="pt-12">
          <Reveal>
            <Link
              href={rabbitHole.gameCta.href}
              className="group block rounded-lg border border-[#8fb3ff]/28 bg-[#121826]/72 p-10 text-center transition-all hover:border-[#8fb3ff]/60 hover:shadow-[0_0_60px_rgba(143,179,255,0.14)] md:p-16"
            >
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-ink-dim">
                the world is active
              </p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-[#dbe5ff] md:text-5xl">
                {rabbitHole.gameCta.title}
              </h2>
              <p className="mx-auto mt-5 max-w-xl leading-relaxed text-ink-soft">
                Step into the 3D space and move through the questions as
                places.
              </p>
              <span className="mt-8 inline-block rounded-md border border-[#8fb3ff]/60 px-8 py-3 text-sm font-black uppercase tracking-[0.18em] text-[#dbe5ff] transition-all group-hover:bg-[#dbe5ff] group-hover:text-[#0b1020]">
                enter world
              </span>
            </Link>
          </Reveal>
        </section>

        <section id="guestbook" className="pt-16">
          <Reveal>
            <Guestbook />
          </Reveal>
        </section>

        <footer className="mt-20 flex flex-col items-center gap-2 border-t border-white/10 pt-8 text-center text-xs text-ink-dim">
          <p>
            (c) {new Date().getFullYear()} {site.name}.
          </p>
          <Link
            href="/"
            className="uppercase tracking-[0.22em] transition-colors hover:text-ink-soft"
          >
            back to the choice
          </Link>
        </footer>
      </div>
    </main>
  );
}
