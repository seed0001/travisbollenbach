"use client";

import { FormEvent, useEffect, useState } from "react";

// Operator panel for integration credentials. Secrets are write-only: the
// server returns set/unset + a last-4 preview, and inputs left blank are
// left unchanged on save.

type FieldView =
  | { secret: true; set: boolean; preview: string }
  | { secret: false; value: string };

type Fields = Record<string, FieldView>;

const SECTIONS: {
  title: string;
  description: string;
  fields: { key: string; label: string; placeholder: string; hint?: string }[];
}[] = [
  {
    title: "the mind — openrouter",
    description:
      "Powers every AI feature on the site, starting with the character chamber. Any model on OpenRouter works.",
    fields: [
      {
        key: "openrouterApiKey",
        label: "openrouter api key",
        placeholder: "paste a new key to replace",
      },
      {
        key: "openrouterModel",
        label: "model",
        placeholder: "openrouter/auto",
        hint: "any OpenRouter model id — e.g. openrouter/auto or a specific vendor/model",
      },
    ],
  },
  {
    title: "discord",
    description:
      "Credentials for the Discord integration. Stored here, wired up as the bot comes online.",
    fields: [
      {
        key: "discordBotToken",
        label: "bot token",
        placeholder: "paste a new token to replace",
      },
      {
        key: "discordClientId",
        label: "application client id",
        placeholder: "e.g. 1234567890",
      },
      {
        key: "discordClientSecret",
        label: "client secret",
        placeholder: "paste a new secret to replace",
      },
    ],
  },
];

const inputClass =
  "w-full rounded-xl border border-line bg-black/60 px-4 py-3 text-sm text-ink placeholder:text-ink-dim focus:border-matrix focus:outline-none";

export default function AdminSettings() {
  const [fields, setFields] = useState<Fields | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (cancelled) return;
        setFields(data.fields);
        seedDrafts(data.fields, setDrafts);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load settings.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!fields || status === "saving") return;
    setStatus("saving");
    setError("");

    // send secrets only when a new value was typed; plain fields when changed
    const patch: Record<string, string> = {};
    for (const [key, view] of Object.entries(fields)) {
      const draft = drafts[key] ?? "";
      if (view.secret) {
        if (draft.trim()) patch[key] = draft.trim();
      } else if (draft !== view.value) {
        patch[key] = draft;
      }
    }
    if (Object.keys(patch).length === 0) {
      setStatus("idle");
      return;
    }

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Save failed.",
        );
      }
      setFields(data.fields);
      seedDrafts(data.fields, setDrafts);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  };

  const clearSecret = async (key: string) => {
    if (status === "saving") return;
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("Clear failed.");
      setFields(data.fields);
      seedDrafts(data.fields, setDrafts);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Clear failed.");
    }
  };

  if (error && !fields) {
    return <p className="text-sm text-pill-red">{error}</p>;
  }
  if (!fields) {
    return <p className="animate-pulse text-sm text-ink-dim">decrypting…</p>;
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {SECTIONS.map((section) => (
        <div
          key={section.title}
          className="rounded-3xl border border-line bg-surface/70 p-8"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
            {section.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {section.description}
          </p>
          <div className="mt-6 space-y-5">
            {section.fields.map(({ key, label, placeholder, hint }) => {
              const view = fields[key];
              if (!view) return null;
              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between gap-4">
                    <label
                      htmlFor={key}
                      className="text-xs uppercase tracking-[0.25em] text-ink-dim"
                    >
                      {label}
                    </label>
                    {view.secret && (
                      <span
                        className={`text-xs ${view.set ? "text-matrix" : "text-ink-dim"}`}
                      >
                        {view.set ? `set · ends ${view.preview}` : "not set"}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      id={key}
                      type={view.secret ? "password" : "text"}
                      value={drafts[key] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [key]: e.target.value }))
                      }
                      placeholder={placeholder}
                      autoComplete="off"
                      className={inputClass}
                    />
                    {view.secret && view.set && (
                      <button
                        type="button"
                        onClick={() => clearSecret(key)}
                        className="shrink-0 rounded-xl border border-line px-4 text-xs uppercase tracking-[0.2em] text-ink-dim transition-colors hover:border-pill-red hover:text-pill-red"
                      >
                        clear
                      </button>
                    )}
                  </div>
                  {hint && (
                    <p className="mt-1 text-xs leading-relaxed text-ink-dim">
                      {hint}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-xl border border-matrix px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black disabled:opacity-50"
        >
          {status === "saving" ? "writing…" : "save changes"}
        </button>
        {status === "saved" && (
          <span className="glow-green text-xs uppercase tracking-[0.2em] text-matrix">
            written to the construct
          </span>
        )}
        {status === "error" && (
          <span className="text-xs text-pill-red">{error}</span>
        )}
      </div>
    </form>
  );
}

function seedDrafts(
  fields: Fields,
  setDrafts: (drafts: Record<string, string>) => void,
) {
  const next: Record<string, string> = {};
  for (const [key, view] of Object.entries(fields)) {
    next[key] = view.secret ? "" : view.value;
  }
  setDrafts(next);
}
