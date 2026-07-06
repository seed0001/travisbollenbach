"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { roles, site } from "@/lib/content";

export default function Hero() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % roles.length);
    }, 2200);
    return () => clearInterval(id);
  }, [reduce]);

  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.12, delayChildren: 0.1 },
    },
  };
  const item = {
    hidden: { opacity: 0, y: reduce ? 0 : 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] items-center overflow-hidden px-6 pt-24"
    >
      {/* Animated aurora blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          aria-hidden
          className="absolute left-[8%] top-[18%] h-72 w-72 rounded-full bg-accent/25 blur-[100px]"
          animate={reduce ? {} : { x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute right-[10%] top-[30%] h-80 w-80 rounded-full bg-accent-3/25 blur-[110px]"
          animate={reduce ? {} : { x: [0, -50, 0], y: [0, 40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute bottom-[12%] left-[40%] h-64 w-64 rounded-full bg-accent-2/20 blur-[100px]"
          animate={reduce ? {} : { x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto w-full max-w-6xl"
      >
        <motion.p
          variants={item}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-4 py-1.5 text-sm text-ink-soft backdrop-blur"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          Available for new work · {site.domain}
        </motion.p>

        <motion.h1
          variants={item}
          className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-ink sm:text-7xl lg:text-8xl"
        >
          I build{" "}
          <span className="relative inline-block align-baseline">
            <motion.span
              key={index}
              className="text-gradient"
              initial={reduce ? {} : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? {} : { opacity: 0, y: -18 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {roles[index]}
            </motion.span>
          </span>
          <br />
          worth remembering.
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-8 max-w-xl text-lg text-ink-soft"
        >
          {site.intro}
        </motion.p>

        <motion.div
          variants={item}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <a
            href="#work"
            className="group inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-bg shadow-glow transition-transform hover:scale-[1.03]"
          >
            See my work
            <span className="transition-transform group-hover:translate-x-1">
              →
            </span>
          </a>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/40 px-6 py-3 font-semibold text-ink backdrop-blur transition-colors hover:border-ink-dim"
          >
            Work with me
          </a>
        </motion.div>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        aria-hidden
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-ink-dim"
        animate={reduce ? {} : { y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex h-10 w-6 items-start justify-center rounded-full border border-line p-1.5">
          <div className="h-2 w-1 rounded-full bg-ink-dim" />
        </div>
      </motion.div>
    </section>
  );
}
