"use client";

import {
  LUNA_CONCERT_TRACKS,
  LUNA_SCALE_MAX,
  LUNA_SCALE_MIN,
  STAGE_LINEUPS,
  type ConcertTrack,
  type StageLineup,
} from "@/lib/luna/concertConfig";

const ACCENT = "#8b5cf6";

type LunaStageMenuProps = {
  open: boolean;
  onClose: () => void;
  lunaScale: number;
  onLunaScaleChange: (scale: number) => void;
  selectedTrackId: string;
  onPickTrack: (track: ConcertTrack) => void;
  onUploadSong: (file: File, title: string) => void;
  trackLoading: boolean;
  avatarName: string;
  avatarLoading: boolean;
  lineupId: string;
  onPickLineup: (lineup: StageLineup) => void;
  onUploadAvatar: (file: File) => void;
  onResetAvatar: () => void;
  status: string;
};

export default function LunaStageMenu({
  open,
  onClose,
  lunaScale,
  onLunaScaleChange,
  selectedTrackId,
  onPickTrack,
  onUploadSong,
  trackLoading,
  avatarName,
  avatarLoading,
  lineupId,
  onPickLineup,
  onUploadAvatar,
  onResetAvatar,
  status,
}: LunaStageMenuProps) {
  if (!open) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-[#0b1020]/95 p-5 shadow-2xl"
        style={{ borderColor: `${ACCENT}88` }}
        role="dialog"
        aria-label="Luna stage settings"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-[0.24em]"
              style={{ color: ACCENT }}
            >
              Stage menu board
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Luna performance and size controls.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/20 px-3 py-1 text-xs uppercase tracking-wider text-ink-soft hover:bg-white/10"
          >
            close
          </button>
        </div>

        <section className="mb-5 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-dim">
            Luna size on stage
          </p>
          <input
            type="range"
            min={LUNA_SCALE_MIN}
            max={LUNA_SCALE_MAX}
            step={0.05}
            value={lunaScale}
            onChange={(e) => onLunaScaleChange(Number(e.target.value))}
            className="w-full accent-[#8b5cf6]"
          />
          <p className="text-center text-xs text-ink-soft">
            {lunaScale.toFixed(2)}× height
            {lunaScale >= LUNA_SCALE_MAX - 0.05 ? " · giant scale" : ""}
          </p>
        </section>

        <section className="mb-5 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-dim">
            Singers
          </p>
          <div className="flex flex-wrap gap-2">
            {STAGE_LINEUPS.map((lineup) => (
              <button
                key={lineup.id}
                type="button"
                disabled={avatarLoading}
                onClick={() => onPickLineup(lineup)}
                className="rounded-md border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] disabled:opacity-45"
                style={{
                  borderColor:
                    lineupId === lineup.id ? ACCENT : "rgba(255,255,255,0.18)",
                  backgroundColor:
                    lineupId === lineup.id
                      ? `${ACCENT}22`
                      : "rgba(255,255,255,0.055)",
                }}
              >
                {lineup.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-5 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-dim">
            Performer
          </p>
          <p className="text-[10px] leading-relaxed text-ink-dim">
            Swap the lead singer for any <span className="uppercase">.vrm</span>{" "}
            avatar — lip sync, expressions, and choreography re-attach
            automatically. Lead on stage now:{" "}
            <span className="font-bold text-ink-soft">{avatarName}</span>
          </p>
          <label className="block text-[10px] uppercase tracking-wider text-ink-dim">
            VRM avatar file
            <input
              type="file"
              accept=".vrm"
              disabled={avatarLoading}
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                e.currentTarget.value = "";
                if (file) onUploadAvatar(file);
              }}
              className="mt-1 block w-full text-xs text-ink-soft disabled:opacity-45"
            />
          </label>
          <button
            type="button"
            disabled={avatarLoading}
            onClick={onResetAvatar}
            className="w-full rounded-md border px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020] disabled:opacity-45"
            style={{ borderColor: `${ACCENT}99` }}
          >
            {avatarLoading ? "loading performer…" : "reset to Luna solo"}
          </button>
        </section>

        <section className="mb-5 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-dim">
            Built-in setlist
          </p>
          <div className="flex flex-wrap gap-2">
            {LUNA_CONCERT_TRACKS.map((track) => (
              <button
                key={track.id}
                type="button"
                disabled={trackLoading}
                onClick={() => onPickTrack(track)}
                className="rounded-md border px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] disabled:opacity-45"
                style={{
                  borderColor:
                    selectedTrackId === track.id ? ACCENT : "rgba(255,255,255,0.18)",
                  backgroundColor:
                    selectedTrackId === track.id
                      ? `${ACCENT}22`
                      : "rgba(255,255,255,0.055)",
                }}
              >
                {track.title}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-dim">
            Upload a song
          </p>
          <p className="text-[10px] leading-relaxed text-ink-dim">
            Luna splits your track into instrumental + vocal stems automatically
            (Demucs on CPU — first split may take a few minutes).
          </p>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const song = fd.get("song") as File | null;
              const title = String(fd.get("title") ?? "").trim();
              if (!song?.size) return;
              onUploadSong(song, title || song.name.replace(/\.[^.]+$/, ""));
              e.currentTarget.reset();
            }}
          >
            <input
              name="title"
              type="text"
              placeholder="Song title (optional)"
              className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-[#dbe5ff] outline-none focus:border-[#8b5cf6]"
            />
            <label className="block text-[10px] uppercase tracking-wider text-ink-dim">
              Mixed song file
              <input
                name="song"
                type="file"
                accept="audio/*"
                className="mt-1 block w-full text-xs text-ink-soft"
              />
            </label>
            <button
              type="submit"
              disabled={trackLoading}
              className="w-full rounded-md border px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020] disabled:opacity-45"
              style={{ borderColor: `${ACCENT}99` }}
            >
              {trackLoading ? "splitting song…" : "split & load song"}
            </button>
          </form>
        </section>

        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.18em] text-ink-dim">
          {status}
        </p>
      </div>
    </div>
  );
}
