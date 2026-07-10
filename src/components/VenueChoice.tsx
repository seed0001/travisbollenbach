"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { venue } from "@/lib/content";

// The landing you hit after stepping into The Colossus on the street: two
// doors — the Game Arena and the Concert Hall.
export default function VenueChoice() {
  return (
    <main className="relative min-h-svh overflow-hidden bg-[#05070d] text-white">
      {/* soft house glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(102,224,255,0.10), transparent 70%), radial-gradient(60% 60% at 50% 100%, rgba(139,92,246,0.12), transparent 70%)",
        }}
      />

      <section className="relative mx-auto flex min-h-svh w-full max-w-6xl flex-col justify-center gap-10 px-5 py-12 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.34em] text-white/50">
            {venue.eyebrow}
          </p>
          <h1 className="mt-4 text-5xl font-black uppercase tracking-tight text-white sm:text-7xl">
            {venue.name}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-white/64">
            {venue.intro}
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2">
          {venue.doors.map((door, index) => (
            <motion.div
              key={door.key}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.12 + index * 0.09,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Link
                href={door.href}
                className="group flex min-h-[22rem] flex-col justify-between rounded-xl border p-6 transition duration-300 hover:-translate-y-1 focus:outline-none focus:ring-4 sm:min-h-[26rem]"
                style={{
                  borderColor: `${door.accent}44`,
                  background: `linear-gradient(180deg, ${door.accent}0f, rgba(8,11,20,0.6))`,
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <p
                    className="text-xs font-bold uppercase tracking-[0.22em]"
                    style={{ color: door.accent }}
                  >
                    {door.eyebrow}
                  </p>
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/38">
                    0{index + 1}
                  </span>
                </div>

                <div>
                  <h2 className="text-4xl font-black tracking-tight text-white">
                    {door.title}
                  </h2>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-white/64">
                    {door.description}
                  </p>
                  <p
                    className="mt-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] transition-colors"
                    style={{ color: door.accent }}
                  >
                    Enter
                    <span className="transition-transform duration-300 group-hover:translate-x-1">
                      →
                    </span>
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <Link
            href="/rabbit-hole/game"
            className="text-xs uppercase tracking-[0.22em] text-white/45 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            back to the street
          </Link>
        </div>
      </section>
    </main>
  );
}
