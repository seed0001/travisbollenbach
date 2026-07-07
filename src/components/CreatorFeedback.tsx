"use client";

import { FormEvent, useEffect, useState } from "react";

// Topic-scoped feedback board for creator profile pages. Same API as the
// guestbook, different room — every creator gets their own thread.

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

export default function CreatorFeedback({
  topic,
  creatorName,
}: {
  topic: string;
  creatorName: string;
}) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/comments?topic=${encodeURIComponent(topic)}`)
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
  }, [topic]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message, topic, website: honeypot }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Send failed.",
        );
      }
      setComments((current) => [data, ...(current ?? [])]);
      setMessage("");
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Send failed. Try again.");
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
      <h2 className="text-lg font-semibold text-white/90">
        Notes for {creatorName}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-white/50">
        Seen their work in the world? Leave a word here — praise, questions,
        what it made you feel. This board belongs to them.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
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
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            required
            maxLength={40}
            placeholder="your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/50 focus:outline-none sm:max-w-[200px]"
          />
          <input
            type="text"
            required
            maxLength={500}
            placeholder="your note…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full flex-1 rounded-lg border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/50 focus:outline-none"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="rounded-lg border border-white/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white/90 transition-colors hover:bg-white hover:text-black disabled:opacity-50"
          >
            {status === "sending" ? "sending…" : "send"}
          </button>
        </div>
        {status === "error" && <p className="text-sm text-red-400">{error}</p>}
      </form>

      <div className="mt-8 space-y-4 border-t border-white/10 pt-6">
        {comments === null && (
          <p className="animate-pulse text-sm text-white/40">loading…</p>
        )}
        {comments?.length === 0 && (
          <p className="text-sm text-white/40">
            No notes yet. Be the first to say thanks.
          </p>
        )}
        {comments?.map((comment) => (
          <div key={comment.id} className="text-sm leading-relaxed">
            <p className="font-semibold text-white/85">
              {comment.name}
              <span className="ml-3 text-xs font-normal text-white/35">
                {dateFormat.format(new Date(comment.createdAt))}
              </span>
            </p>
            <p className="mt-1 whitespace-pre-wrap text-white/60">
              {comment.message}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
