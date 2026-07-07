"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { choice, site } from "@/lib/content";
import MatrixRain from "./MatrixRain";
import Pill3D from "./Pill3D";

type Pick = "red" | "blue" | null;

/** Types out one line of the monologue, then signals completion. */
function TypedLine({
  text,
  onDone,
  active,
}: {
  text: string;
  onDone: () => void;
  active: boolean;
}) {
  const [count, setCount] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    if (count >= text.length) {
      if (!doneRef.current) {
        doneRef.current = true;
        const pause = setTimeout(onDone, 550);
        return () => clearTimeout(pause);
      }
      return;
    }
    const id = setTimeout(() => setCount((c) => c + 1), 34);
    return () => clearTimeout(id);
  }, [active, count, text, onDone]);

  if (!active && count === 0) return null;

  return (
    <p className="terminal-text min-h-[1.5em] text-base font-bold text-[#dcffe9] sm:text-lg md:text-xl">
      {text.slice(0, count)}
      {count < text.length && <span className="type-cursor">█</span>}
    </p>
  );
}

export default function ChoiceScreen() {
  const router = useRouter();
  const [line, setLine] = useState(0);
  const [picked, setPicked] = useState<Pick>(null);
  const monologue = useMemo(() => choice.monologue, []);
  const monologueDone = line >= monologue.length;

  // Preload both destinations the moment the pills appear
  useEffect(() => {
    if (monologueDone) {
      router.prefetch(choice.blue.href);
      router.prefetch(choice.red.href);
    }
  }, [monologueDone, router]);

  const pick = (which: Exclude<Pick, null>) => {
    if (picked) return;
    setPicked(which);
    const href = which === "blue" ? choice.blue.href : choice.red.href;
    setTimeout(() => router.push(href), 850);
  };

  return (
    <div className="scanlines relative min-h-svh">
      <MatrixRain />
      <div className="choice-vignette pointer-events-none fixed inset-0 z-[1]" />

      {/* account entrance — always reachable, even mid-monologue */}
      <Link
        href="/account"
        className="fixed right-5 top-5 z-20 rounded-full border border-line bg-black/50 px-5 py-2 text-[11px] uppercase tracking-[0.25em] text-ink-dim backdrop-blur-sm transition-colors hover:border-matrix hover:text-matrix"
      >
        log in / sign up
      </Link>

      <div className="relative z-10 mx-auto flex min-h-svh max-w-4xl flex-col items-center justify-center px-6 py-10 text-center sm:py-16">
        {/* Hero title */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 sm:mb-12"
        >
          <h1
            data-text={site.name.toUpperCase()}
            className="glitch-title glow-green text-3xl font-bold tracking-[0.14em] text-white sm:text-4xl md:text-6xl"
          >
            {site.name.toUpperCase()}
          </h1>
          <p className="flicker mt-4 text-[11px] uppercase tracking-[0.5em] text-matrix">
            {"// incoming transmission //"}
          </p>
        </motion.div>

        <div className="w-full space-y-3 text-left sm:text-center">
          {monologue.map((text, i) => (
            <TypedLine
              key={text}
              text={text}
              active={line >= i}
              onDone={() => setLine((l) => Math.max(l, i + 1))}
            />
          ))}
        </div>

        <AnimatePresence>
          {monologueDone && !picked && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="mt-8 flex w-full flex-col items-center sm:mt-12"
              style={{ perspective: 900 }}
            >
              <motion.p
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 160, damping: 14 }}
                className="choose-pulse mb-8 text-3xl font-bold tracking-[0.3em] text-matrix md:text-4xl"
              >
                {choice.prompt}
              </motion.p>

              <div className="flex w-full flex-col items-center justify-center gap-4 sm:flex-row sm:items-stretch sm:gap-10">
                <motion.div
                  initial={{ opacity: 0, y: 60, rotateX: 50 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 110,
                    damping: 13,
                    delay: 0.15,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => pick("blue")}
                    className="group flex w-full max-w-xs flex-col items-center gap-2 rounded-2xl border border-transparent p-4 outline-none transition-colors hover:border-pill-blue/30 focus-visible:border-pill-blue/60"
                  >
                    <Pill3D variant="blue" />
                    <span className="glow-blue text-lg font-bold tracking-widest text-pill-blue">
                      {choice.blue.label}
                    </span>
                    <span className="terminal-text text-xs leading-relaxed text-ink-soft">
                      {choice.blue.hint}
                    </span>
                  </button>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 60, rotateX: 50 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 110,
                    damping: 13,
                    delay: 0.3,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => pick("red")}
                    className="group flex w-full max-w-xs flex-col items-center gap-2 rounded-2xl border border-transparent p-4 outline-none transition-colors hover:border-pill-red/30 focus-visible:border-pill-red/60"
                  >
                    <Pill3D variant="red" />
                    <span className="glow-red text-lg font-bold tracking-widest text-pill-red">
                      {choice.red.label}
                    </span>
                    <span className="terminal-text text-xs leading-relaxed text-ink-soft">
                      {choice.red.hint}
                    </span>
                  </button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!monologueDone && (
          <button
            type="button"
            onClick={() => setLine(monologue.length)}
            className="mt-16 text-xs uppercase tracking-[0.3em] text-ink-dim transition-colors hover:text-ink-soft"
          >
            [ skip ]
          </button>
        )}
      </div>

      {picked && (
        <div
          className={`choice-flash ${
            picked === "red" ? "bg-pill-red" : "bg-pill-blue"
          }`}
        />
      )}
    </div>
  );
}
