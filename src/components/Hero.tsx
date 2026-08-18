"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { hero, site } from "@/lib/content";

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
};

export default function Hero() {
  return (
    <main className="min-h-svh bg-void text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-10">
        <Link href="/" className="text-sm font-bold tracking-tight text-ink">
          {site.name}
        </Link>
        <nav className="flex items-center gap-6 text-xs font-semibold uppercase tracking-[0.18em] text-ink-dim">
          <a href="#services" className="transition-colors hover:text-ink">
            Services
          </a>
          <Link href="/storefront" className="transition-colors hover:text-ink">
            Work
          </Link>
          <Link href="/account" className="transition-colors hover:text-ink">
            Sign in
          </Link>
        </nav>
      </header>

      {/* --- Hero ------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:px-10 md:pb-28 md:pt-24">
        <div className="grid gap-12 md:grid-cols-[1.15fr_0.85fr] md:items-center md:gap-10">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-sm font-semibold uppercase tracking-[0.22em] text-matrix"
            >
              {hero.eyebrow}
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 text-5xl font-black leading-[1.02] tracking-tight text-ink sm:text-6xl md:text-6xl lg:text-7xl"
            >
              {hero.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.14 }}
              className="mt-4 max-w-lg text-lg font-semibold text-ink-soft md:text-xl"
            >
              {hero.subhead}
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.22 }}
              className="mt-6 max-w-lg text-base leading-7 text-ink-dim md:text-lg md:leading-8"
            >
              {hero.lede}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="mt-9 flex flex-wrap items-center gap-4"
            >
              <a
                href="#services"
                className="rounded-md bg-ink px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-void transition-opacity hover:opacity-85"
              >
                See what I build
              </a>
              <a
                href={`mailto:${site.email}`}
                className="rounded-md border border-line px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-ink transition-colors hover:border-ink-dim"
              >
                {hero.contact.cta}
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-xs md:max-w-none"
          >
            <div className="relative aspect-[900/1121] overflow-hidden rounded-lg border border-line bg-surface">
              <Image
                src="/travis-and-dog.jpg"
                alt="Travis Bollenbach crouched beside his dog on a stone wall"
                fill
                priority
                sizes="(min-width: 768px) 360px, 320px"
                className="object-cover"
              />
            </div>
            <p className="mt-3 text-center text-xs uppercase tracking-[0.18em] text-ink-dim">
              Travis — and his QA department
            </p>
          </motion.div>
        </div>
      </section>

      {/* --- What this is / isn't --------------------------------------- */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-20">
          <motion.h2
            {...fadeUp}
            transition={{ duration: 0.6 }}
            className="text-2xl font-black tracking-tight text-ink md:text-3xl"
          >
            {hero.honesty.title}
          </motion.h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-12">
            <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.05 }}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7dffa8]">
                What I bring
              </p>
              <ul className="mt-4 space-y-3">
                {hero.honesty.is.map((line) => (
                  <li
                    key={line}
                    className="text-sm leading-6 text-ink-soft md:text-base md:leading-7"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.12 }}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-dim">
                What I&rsquo;m not
              </p>
              <ul className="mt-4 space-y-3">
                {hero.honesty.isnt.map((line) => (
                  <li
                    key={line}
                    className="text-sm leading-6 text-ink-dim md:text-base md:leading-7"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* --- Services ----------------------------------------------------- */}
      <section id="services" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-20">
          <motion.p
            {...fadeUp}
            transition={{ duration: 0.6 }}
            className="text-xs font-bold uppercase tracking-[0.22em] text-matrix"
          >
            Services
          </motion.p>
          <motion.h2
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.04 }}
            className="mt-3 max-w-xl text-3xl font-black tracking-tight text-ink md:text-4xl"
          >
            What I build, grounded in what&rsquo;s actually shipped.
          </motion.h2>

          <div className="mt-12 divide-y divide-line border-y border-line">
            {hero.services.map((service, index) => (
              <motion.div
                key={service.n}
                {...fadeUp}
                transition={{ duration: 0.6, delay: 0.03 * index }}
                className="grid gap-4 py-8 md:grid-cols-[3.5rem_1fr_1fr] md:gap-8"
              >
                <p className="text-sm font-bold text-ink-dim">{service.n}</p>
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-ink">
                    {service.title}
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-ink-dim">
                    {service.blurb}
                  </p>
                </div>
                <div className="flex flex-wrap content-start gap-2 md:justify-end">
                  {service.proof.map((repo) => (
                    <a
                      key={repo.name}
                      href={repo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors hover:border-matrix hover:text-matrix"
                    >
                      {repo.name} ↗
                    </a>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Entry points into the 3D sections ---------------------------- */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-20">
          <motion.p
            {...fadeUp}
            transition={{ duration: 0.6 }}
            className="text-xs font-bold uppercase tracking-[0.22em] text-matrix"
          >
            {hero.entryPoints.title}
          </motion.p>
          <motion.p
            {...fadeUp}
            transition={{ duration: 0.6, delay: 0.04 }}
            className="mt-3 max-w-xl text-base leading-7 text-ink-dim md:text-lg"
          >
            {hero.entryPoints.intro}
          </motion.p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {hero.entryPoints.cards.map((card, index) => (
              <motion.div
                key={card.title}
                {...fadeUp}
                transition={{ duration: 0.6, delay: 0.04 * index }}
              >
                <Link
                  href={card.href}
                  className="group flex h-full flex-col justify-between rounded-lg border border-line bg-surface p-6 transition-colors hover:border-white/25"
                >
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-ink">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-ink-dim">
                      {card.description}
                    </p>
                  </div>
                  <p
                    className="mt-6 text-xs font-black uppercase tracking-[0.18em] transition-colors"
                    style={{ color: card.accent }}
                  >
                    Enter →
                  </p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Contact / footer --------------------------------------------- */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-16 md:flex-row md:items-center md:px-10">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-ink">
              {hero.contact.title}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-6 text-ink-dim">
              {hero.contact.description}
            </p>
          </div>
          <a
            href={`mailto:${site.email}`}
            className="shrink-0 rounded-md bg-ink px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-void transition-opacity hover:opacity-85"
          >
            {site.email}
          </a>
        </div>
        <div className="mx-auto max-w-6xl px-6 pb-10 text-xs uppercase tracking-[0.2em] text-ink-dim md:px-10">
          © {new Date().getFullYear()} {site.name}.
        </div>
      </footer>
    </main>
  );
}
