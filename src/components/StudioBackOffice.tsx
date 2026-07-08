"use client";

import { useRef, useState } from "react";

type WallKind = "empty" | "image" | "website" | "youtube";
type WallSlot = { id: string; kind: WallKind; src: string; title: string };
type MerchLink = { label: string; url: string };

export type EditableStudio = {
  unit: string;
  studioName: string;
  walls: WallSlot[];
  links: MerchLink[];
  vrmSrc: string;
};

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
          walls: studio.walls,
          links: studio.links,
          vrmSrc: studio.vrmSrc,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      if (data.studio) onChange(data.studio);
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
          className="flex-1 rounded-lg border border-line bg-black/50 px-3 py-2 text-lg font-bold text-ink outline-none focus:border-matrix"
        />
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
          vrmSrc={studio.vrmSrc}
          onChange={(vrmSrc) => onChange({ ...studio, vrmSrc })}
        />
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
  vrmSrc,
  onChange,
}: {
  vrmSrc: string;
  onChange: (vrmSrc: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/studio/vrm", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      onChange(data.url);
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
              onClick={() => onChange("")}
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
