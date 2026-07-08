"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { workshop } from "@/lib/content";
import { PERSONA_LIMITS, type PersonaMode } from "@/lib/persona";

type ChatTurn = { role: "user" | "assistant"; content: string };

export default function Workshop({ configured }: { configured: boolean }) {
  const [mode, setMode] = useState<PersonaMode>("character");
  const [name, setName] = useState("");
  const [statement, setStatement] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const modeCopy = workshop.modes[mode];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, sending]);

  const loadStarter = () => {
    setStatement(modeCopy.starter);
    if (!name.trim()) {
      // Pull a suggested name out of the starter's opening ("You are X,")
      const match = modeCopy.starter.match(/^You are ([^,.]+)/);
      if (match) setName(match[1].trim());
    }
  };

  const resetChat = () => {
    setTurns([]);
    setError("");
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    if (!statement.trim()) {
      setError(workshop.chat.needStatement);
      return;
    }

    const history = [...turns, { role: "user" as const, content: text }];
    setTurns(history);
    setInput("");
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/workshop/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          name,
          statement,
          messages: history.slice(-PERSONA_LIMITS.history),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Something went wrong.",
        );
      }
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: String(data.reply ?? "") },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  const cardBase =
    "rounded-lg border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md";

  return (
    <div className="relative z-10 mx-auto max-w-5xl px-6 pb-28">
      <header className="flex items-center justify-between py-6">
        <Link
          href="/"
          className="text-sm font-bold tracking-tight text-ink transition-colors hover:text-[#b8c9ff]"
        >
          Travis<span className="text-[#8fb3ff]">.</span>Bollenbach
        </Link>
        <Link
          href="/rabbit-hole/game"
          className="text-xs uppercase tracking-[0.22em] text-ink-dim transition-colors hover:text-[#b8c9ff]"
        >
          ← back to the construct
        </Link>
      </header>

      <section className="pb-10 pt-12 md:pt-16">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-[#8fb3ff]">
          {workshop.eyebrow}
        </p>
        <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-white md:text-5xl">
          {workshop.title}
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-soft">
          {workshop.intro}
        </p>
      </section>

      {/* The lesson: character vs. tool */}
      <section className="py-6">
        <h2 className="text-2xl font-black tracking-tight text-white">
          {workshop.difference.title}
        </h2>
        <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
          {workshop.difference.blurb}
        </p>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {(["character", "tool"] as const).map((key) => {
            const copy = workshop.difference[key];
            const active = mode === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`${cardBase} group text-left transition-all ${
                  active
                    ? "border-[#8fb3ff]/60 bg-[#121826]/72 shadow-[0_0_44px_rgba(143,179,255,0.12)]"
                    : "hover:border-white/25"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-black tracking-tight text-[#dbe5ff]">
                    {copy.label}
                  </p>
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                      active
                        ? "border-[#8fb3ff]/60 text-[#8fb3ff]"
                        : "border-white/15 text-ink-dim"
                    }`}
                  >
                    {active ? "building this" : "choose"}
                  </span>
                </div>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-ink-dim">
                  {copy.answers}
                </p>
                <p className="mt-4 text-sm font-semibold text-[#b8c9ff]">
                  {copy.tagline}
                </p>
                <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink-soft">
                  {copy.points.map((point) => (
                    <li key={point} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[#8fb3ff]/70" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </section>

      {/* Builder */}
      <section className={`${cardBase} mt-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-ink-dim">
            {workshop.builder.modeLabel}
          </p>
          <button
            type="button"
            onClick={loadStarter}
            className="rounded-md border border-white/18 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:border-[#8fb3ff]/60 hover:text-[#8fb3ff]"
          >
            {workshop.builder.starterLabel}
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
          <label className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-ink-dim">
              {workshop.builder.nameLabel}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={PERSONA_LIMITS.name}
              placeholder={modeCopy.namePlaceholder}
              className="rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-[#dbe5ff] outline-none focus:border-[#8fb3ff]/60"
            />
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-ink-dim">
              Kind
            </span>
            <div className="flex h-full items-center rounded-md border border-white/10 bg-black/25 px-3 text-sm text-ink-soft">
              {modeCopy.name}
            </div>
          </div>
        </div>

        <label className="mt-4 flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-[0.25em] text-ink-dim">
            {workshop.builder.statementLabel}
          </span>
          <textarea
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            maxLength={PERSONA_LIMITS.statement}
            rows={7}
            placeholder={modeCopy.placeholder}
            className="resize-y rounded-md border border-white/15 bg-black/40 px-3 py-3 text-sm leading-relaxed text-[#dbe5ff] outline-none focus:border-[#8fb3ff]/60"
          />
          <span className="text-right text-[10px] tabular-nums text-ink-dim">
            {statement.length} / {PERSONA_LIMITS.statement}
          </span>
        </label>
        <p className="mt-1 text-xs leading-relaxed text-ink-dim">
          {modeCopy.helper}
        </p>
      </section>

      {/* Chat */}
      <section className={`${cardBase} mt-6`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black tracking-tight text-[#dbe5ff]">
            {workshop.chat.title}
          </h2>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={resetChat}
              className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-dim transition-colors hover:text-pill-red"
            >
              {workshop.chat.reset}
            </button>
          )}
        </div>

        {!configured && (
          <p className="mt-4 rounded-md border border-[#f43f5e]/30 bg-[#f43f5e]/10 px-4 py-3 text-sm text-[#ffb9c4]">
            {workshop.chat.notConfigured}
          </p>
        )}

        <div
          ref={scrollRef}
          className="mt-4 flex max-h-[22rem] min-h-[8rem] flex-col gap-3 overflow-y-auto pr-1"
        >
          {turns.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-dim">
              {statement.trim()
                ? mode === "character"
                  ? workshop.chat.emptyCharacter
                  : workshop.chat.emptyTool
                : workshop.chat.needStatement}
            </p>
          )}
          {turns.map((turn, i) => (
            <div
              key={i}
              className={
                turn.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                  turn.role === "user"
                    ? "bg-[#8fb3ff]/15 text-[#dbe5ff]"
                    : "border border-white/10 bg-black/40 text-ink-soft"
                }`}
              >
                {turn.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-ink-dim">
                <span className="type-cursor">▊</span>
              </div>
            </div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-pill-red">{error}</p>}

        <form onSubmit={send} className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={PERSONA_LIMITS.message}
            placeholder={workshop.chat.placeholder}
            disabled={!configured}
            className="flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-[#dbe5ff] outline-none focus:border-[#8fb3ff]/60 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={sending || !configured}
            className="rounded-md border border-[#8fb3ff]/60 bg-[#121826]/72 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020] disabled:opacity-50"
          >
            {sending ? "…" : "send"}
          </button>
        </form>
      </section>
    </div>
  );
}
