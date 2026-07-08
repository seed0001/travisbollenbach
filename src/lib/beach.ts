// ---------------------------------------------------------------------------
// Room 02 — The Shore. World spec: a warm cove, its palms, and the shells
// waiting in the sand. Pure data — the scene builds the meshes client-side,
// the progress API validates collection server-side from the same numbers.
// ---------------------------------------------------------------------------

export const BEACH_ROOM_ID = "beach";
export const BEACH_SEED = 0xbeac4;
export const SHELL_COUNT = 10;
export const SHELL_XP = 5;
export const BEACH_CLEAR_XP = 100;

/** valid shell ids: shell-0 … shell-9 */
export function isShellId(value: string): boolean {
  const match = /^shell-(\d)$/.exec(value);
  return match !== null;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type ShellSpec = { id: string; x: number; z: number };
export type PalmSpec = { x: number; z: number; lean: number; height: number };

export function generateBeach(): { shells: ShellSpec[]; palms: PalmSpec[] } {
  const rng = mulberry32(BEACH_SEED);

  // shells scatter along the wet sand near the surf line
  const shells: ShellSpec[] = [];
  for (let i = 0; i < SHELL_COUNT; i += 1) {
    shells.push({
      id: `shell-${i}`,
      x: -52 + rng() * 104,
      z: -4 + rng() * 14,
    });
  }

  // palms stand back on the dunes
  const palms: PalmSpec[] = [];
  for (let i = 0; i < 9; i += 1) {
    palms.push({
      x: -50 + rng() * 100,
      z: 16 + rng() * 16,
      lean: (rng() - 0.5) * 0.5,
      height: 6 + rng() * 3.5,
    });
  }
  return { shells, palms };
}
