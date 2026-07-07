"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { choice, site } from "@/lib/content";
import MatrixRain from "./MatrixRain";

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
    <p className="glow-green min-h-[1.5em] text-sm text-matrix sm:text-base md:text-lg">
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
    <div className="scanlines relative min-h-svh overflow-hidden">
      <MatrixRain />

      <div className="relative z-10 mx-auto flex min-h-svh max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <p className="flicker mb-10 text-xs uppercase tracking-[0.4em] text-ink-dim">
          {`${site.name} // incoming transmission`}
        </p>

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
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="mt-14 flex w-full flex-col items-center"
            >
              <p className="glow-green mb-10 text-2xl font-bold tracking-widest text-matrix md:text-3xl">
                {choice.prompt}
              </p>

              <div className="flex w-full flex-col items-stretch justify-center gap-8 sm:flex-row sm:gap-14">
                <button
                  type="button"
                  onClick={() => pick("blue")}
                  className="pill-btn group flex flex-1 flex-col items-center gap-5 rounded-2xl border border-transparent p-6 outline-none transition-colors hover:border-pill-blue/30 focus-visible:border-pill-blue/60 sm:max-w-xs"
                >
                  <span className="pill pill-blue" />
                  <span className="glow-blue text-lg font-bold tracking-widest text-pill-blue">
                    {choice.blue.label}
                  </span>
                  <span className="text-xs leading-relaxed text-ink-soft">
                    {choice.blue.hint}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => pick("red")}
                  className="pill-btn group flex flex-1 flex-col items-center gap-5 rounded-2xl border border-transparent p-6 outline-none transition-colors hover:border-pill-red/30 focus-visible:border-pill-red/60 sm:max-w-xs"
                >
                  <span className="pill pill-red" />
                  <span className="glow-red text-lg font-bold tracking-widest text-pill-red">
                    {choice.red.label}
                  </span>
                  <span className="text-xs leading-relaxed text-ink-soft">
                    {choice.red.hint}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setLine(monologue.length)}
                className="sr-only"
              >
                Skip intro
              </button>
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
