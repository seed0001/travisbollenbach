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
export const LUNA_SCALE_DEFAULT = 1;

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
