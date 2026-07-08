"use client";

import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type Comment = {
  id: string;
  name: string;
  message: string;
  createdAt: string;
};

const TOPIC = "coming-soon";
const sparkleWords = ["open", "build", "dream", "launch", "play", "create"];

function seededBetween(seed: number, min: number, max: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return min + (value - Math.floor(value)) * (max - min);
}

export default function ComingSoonPage() {
  const particles = useMemo(
    () =>
      Array.from({ length: 54 }, (_, index) => ({
        id: index,
        left: seededBetween(index + 1, 2, 98),
        top: seededBetween(index + 101, 4, 96),
        size: seededBetween(index + 201, 4, 13),
        delay: seededBetween(index + 301, -14, 0),
        duration: seededBetween(index + 401, 9, 22),
      })),
    [],
  );
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [burst, setBurst] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/comments?topic=${TOPIC}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setComments(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          message,
          website: honeypot,
          topic: TOPIC,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Message failed.",
        );
      }
      setComments((current) => [data, ...(current ?? [])]);
      setMessage("");
      setStatus("idle");
      setBurst((value) => value + 1);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Message failed.");
    }
  };

  return (
    <main className="coming-soon relative min-h-svh overflow-hidden bg-[#11121a] px-5 py-8 text-white sm:px-8">
      <div className="absolute inset-0">
        <div className="coming-gradient absolute inset-0" />
        <button
          type="button"
          aria-label="Create a burst"
          onClick={() => setBurst((value) => value + 1)}
          className="coming-orb absolute left-[9%] top-[18%] h-32 w-32 rounded-full bg-cyan-300/30 blur-sm transition-transform hover:scale-110"
        />
        <button
          type="button"
          aria-label="Create a burst"
          onClick={() => setBurst((value) => value + 1)}
          className="coming-orb coming-orb-two absolute bottom-[14%] right-[12%] h-44 w-44 rounded-full bg-fuchsia-300/25 blur-sm transition-transform hover:scale-110"
        />
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="coming-particle absolute rounded-full"
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
            }}
          />
        ))}
        {Array.from({ length: 18 }, (_, index) => (
          <span
            key={`${burst}-${index}`}
            className="coming-spark absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
            style={
              {
                "--spark-x": `${Math.cos((index / 18) * Math.PI * 2) * seededBetween(burst * 100 + index + 1, 90, 260)}px`,
                "--spark-y": `${Math.sin((index / 18) * Math.PI * 2) * seededBetween(burst * 100 + index + 51, 90, 260)}px`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4 py-4">
          <p className="text-sm font-bold tracking-wide text-white/90">
            Travis Bollenbach
          </p>
          <button
            type="button"
            onClick={() => setBurst((value) => value + 1)}
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/80 backdrop-blur transition hover:border-white/50 hover:bg-white/15"
          >
            make it pop
          </button>
        </header>

        <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-6 flex flex-wrap gap-2">
              {sparkleWords.map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => setBurst((value) => value + 1)}
                  className="rounded-full border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/70 backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-200/60 hover:text-white"
                >
                  {word}
                </button>
              ))}
            </div>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-white sm:text-7xl lg:text-8xl">
              Webpage is currently under construction, features to come.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/64 sm:text-lg">
              The next version is being rebuilt into something more immersive.
              While it is coming together, drop a note, a question, or an idea
              for what you would like to see here.
            </p>
          </div>

          <section className="rounded-[2rem] border border-white/16 bg-white/[0.08] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-100/80">
              message portal
            </p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              Leave something for the build.
            </h2>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(event) => setHoneypot(event.target.value)}
                className="hidden"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
              <input
                type="text"
                required
                maxLength={40}
                placeholder="your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-white/14 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/38 focus:border-cyan-200/70"
              />
              <textarea
                required
                maxLength={500}
                rows={5}
                placeholder="ideas, questions, requests, weird sparks..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="w-full resize-none rounded-2xl border border-white/14 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/38 focus:border-cyan-200/70"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-[#11121a] transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-300/20 disabled:opacity-50"
              >
                {status === "sending" ? "sending..." : "send message"}
              </button>
              {status === "error" && (
                <p className="text-sm text-rose-200">{error}</p>
              )}
            </form>

            <div className="mt-7 max-h-72 space-y-3 overflow-y-auto border-t border-white/12 pt-5">
              {comments === null && (
                <p className="animate-pulse text-sm text-white/45">
                  loading messages...
                </p>
              )}
              {comments?.length === 0 && (
                <p className="text-sm text-white/45">
                  No messages yet. Be first.
                </p>
              )}
              {comments?.slice(0, 8).map((comment) => (
                <article
                  key={comment.id}
                  className="rounded-2xl border border-white/10 bg-black/18 p-4"
                >
                  <p className="text-sm font-bold text-cyan-100">
                    {comment.name}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/68">
                    {comment.message}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
