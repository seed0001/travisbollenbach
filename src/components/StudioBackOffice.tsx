"use client";

import { useRef, useState } from "react";

type WallKind = "empty" | "image" | "website" | "youtube";
type WallSlot = { id: string; kind: WallKind; src: string; title: string };
type MerchLink = { label: string; url: string };

export type EditableStudio = {
  unit: string;
  studioName: string;
  proprietor: string;
  tagline: string;
  walls: WallSlot[];
  links: MerchLink[];
  vrmSrc: string;
  avatarScale: number;
  avatarYaw: number;
  gameName: string;
  gameTagline: string;
  gameUrl: string;
  audioMode: "none" | "speech" | "fish" | "url";
  audioText: string;
  audioUrl: string;
  // AI host
  aiEnabled: boolean;
  aiName: string;
  aiPersona: string;
  openRouterModel: string;
  fishVoiceId: string;
  hasOpenRouterKey: boolean;
  hasFishKey: boolean;
  // Transient key inputs — blank means "keep the saved key". Never populated
  // from the server; only sent on save when the owner types a new one.
  openRouterKey: string;
  fishApiKey: string;
};

const AVATAR_SCALE_MIN = 0.5;
const AVATAR_SCALE_MAX = 3;

const WALL_LABELS: Record<string, string> = {
  center: "Back wall",
  left: "Left wall",
  right: "Right wall",
};

const KINDS: { value: WallKind; label: string }[] = [
  { value: "empty", label: "Blank" },
  { value: "image", label: "Image" },
  { value: "website", label: "Website" },
  { value: "youtube", label: "YouTube" },
];

function ytId(input: string): string | null {
  const s = (input ?? "").trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.slice(1, 12);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  } catch {
    /* not a url */
  }
  return null;
}

const inputClass =
  "w-full rounded-lg border border-line bg-black/50 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-dim focus:border-matrix";

export default function StudioBackOffice({
  initial,
}: {
  initial: EditableStudio[];
}) {
  const [studios, setStudios] = useState<EditableStudio[]>(initial);

  return (
    <div className="space-y-8">
      {studios.map((studio, i) => (
        <StudioCard
          key={studio.unit}
          studio={studio}
          onChange={(next) =>
            setStudios((prev) => prev.map((s, j) => (j === i ? next : s)))
          }
        />
      ))}
    </div>
  );
}

function StudioCard({
  studio,
  onChange,
}: {
  studio: EditableStudio;
  onChange: (next: EditableStudio) => void;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  const setWall = (id: string, patch: Partial<WallSlot>) =>
    onChange({
      ...studio,
      walls: studio.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    });

  const setLink = (idx: number, patch: Partial<MerchLink>) =>
    onChange({
      ...studio,
      links: studio.links.map((l, j) => (j === idx ? { ...l, ...patch } : l)),
    });

  const save = async () => {
    setStatus("saving");
    setError("");
    try {
      const res = await fetch("/api/studio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit: studio.unit,
          studioName: studio.studioName,
          proprietor: studio.proprietor,
          tagline: studio.tagline,
          walls: studio.walls,
          links: studio.links,
          vrmSrc: studio.vrmSrc,
          avatarScale: studio.avatarScale,
          avatarYaw: studio.avatarYaw,
          gameName: studio.gameName,
          gameTagline: studio.gameTagline,
          gameUrl: studio.gameUrl,
          audioMode: studio.audioMode,
          audioText: studio.audioText,
          audioUrl: studio.audioUrl,
          aiEnabled: studio.aiEnabled,
          aiName: studio.aiName,
          aiPersona: studio.aiPersona,
          openRouterModel: studio.openRouterModel,
          fishVoiceId: studio.fishVoiceId,
          // Only sent when the owner typed a new key; blank keeps the old one.
          openRouterKey: studio.openRouterKey,
          fishApiKey: studio.fishApiKey,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      // The server never echoes keys back; clear the transient inputs.
      if (data.studio) {
        onChange({ ...data.studio, openRouterKey: "", fishApiKey: "" });
      }
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  };

  return (
    <div className="rounded-3xl border border-line bg-surface/70 p-6 md:p-8">
      <div className="flex items-center gap-3">
        <span className="glow-green text-lg font-black text-matrix">
          {studio.unit}
        </span>
        <input
          value={studio.studioName}
          onChange={(e) => onChange({ ...studio, studioName: e.target.value })}
          maxLength={60}
          placeholder="Store name"
          className="flex-1 rounded-lg border border-line bg-black/50 px-3 py-2 text-lg font-bold text-ink outline-none focus:border-matrix"
        />
      </div>

      {/* Listing / signage — what a visitor reads when they walk up */}
      <div className="mt-6 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
          listing
        </p>
        <input
          value={studio.proprietor}
          onChange={(e) => onChange({ ...studio, proprietor: e.target.value })}
          placeholder="Proprietor — who runs it (shown as “Run by …”)"
          maxLength={60}
          className={inputClass}
        />
        <textarea
          value={studio.tagline}
          onChange={(e) => onChange({ ...studio, tagline: e.target.value })}
          placeholder="Your spiel — what visitors read when they walk up to your unit"
          maxLength={180}
          rows={3}
          className={`${inputClass} resize-none`}
        />
        <p className="text-[11px] leading-relaxed text-ink-dim">
          This is your storefront&apos;s signage in the city — the store name
          above, who runs it, and the pitch people see when they approach.
        </p>
      </div>

      {/* Walls */}
      <div className="mt-6 space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
          walls
        </p>
        {studio.walls.map((wall) => (
          <WallEditor
            key={wall.id}
            wall={wall}
            onChange={(patch) => setWall(wall.id, patch)}
          />
        ))}
      </div>

      {/* Links */}
      <div className="mt-8 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
          merch &amp; links
        </p>
        {studio.links.map((link, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              value={link.label}
              onChange={(e) => setLink(idx, { label: e.target.value })}
              placeholder="label"
              className={`${inputClass} max-w-[10rem]`}
            />
            <input
              value={link.url}
              onChange={(e) => setLink(idx, { url: e.target.value })}
              placeholder="https://…"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...studio,
                  links: studio.links.filter((_, j) => j !== idx),
                })
              }
              className="shrink-0 px-2 text-ink-dim transition-colors hover:text-pill-red"
              aria-label="remove link"
            >
              ✕
            </button>
          </div>
        ))}
        {studio.links.length < 12 && (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...studio,
                links: [...studio.links, { label: "", url: "" }],
              })
            }
            className="text-xs font-bold uppercase tracking-[0.16em] text-matrix transition-opacity hover:opacity-70"
          >
            + add link
          </button>
        )}
      </div>

      {/* Store avatar (VRM) */}
      <div className="mt-8 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
          store avatar
        </p>
        <AvatarUploader
          studio={studio}
          onChange={onChange}
        />
      </div>

      {/* Proximity audio */}
      <div className="mt-8 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
          sound
        </p>
        <AudioEditor studio={studio} onChange={onChange} />
      </div>

      {/* AI host */}
      <div className="mt-8 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
          ai host
        </p>
        <AssistantEditor studio={studio} onChange={onChange} />
      </div>

      {/* Arena game portal */}
      <div className="mt-8 space-y-3">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
          arena game
        </p>
        <GameEditor studio={studio} onChange={onChange} />
      </div>

      <div className="mt-8 flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-xl border border-matrix px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black disabled:opacity-50"
        >
          {status === "saving" ? "saving…" : "save storefront"}
        </button>
        {status === "saved" && (
          <span className="text-xs uppercase tracking-[0.2em] text-matrix">
            saved ✓
          </span>
        )}
        {status === "error" && <span className="text-sm text-pill-red">{error}</span>}
      </div>
    </div>
  );
}

// Upload a .vrm avatar for the unit. The file is stored server-side and its
// serve path saved onto the studio; the Construct loads it and walks it around.
function AvatarUploader({
  studio,
  onChange,
}: {
  studio: EditableStudio;
  onChange: (next: EditableStudio) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const vrmSrc = studio.vrmSrc;

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/studio/vrm", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      onChange({ ...studio, vrmSrc: data.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-black/30 p-4">
      <p className="text-sm text-ink-soft">
        {vrmSrc
          ? "An avatar is set — it walks around inside your unit in the city."
          : "Upload an avatar. It walks around inside your unit in the city."}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-md border border-line px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-matrix hover:text-matrix disabled:opacity-50"
        >
          {uploading
            ? "uploading…"
            : vrmSrc
              ? "replace avatar"
              : "upload avatar"}
        </button>
        {vrmSrc && !uploading && (
          <>
            <span className="text-xs uppercase tracking-[0.16em] text-matrix">
              avatar ready ✓
            </span>
            <button
              type="button"
              onClick={() => onChange({ ...studio, vrmSrc: "" })}
              className="text-xs font-bold uppercase tracking-[0.14em] text-ink-dim transition-colors hover:text-pill-red"
            >
              remove
            </button>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".vrm,.glb,.gltf,.fbx,model/gltf-binary"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-dim">
        VRM, GLB, glTF, or FBX, up to 60 MB. A VRM walks on its own; GLB/FBX
        walk if the file includes an animation. Save the storefront after
        uploading to apply it.
      </p>
      {error && <p className="mt-2 text-sm text-pill-red">{error}</p>}

      {vrmSrc && (
        <div className="mt-4 space-y-4 border-t border-line/60 pt-4">
          {/* Size */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor={`scale-${studio.unit}`}
                className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft"
              >
                size
              </label>
              <span className="text-xs tabular-nums text-matrix">
                {studio.avatarScale.toFixed(1)}×
              </span>
            </div>
            <input
              id={`scale-${studio.unit}`}
              type="range"
              min={AVATAR_SCALE_MIN}
              max={AVATAR_SCALE_MAX}
              step={0.1}
              value={studio.avatarScale}
              onChange={(e) =>
                onChange({ ...studio, avatarScale: Number(e.target.value) })
              }
              className="mt-2 w-full accent-matrix"
            />
            <p className="mt-1 text-[11px] text-ink-dim">
              Bigger or smaller, up to {AVATAR_SCALE_MAX}× (avatars are
              auto-fit to a normal height first).
            </p>
          </div>

          {/* Facing */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor={`yaw-${studio.unit}`}
                className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft"
              >
                facing
              </label>
              <span className="text-xs tabular-nums text-matrix">
                {studio.avatarYaw}°
              </span>
            </div>
            <input
              id={`yaw-${studio.unit}`}
              type="range"
              min={0}
              max={345}
              step={15}
              value={studio.avatarYaw}
              onChange={(e) =>
                onChange({ ...studio, avatarYaw: Number(e.target.value) })
              }
              className="mt-2 w-full accent-matrix"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[0, 90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => onChange({ ...studio, avatarYaw: deg })}
                  className={`rounded-md border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                    studio.avatarYaw === deg
                      ? "border-matrix text-matrix"
                      : "border-line text-ink-dim hover:text-ink-soft"
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-ink-dim">
              If your avatar walks backwards, turn it 180°.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Point the unit's Arena pod at a game. Renting a unit gets you a pod in the
// Superdome; drop in the URL of your own app (e.g. a Railway deployment) and
// the pod goes live — stepping into it sends players straight to your game.
function GameEditor({
  studio,
  onChange,
}: {
  studio: EditableStudio;
  onChange: (next: EditableStudio) => void;
}) {
  const url = studio.gameUrl.trim();
  const live = /^https?:\/\//i.test(url);

  return (
    <div className="rounded-2xl border border-line bg-black/30 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">
          Your pod in the Arena — the Superdome at the end of the street.
        </p>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
            live
              ? "border-matrix text-matrix"
              : "border-line text-ink-dim"
          }`}
        >
          {live ? "live" : "coming soon"}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        <input
          value={studio.gameName}
          onChange={(e) => onChange({ ...studio, gameName: e.target.value })}
          placeholder="Game name (defaults to your studio name)"
          maxLength={60}
          className={inputClass}
        />
        <input
          value={studio.gameTagline}
          onChange={(e) =>
            onChange({ ...studio, gameTagline: e.target.value })
          }
          placeholder="Tagline shown on the pod sign (optional)"
          maxLength={100}
          className={inputClass}
        />
        <input
          value={studio.gameUrl}
          onChange={(e) => onChange({ ...studio, gameUrl: e.target.value })}
          placeholder="https://your-game.up.railway.app"
          maxLength={600}
          className={inputClass}
        />
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-dim">
        Host your game anywhere with a public URL (a Railway app works great).
        Paste it here and save — your pod lights up in the lobby and players
        who step into it are sent to your game. Clear the URL to take it down.
      </p>
    </div>
  );
}

// Give the unit a voice. Two modes, both storage-free: "narration" reads your
// script aloud in the visitor's own browser (nothing is hosted), "audio file"
// streams a track you host elsewhere. It plays when someone walks up to your
// unit in the city, not on a loop for everyone.
function AudioEditor({
  studio,
  onChange,
}: {
  studio: EditableStudio;
  onChange: (next: EditableStudio) => void;
}) {
  const preview = () => {
    const synth = window.speechSynthesis;
    if (!synth || !studio.audioText.trim()) return;
    synth.cancel();
    synth.speak(new SpeechSynthesisUtterance(studio.audioText.trim()));
  };

  const MODES: { value: EditableStudio["audioMode"]; label: string }[] = [
    { value: "none", label: "Off" },
    { value: "speech", label: "Narration" },
    { value: "fish", label: "Fish voice" },
    { value: "url", label: "Audio file" },
  ];

  return (
    <div className="rounded-2xl border border-line bg-black/30 p-4">
      <p className="text-sm text-ink-soft">
        Play a jingle or a spoken ad when visitors walk up to your unit — a
        &ldquo;come see the grand opening&rdquo; announcement, a track, whatever
        you like.
      </p>

      <div className="mt-3 flex gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange({ ...studio, audioMode: m.value })}
            className={`rounded-md border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
              studio.audioMode === m.value
                ? "border-matrix text-matrix"
                : "border-line text-ink-dim hover:text-ink-soft"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {(studio.audioMode === "speech" || studio.audioMode === "fish") && (
        <div className="mt-3 space-y-2">
          <textarea
            value={studio.audioText}
            onChange={(e) => onChange({ ...studio, audioText: e.target.value })}
            placeholder="Come see Solo Studio — grand opening this weekend! Fresh drops, live demos, and…"
            maxLength={320}
            rows={3}
            className={`${inputClass} resize-none`}
          />
          {studio.audioMode === "speech" ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={preview}
                className="rounded-md border border-line px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-matrix hover:text-matrix"
              >
                ▶ preview
              </button>
              <p className="text-[11px] text-ink-dim">
                Spoken by the visitor&apos;s browser — nothing is uploaded.
              </p>
            </div>
          ) : (
            <p className="text-[11px] leading-relaxed text-ink-dim">
              Spoken in your Fish Audio voice — set your Fish key and voice under
              &ldquo;AI host&rdquo; below.
              {!studio.hasFishKey && " No Fish key is set yet."}
            </p>
          )}
        </div>
      )}

      {studio.audioMode === "url" && (
        <div className="mt-3 space-y-2">
          <input
            value={studio.audioUrl}
            onChange={(e) => onChange({ ...studio, audioUrl: e.target.value })}
            placeholder="https://your-host.com/jingle.mp3"
            maxLength={600}
            className={inputClass}
          />
          <p className="text-[11px] leading-relaxed text-ink-dim">
            A direct link to an audio file (MP3, OGG, etc.) you host anywhere.
            It streams from there — we never store the file.
          </p>
        </div>
      )}
    </div>
  );
}

// Wire up a per-store AI host: the owner brings their own OpenRouter key (+
// model) for the chat and their own Fish Audio key (+ voice) for the voice.
// Keys are write-only here — the server never sends them back, so a blank field
// means "keep the saved key". The store's avatar is the host's face in the city.
function AssistantEditor({
  studio,
  onChange,
}: {
  studio: EditableStudio;
  onChange: (next: EditableStudio) => void;
}) {
  const keyField = (set: boolean, dirty: string) =>
    dirty
      ? "new key entered — save to apply"
      : set
        ? "key saved ✓ — leave blank to keep, type to replace"
        : "not set";

  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [modelsBusy, setModelsBusy] = useState(false);
  const [modelsErr, setModelsErr] = useState("");
  const hasKey = studio.hasOpenRouterKey || studio.openRouterKey.trim().length > 0;

  const loadModels = async () => {
    setModelsBusy(true);
    setModelsErr("");
    try {
      const res = await fetch("/api/studio/models");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't load models.");
      setModels(data.models ?? []);
    } catch (e) {
      setModelsErr(e instanceof Error ? e.message : "Couldn't load models.");
    } finally {
      setModelsBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-black/30 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Give this unit a talking host. Visitors who step inside can chat with
          it — powered by your OpenRouter model and voiced by your Fish Audio
          voice. Your uploaded avatar is its face.
        </p>
        <button
          type="button"
          onClick={() => onChange({ ...studio, aiEnabled: !studio.aiEnabled })}
          className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${
            studio.aiEnabled
              ? "border-matrix bg-matrix/15 text-matrix"
              : "border-line text-ink-dim hover:text-ink-soft"
          }`}
        >
          {studio.aiEnabled ? "enabled" : "disabled"}
        </button>
      </div>

      <div className="space-y-2">
        <input
          value={studio.aiName}
          onChange={(e) => onChange({ ...studio, aiName: e.target.value })}
          placeholder="Host name (defaults to your store name)"
          maxLength={60}
          className={inputClass}
        />
        <textarea
          value={studio.aiPersona}
          onChange={(e) => onChange({ ...studio, aiPersona: e.target.value })}
          placeholder="How should the host behave? e.g. You are the friendly owner of a late-night ramen bar. Greet visitors, talk up the specials, keep it short and warm."
          maxLength={4000}
          rows={4}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="space-y-2 border-t border-line/60 pt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">
          brain · openrouter
        </p>
        <input
          type="password"
          value={studio.openRouterKey}
          onChange={(e) =>
            onChange({ ...studio, openRouterKey: e.target.value })
          }
          placeholder="OpenRouter API key"
          maxLength={300}
          autoComplete="off"
          className={inputClass}
        />
        <p className="text-[11px] text-ink-dim">
          {keyField(studio.hasOpenRouterKey, studio.openRouterKey)} · get one at
          openrouter.ai
        </p>

        {/* Model: type one, or (once a key is in) browse the full catalog. */}
        <input
          value={studio.openRouterModel}
          onChange={(e) =>
            onChange({ ...studio, openRouterModel: e.target.value })
          }
          placeholder="Model, e.g. openai/gpt-4o-mini"
          maxLength={100}
          className={inputClass}
        />
        {hasKey &&
          (models.length === 0 ? (
            <button
              type="button"
              onClick={loadModels}
              disabled={modelsBusy}
              className="rounded-md border border-line px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-matrix hover:text-matrix disabled:opacity-50"
            >
              {modelsBusy ? "loading models…" : "browse models"}
            </button>
          ) : (
            <select
              value={
                models.some((m) => m.id === studio.openRouterModel)
                  ? studio.openRouterModel
                  : ""
              }
              onChange={(e) =>
                e.target.value &&
                onChange({ ...studio, openRouterModel: e.target.value })
              }
              className={inputClass}
            >
              <option value="">— pick from {models.length} models —</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.id})
                </option>
              ))}
            </select>
          ))}
        {modelsErr && <p className="text-[11px] text-pill-red">{modelsErr}</p>}
      </div>

      <div className="space-y-2 border-t border-line/60 pt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">
          voice · fish audio
        </p>
        <input
          value={studio.fishVoiceId}
          onChange={(e) => onChange({ ...studio, fishVoiceId: e.target.value })}
          placeholder="Fish voice / reference id (blank = default voice)"
          maxLength={120}
          className={inputClass}
        />
        <input
          type="password"
          value={studio.fishApiKey}
          onChange={(e) => onChange({ ...studio, fishApiKey: e.target.value })}
          placeholder="Fish Audio API key"
          maxLength={300}
          autoComplete="off"
          className={inputClass}
        />
        <p className="text-[11px] text-ink-dim">
          {keyField(studio.hasFishKey, studio.fishApiKey)} · get one at
          fish.audio. Also powers the &ldquo;Fish voice&rdquo; greeting.
        </p>
      </div>
    </div>
  );
}

function WallEditor({
  wall,
  onChange,
}: {
  wall: WallSlot;
  onChange: (patch: Partial<WallSlot>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const upload = async (file: File) => {
    setUploading(true);
    setUploadError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/studio/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      onChange({ kind: "image", src: data.url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const id = wall.kind === "youtube" ? ytId(wall.src) : null;

  return (
    <div className="rounded-2xl border border-line bg-black/30 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-24 text-sm font-semibold text-ink-soft">
          {WALL_LABELS[wall.id] ?? wall.id}
        </span>
        <div className="flex gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => onChange({ kind: k.value })}
              className={`rounded-md border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                wall.kind === k.value
                  ? "border-matrix text-matrix"
                  : "border-line text-ink-dim hover:text-ink-soft"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {wall.kind !== "empty" && (
        <div className="mt-3 space-y-2">
          <input
            value={wall.src}
            onChange={(e) => onChange({ src: e.target.value })}
            placeholder={
              wall.kind === "image"
                ? "https://image-url… (or upload)"
                : wall.kind === "youtube"
                  ? "https://youtube.com/watch?v=…"
                  : "https://your-site.com"
            }
            className={inputClass}
          />
          <input
            value={wall.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="caption (optional)"
            maxLength={80}
            className={inputClass}
          />

          {wall.kind === "image" && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-md border border-line px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-matrix hover:text-matrix disabled:opacity-50"
              >
                {uploading ? "uploading…" : "upload image"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
              {uploadError && (
                <span className="text-xs text-pill-red">{uploadError}</span>
              )}
            </div>
          )}

          {/* Preview */}
          {wall.src && wall.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={wall.src}
              alt=""
              className="mt-1 max-h-32 rounded-md border border-line object-contain"
            />
          )}
          {wall.kind === "youtube" &&
            (id ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`}
                alt=""
                className="mt-1 max-h-32 rounded-md border border-line"
              />
            ) : (
              wall.src && (
                <p className="text-xs text-pill-red">
                  Couldn&apos;t read a YouTube video id from that link.
                </p>
              )
            ))}
          {wall.kind === "website" && /^https?:\/\//i.test(wall.src) && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/shot?url=${encodeURIComponent(wall.src)}`}
                alt=""
                className="mt-1 max-h-40 rounded-md border border-line object-contain"
              />
              <p className="text-[11px] text-ink-dim">
                A snapshot of this site&apos;s front page hangs on the wall.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
