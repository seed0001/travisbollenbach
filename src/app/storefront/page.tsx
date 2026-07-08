import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { about, products, services, site, stats } from "@/lib/content";
import portrait from "../../../public/travis-and-dog.jpg";

export const metadata: Metadata = {
  title: "Portfolio - Travis Bollenbach",
  description:
    "A professional portfolio of software, product, design, and launch work by Travis Bollenbach.",
};

export default function Storefront() {
  return (
    <main className="relative min-h-svh bg-[#f7f8fb] text-slate-950">
      {/* ambient blue glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[42rem] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-sky-400/5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-28">
        {/* Header */}
        <header className="flex items-center justify-between py-6">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-slate-950 transition-colors hover:text-sky-700"
          >
            Travis<span className="text-sky-400">.</span>Bollenbach
          </Link>
          <Link
            href="/rabbit-hole"
            className="text-xs uppercase tracking-[0.22em] text-slate-500 transition-colors hover:text-slate-950"
          >
            immersive environment
          </Link>
        </header>

        {/* Hero */}
        <section className="pb-20 pt-16 md:pt-24">
          <Reveal>
            <p className="mb-4 text-xs uppercase tracking-[0.35em] text-sky-400">
              professional portfolio
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Software, systems, and launch-ready product work.
              <span className="block text-sky-700">
                Structured for people who need the facts.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl leading-relaxed text-slate-600">
              Tools, applications, and software for businesses that need things
              to actually work. Clear scope, polished interface, practical
              execution.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <dl className="mt-14 grid grid-cols-2 gap-6 md:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <dd className="text-3xl font-bold text-sky-700">
                    {stat.value}
                  </dd>
                  <dt className="mt-1 text-xs uppercase tracking-wider text-slate-500">
                    {stat.label}
                  </dt>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>

        {/* Products */}
        <section id="products" className="py-16">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Tools &amp; applications
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              A cross-section of what&apos;s on the shelf — software, systems,
              and launch-ready assets for real-world businesses.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {products.map((product, i) => (
              <Reveal key={product.title} delay={i * 0.08}>
                <article className="group flex h-full flex-col rounded-lg border border-slate-200 bg-white p-8 shadow-sm transition-colors hover:border-sky-300">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md border border-sky-200 bg-sky-50 px-3 py-1 text-xs uppercase tracking-wide text-sky-700">
                      {product.category}
                    </span>
                    <span
                      className={`text-xs uppercase tracking-wider ${
                        product.status === "Available"
                          ? "text-emerald-700"
                          : product.status === "In development"
                            ? "text-amber-700"
                            : "text-slate-500"
                      }`}
                    >
                      ● {product.status}
                    </span>
                  </div>

                  <h3 className="mt-6 text-2xl font-bold transition-colors group-hover:text-sky-700">
                    {product.title}
                  </h3>
                  <p className="mt-3 flex-1 leading-relaxed text-slate-600">
                    {product.description}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {product.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Services */}
        <section id="services" className="py-16">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Work with me
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              Bring me in for the whole thing or just the part you need.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {services.map((service, i) => (
              <Reveal key={service.title} delay={i * 0.1}>
                <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-8 shadow-sm transition-colors hover:border-sky-300">
                  <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-lg bg-sky-100 text-lg font-bold text-sky-700">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="text-xl font-bold">{service.title}</h3>
                  <p className="mt-3 flex-1 leading-relaxed text-slate-600">
                    {service.description}
                  </p>
                  <ul className="mt-6 space-y-2 border-t border-slate-200 pt-6">
                    {service.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-center gap-3 text-sm text-slate-600"
                      >
                        <span className="text-sky-700">-</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* About */}
        <section id="about" className="py-16">
          <Reveal>
            <div className="grid items-center gap-10 rounded-lg border border-slate-200 bg-white p-8 shadow-sm md:grid-cols-[minmax(0,340px)_1fr] md:p-12">
              <div className="relative mx-auto w-full max-w-[340px] overflow-hidden rounded-lg border border-slate-200">
                <Image
                  src={portrait}
                  alt={about.photoAlt}
                  placeholder="blur"
                  sizes="(min-width: 768px) 340px, 90vw"
                  className="h-auto w-full"
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-sky-400">
                  {about.storefront.eyebrow}
                </p>
                <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
                  {about.storefront.title}
                </h2>
                <div className="mt-5 space-y-4 leading-relaxed text-slate-600">
                  {about.storefront.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Contact CTA */}
        <section id="contact" className="pt-16">
          <Reveal>
            <div className="rounded-lg border border-sky-200 bg-white p-10 text-center shadow-sm md:p-16">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Need something built?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-slate-600">
                {site.tagline} Tell me what your business needs and let&apos;s
                make it real.
              </p>
              <a
                href={`mailto:${site.email}`}
                className="mt-8 inline-block rounded-md bg-sky-700 px-8 py-3 font-bold text-white transition-all hover:bg-sky-600"
              >
                {site.email}
              </a>
            </div>
          </Reveal>
        </section>

        <footer className="mt-20 flex flex-col items-center gap-2 border-t border-slate-200 pt-8 text-center text-xs text-slate-500">
          <p>
            (c) {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <Link
            href="/"
            className="uppercase tracking-[0.22em] transition-colors hover:text-slate-950"
          >
            back to the choice
          </Link>
        </footer>
      </div>
    </main>
  );
}
