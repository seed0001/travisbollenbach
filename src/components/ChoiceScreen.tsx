"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { choice, site } from "@/lib/content";
import Pill3D from "./Pill3D";
import SiteStats from "./SiteStats";

const paths = [
  {
    key: "blue",
    eyebrow: "Professional work",
    title: choice.blue.label,
    description: choice.blue.hint,
    href: choice.blue.href,
    accent: "blue",
  },
  {
    key: "red",
    eyebrow: "Interactive world",
    title: choice.red.label,
    description: choice.red.hint,
    href: choice.red.href,
    accent: "red",
  },
] as const;

export default function ChoiceScreen() {
  return (
    <main className="choice-screen min-h-svh bg-[#0c0f14] text-white">
      <section className="mx-auto grid min-h-svh w-full max-w-7xl items-center gap-10 px-5 py-8 md:grid-cols-[0.9fr_1.1fr] md:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-xl"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8fb3ff]">
            {site.domain}
          </p>
          <h1 className="mt-5 text-5xl font-black leading-[0.95] tracking-tight text-white sm:text-7xl">
            Choose the version of the work you came to see.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/68">
            One door is a structured portfolio for real-world projects. The
            other is an immersive environment for the stranger questions behind
            the work.
          </p>
          <SiteStats />
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
          {paths.map((path, index) => (
            <motion.div
              key={path.key}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.12 + index * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Link
                href={path.href}
                className={`choice-card choice-card-${path.accent} group flex min-h-[28rem] flex-col justify-between rounded-lg border p-5 transition duration-300 hover:-translate-y-1 focus:outline-none focus:ring-4`}
              >
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/46">
                      {path.eyebrow}
                    </p>
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/38">
                      0{index + 1}
                    </span>
                  </div>
                  <div className="mt-7 flex justify-center">
                    <Pill3D variant={path.key} />
                  </div>
                </div>

                <div>
                  <h2 className="text-3xl font-black tracking-tight">
                    {path.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-white/64">
                    {path.description}
                  </p>
                  <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-white/72">
                    Enter
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  );
}
