"use client";

import { FormEvent, useEffect, useState } from "react";
import { guestbook } from "@/lib/content";

type Comment = {
  id: string;
  name: string;
  message: string;
  createdAt: string;
};

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default function Guestbook() {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/comments")
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
        body: JSON.stringify({ name, message, website: honeypot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Transmission failed.",
        );
      }
      setComments((current) => [data, ...(current ?? [])]);
      setMessage("");
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Transmission failed. Try again.",
      );
    }
  };

  return (
    <div className="rounded-3xl border border-line bg-surface/70 p-8 backdrop-blur-sm md:p-10">
      <p className="text-xs uppercase tracking-[0.35em] text-ink-dim">
        {guestbook.eyebrow}
      </p>
      <h2 className="glow-green mt-3 text-2xl font-bold tracking-tight text-matrix md:text-3xl">
        {guestbook.title}
      </h2>
      <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
        {guestbook.description}
      </p>

      <form onSubmit={submit} className="mt-8 space-y-4">
        {/* honeypot — hidden from humans, tempting to bots */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-4 sm:flex-row">
          <input
            type="text"
            required
            maxLength={40}
            placeholder="your handle"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-line bg-black/60 px-4 py-3 text-sm text-ink placeholder:text-ink-dim focus:border-matrix focus:outline-none sm:max-w-[220px]"
          />
          <input
            type="text"
            required
            maxLength={500}
            placeholder="your transmission…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full flex-1 rounded-xl border border-line bg-black/60 px-4 py-3 text-sm text-ink placeholder:text-ink-dim focus:border-matrix focus:outline-none"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-xl border border-matrix px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black disabled:opacity-50"
          >
            {status === "sending" ? "sending…" : "send"}
          </button>
        </div>
        {status === "error" && (
          <p className="text-sm text-pill-red">{error}</p>
        )}
      </form>

      <div className="mt-10 space-y-5 border-t border-line pt-8">
        {comments === null && (
          <p className="animate-pulse text-sm text-ink-dim">
            opening channel…
          </p>
        )}
        {comments?.length === 0 && (
          <p className="text-sm text-ink-dim">{guestbook.emptyState}</p>
        )}
        {comments?.map((comment) => (
          <div key={comment.id} className="text-sm leading-relaxed">
            <p className="font-bold text-matrix">
              {"> "}
              {comment.name}
              <span className="ml-3 text-xs font-normal text-ink-dim">
                {dateFormat.format(new Date(comment.createdAt))}
              </span>
            </p>
            <p className="mt-1 whitespace-pre-wrap text-ink-soft">
              {comment.message}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
