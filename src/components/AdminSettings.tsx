"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

// Integration credentials manager. Secrets are write-only: the server returns
// set/unset + a last-4 preview, and inputs left blank are left unchanged on
// save. The OpenRouter model is picked from the live model catalog.

type FieldView =
  | { secret: true; set: boolean; preview: string }
  | { secret: false; value: string };

type Fields = Record<string, FieldView>;
type ModelOption = { id: string; name: string };

const inputClass =
  "w-full rounded-lg border border-ops-line bg-white px-3.5 py-2.5 text-sm text-ops-ink placeholder:text-ops-muted/70 focus:border-ops-accent focus:outline-none focus:ring-2 focus:ring-ops-accent/15";

const labelClass = "text-[13px] font-medium text-ops-ink";

export default function AdminSettings() {
  const [fields, setFields] = useState<Fields | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelsStatus, setModelsStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [modelsError, setModelsError] = useState("");

  const loadModels = useCallback(async (refresh: boolean) => {
    setModelsStatus("loading");
    setModelsError("");
    try {
      const res = await fetch(
        `/api/admin/models${refresh ? "?refresh=1" : ""}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.models)) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Couldn't load models.",
        );
      }
      setModels(data.models);
      setModelsStatus("ready");
    } catch (err) {
      setModelsStatus("error");
      setModelsError(
        err instanceof Error ? err.message : "Couldn't load models.",
      );
    }
  }, []);

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
    // deferred so the effect body itself doesn't set state synchronously
    const kickoff = setTimeout(() => loadModels(false), 0);
    return () => {
      cancelled = true;
      clearTimeout(kickoff);
    };
  }, [loadModels]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!fields || status === "saving") return;
    setStatus("saving");
    setError("");

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
      // a fresh key may unlock account-gated models — refresh the catalog
      if (patch.openrouterApiKey) loadModels(true);
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
    return <p className="text-sm text-ops-red">{error}</p>;
  }
  if (!fields) {
    return <p className="animate-pulse text-sm text-ops-muted">loading…</p>;
  }

  const secretRow = (key: string, label: string, placeholder: string) => {
    const view = fields[key];
    if (!view || !view.secret) return null;
    return (
      <div key={key}>
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor={key} className={labelClass}>
            {label}
          </label>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              view.set
                ? "bg-ops-green-soft text-ops-green"
                : "bg-ops-bg text-ops-muted"
            }`}
          >
            {view.set ? `set · ends ${view.preview}` : "not set"}
          </span>
        </div>
        <div className="mt-1.5 flex gap-2">
          <input
            id={key}
            type="password"
            value={drafts[key] ?? ""}
            onChange={(e) =>
              setDrafts((d) => ({ ...d, [key]: e.target.value }))
            }
            placeholder={placeholder}
            autoComplete="off"
            className={inputClass}
          />
          {view.set && (
            <button
              type="button"
              onClick={() => clearSecret(key)}
              className="shrink-0 rounded-lg border border-ops-line px-3.5 text-xs font-medium text-ops-muted transition-colors hover:border-ops-red hover:text-ops-red"
            >
              clear
            </button>
          )}
        </div>
      </div>
    );
  };

  const modelView = fields.openrouterModel;
  const clientIdView = fields.discordClientId;

  return (
    <form onSubmit={save} className="space-y-5">
      {/* OpenRouter */}
      <div className="rounded-xl border border-ops-line bg-ops-card p-6 shadow-sm">
        <h3 className="text-base font-semibold">OpenRouter</h3>
        <p className="mt-1 text-sm text-ops-muted">
          Powers every AI feature on the site, starting with the character
          studio.
        </p>
        <div className="mt-5 space-y-5">
          {secretRow(
            "openrouterApiKey",
            "API key",
            "paste a new key to replace",
          )}

          {modelView && !modelView.secret && (
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <label htmlFor="openrouterModel" className={labelClass}>
                  Model
                </label>
                <span className="text-xs text-ops-muted">
                  {modelsStatus === "loading" && "loading catalog…"}
                  {modelsStatus === "ready" &&
                    `${models.length} models available`}
                  {modelsStatus === "error" && (
                    <span className="text-ops-red">{modelsError}</span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 flex gap-2">
                {modelsStatus === "ready" ? (
                  <select
                    id="openrouterModel"
                    value={
                      models.some((m) => m.id === (drafts.openrouterModel ?? ""))
                        ? drafts.openrouterModel
                        : ""
                    }
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        openrouterModel: e.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="" disabled>
                      {drafts.openrouterModel
                        ? `current: ${drafts.openrouterModel}`
                        : "select a model…"}
                    </option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                        {m.name !== m.id ? ` — ${m.name}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="openrouterModel"
                    value={drafts.openrouterModel ?? ""}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        openrouterModel: e.target.value,
                      }))
                    }
                    placeholder="openrouter/auto"
                    className={inputClass}
                  />
                )}
                <button
                  type="button"
                  onClick={() => loadModels(true)}
                  disabled={modelsStatus === "loading"}
                  className="shrink-0 rounded-lg border border-ops-line px-3.5 text-xs font-medium text-ops-muted transition-colors hover:border-ops-accent hover:text-ops-accent disabled:opacity-50"
                >
                  refresh
                </button>
              </div>
              <p className="mt-1.5 text-xs text-ops-muted">
                Saved model:{" "}
                <span className="font-medium text-ops-ink">
                  {modelView.value || "openrouter/auto"}
                </span>
                {modelsStatus === "error" &&
                  " — catalog unavailable, type a model id manually."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* The Descent */}
      <div className="rounded-xl border border-ops-line bg-ops-card p-6 shadow-sm">
        <h3 className="text-base font-semibold">The Descent</h3>
        <p className="mt-1 text-sm text-ops-muted">
          Per-depth model overrides for the journey below the construct. Blank
          uses the default model above. Depth 3 is the showcase — aim it at
          the strongest model on your account.
        </p>
        <div className="mt-5 space-y-5">
          {(
            [
              ["descentModel1", "Depth 01 — The Static (ECHO)"],
              ["descentModel2", "Depth 02 — The Dream (SOMNI)"],
              ["descentModel3", "Depth 03 — The Deep (AEON)"],
            ] as const
          ).map(([key, label]) => {
            const view = fields[key];
            if (!view || view.secret) return null;
            return (
              <div key={key}>
                <label htmlFor={key} className={labelClass}>
                  {label}
                </label>
                {modelsStatus === "ready" ? (
                  <select
                    id={key}
                    value={
                      models.some((m) => m.id === (drafts[key] ?? ""))
                        ? drafts[key]
                        : ""
                    }
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [key]: e.target.value }))
                    }
                    className={`${inputClass} mt-1.5`}
                  >
                    <option value="">
                      {drafts[key]
                        ? `current: ${drafts[key]}`
                        : "use default model"}
                    </option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                        {m.name !== m.id ? ` — ${m.name}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={key}
                    value={drafts[key] ?? ""}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [key]: e.target.value }))
                    }
                    placeholder="blank = default model"
                    className={`${inputClass} mt-1.5`}
                  />
                )}
                <p className="mt-1 text-xs text-ops-muted">
                  Saved:{" "}
                  <span className="font-medium text-ops-ink">
                    {view.value || "default"}
                  </span>
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Discord */}
      <div className="rounded-xl border border-ops-line bg-ops-card p-6 shadow-sm">
        <h3 className="text-base font-semibold">Discord</h3>
        <p className="mt-1 text-sm text-ops-muted">
          Credentials for the Discord integration — stored now, wired up as
          the bot comes online.
        </p>
        <div className="mt-5 space-y-5">
          {secretRow(
            "discordBotToken",
            "Bot token",
            "paste a new token to replace",
          )}
          {clientIdView && !clientIdView.secret && (
            <div>
              <label htmlFor="discordClientId" className={labelClass}>
                Application client ID
              </label>
              <input
                id="discordClientId"
                value={drafts.discordClientId ?? ""}
                onChange={(e) =>
                  setDrafts((d) => ({
                    ...d,
                    discordClientId: e.target.value,
                  }))
                }
                placeholder="e.g. 1234567890"
                autoComplete="off"
                className={`${inputClass} mt-1.5`}
              />
            </div>
          )}
          {secretRow(
            "discordClientSecret",
            "Client secret",
            "paste a new secret to replace",
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-lg bg-ops-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : "Save changes"}
        </button>
        {status === "saved" && (
          <span className="text-sm font-medium text-ops-green">Saved.</span>
        )}
        {status === "error" && (
          <span className="text-sm text-ops-red">{error}</span>
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
