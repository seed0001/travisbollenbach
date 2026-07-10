export type ConcertAudioSource = string | File | Blob;

export type ConcertTrack = {
  id: string;
  title: string;
  music: ConcertAudioSource;
  vocals: ConcertAudioSource;
};

/** Normalized VRM height before the user scale multiplier. */
export const LUNA_BASE_HEIGHT = 1.7;
/** Stage spotlight cone height in world metres (matches ConcertHall rig). */
export const CONCERT_SPOTLIGHT_HEIGHT = 50;
/** Slider max — Luna at full scale matches the overhead spotlight beams. */
export const LUNA_SCALE_MIN = 0.55;
export const LUNA_SCALE_MAX = CONCERT_SPOTLIGHT_HEIGHT / LUNA_BASE_HEIGHT;
/** Larger-than-life by default — 1× (real-world 1.7m) reads tiny in a hall this big. */
export const LUNA_SCALE_DEFAULT = 2;

export type ConcertSinger = { id: string; name: string; url: string };

export const CONCERT_SINGERS: ConcertSinger[] = [
  { id: "luna", name: "Luna", url: "/luna/Luna.vrm" },
  { id: "victor", name: "Victor", url: "/luna/Victor.vrm" },
];

/** A stage lineup: one lead singer, optionally a duet partner beside them. */
export type StageLineup = {
  id: string;
  label: string;
  lead: ConcertSinger;
  partner: ConcertSinger | null;
};

export const STAGE_LINEUPS: StageLineup[] = [
  { id: "luna-solo", label: "Luna", lead: CONCERT_SINGERS[0], partner: null },
  { id: "victor-solo", label: "Victor", lead: CONCERT_SINGERS[1], partner: null },
  {
    id: "duet",
    label: "Duet · Luna + Victor",
    lead: CONCERT_SINGERS[0],
    partner: CONCERT_SINGERS[1],
  },
];

export const DEFAULT_LINEUP = STAGE_LINEUPS[0];

export const LUNA_CONCERT_TRACKS: ConcertTrack[] = [
  {
    id: "starline-dream",
    title: "Starline Dream",
    music: "/luna/starline-dream-instrumental.wav",
    vocals: "/luna/starline-dream-vocals.wav",
  },
  {
    id: "pixel-escape",
    title: "Pixel Escape",
    music: "/luna/pixel-escape-instrumental.wav",
    vocals: "/luna/pixel-escape-vocals.wav",
  },
  {
    id: "stuck-in-the-chat",
    title: "Stuck in the Chat",
    music: "/luna/stuck-in-the-chat-instrumental.mp3",
    vocals: "/luna/stuck-in-the-chat-vocals.mp3",
  },
  {
    id: "mud-life-anthem",
    title: "Mud Life Anthem",
    music: "/luna/mud-life-anthem-instrumental.mp3",
    vocals: "/luna/mud-life-anthem-vocals.mp3",
  },
];

export const DEFAULT_CONCERT_TRACK = LUNA_CONCERT_TRACKS[0];

export function customUploadTrack(
  title: string,
  music: File | Blob,
  vocals: File | Blob,
): ConcertTrack {
  const slug = title.trim() || "custom-upload";
  return {
    id: `custom-${slug}-${Date.now()}`,
    title: slug,
    music,
    vocals,
  };
}
