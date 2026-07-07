"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: string;
};

type Mode = "login" | "signup";

const inputClass =
  "w-full rounded-xl border border-line bg-black/60 px-4 py-3 text-sm text-ink placeholder:text-ink-dim focus:border-matrix focus:outline-none";

export default function AccountPanel() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (!cancelled) setUser(data.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
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
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup"
            ? { email, password, name, website: honeypot }
            : { email, password },
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Access denied.",
        );
      }
      setUser(data);
      setPassword("");
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Access denied.");
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  };

  if (user === undefined) {
    return (
      <p className="animate-pulse text-sm text-ink-dim">
        checking credentials…
      </p>
    );
  }

  if (user) {
    return (
      <div className="rounded-3xl border border-line bg-surface/70 p-8 backdrop-blur-sm md:p-10">
        <p className="text-xs uppercase tracking-[0.35em] text-ink-dim">
          identity confirmed
        </p>
        <h2 className="glow-green mt-3 text-2xl font-bold tracking-tight text-matrix md:text-3xl">
          {user.name}
        </h2>
        <p className="mt-2 text-sm text-ink-soft">{user.email}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.25em] text-ink-dim">
          clearance: {user.role}
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/rabbit-hole/character-creation"
            className="rounded-xl border border-matrix px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
          >
            character workshop →
          </Link>
          {user.role === "admin" && (
            <Link
              href="/admin"
              className="rounded-xl border border-matrix px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
            >
              operator console →
            </Link>
          )}
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-line px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-ink-dim transition-colors hover:border-pill-red hover:text-pill-red"
          >
            unplug
          </button>
        </div>

        <p className="mt-8 text-sm leading-relaxed text-ink-dim">
          Level 01 — the character workshop — is open now. More member
          services unlock as levels come online.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line bg-surface/70 p-8 backdrop-blur-sm md:p-10">
      <div className="flex gap-6 text-xs font-bold uppercase tracking-[0.25em]">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError("");
              setStatus("idle");
            }}
            className={
              mode === m
                ? "glow-green border-b border-matrix pb-1 text-matrix"
                : "pb-1 text-ink-dim transition-colors hover:text-ink-soft"
            }
          >
            {m === "login" ? "log in" : "sign up"}
          </button>
        ))}
      </div>

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
        {mode === "signup" && (
          <input
            type="text"
            maxLength={40}
            placeholder="your handle (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        )}
        <input
          type="email"
          required
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className={inputClass}
        />
        <input
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          placeholder={mode === "signup" ? "password (8+ characters)" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="w-full rounded-xl border border-matrix px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black disabled:opacity-50"
        >
          {status === "sending"
            ? "authenticating…"
            : mode === "login"
              ? "jack in"
              : "create account"}
        </button>
        {status === "error" && <p className="text-sm text-pill-red">{error}</p>}
      </form>
    </div>
  );
}
