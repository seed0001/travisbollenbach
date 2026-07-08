// ---------------------------------------------------------------------------
// Room 01 — The Galaxy. The world spec: a seeded solar system and the shards
// scattered through it. Pure data, no three.js — imported by both the scene
// (client) and the progress API (server), so the shard list can't drift.
// ---------------------------------------------------------------------------

export const GALAXY_ROOM_ID = "galaxy";
export const GALAXY_SEED = 0x5ace;
export const SHARD_COUNT = 12;
export const SHARD_XP = 5;
export const GALAXY_CLEAR_XP = 100;

/** valid shard ids: shard-0 … shard-11 */
export function isShardId(value: string): boolean {
  const match = /^shard-(\d{1,2})$/.exec(value);
  if (!match) return false;
  const n = Number(match[1]);
  return n >= 0 && n < SHARD_COUNT;
}

export type PlanetSpec = {
  name: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  hue: number; // 0..1
  ring: boolean;
};

export type ShardSpec = {
  id: string;
  x: number;
  y: number;
  z: number;
};

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

const SYLLABLES = [
  "ka", "ve", "lor", "zin", "tha", "rex", "ou", "mi", "sol",
  "dra", "nex", "ur", "bel", "qua", "yss", "ton", "ari", "ph",
];

function planetName(rng: () => number): string {
  const parts = 2 + Math.floor(rng() * 2);
  let name = "";
  for (let i = 0; i < parts; i += 1) {
    name += SYLLABLES[Math.floor(rng() * SYLLABLES.length)];
  }
  const numeral = ["I", "II", "III", "IV", "V", "VI", "VII"][
    Math.floor(rng() * 7)
  ];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${numeral}`;
}

export function generateGalaxy(): {
  planets: PlanetSpec[];
  shards: ShardSpec[];
} {
  const rng = mulberry32(GALAXY_SEED);
  const planets: PlanetSpec[] = [];
  const count = 9;
  for (let i = 0; i < count; i += 1) {
    // spread around the sun in a loose disc with vertical scatter
    const angle = (i / count) * Math.PI * 2 + rng() * 0.6;
    const distance = 220 + rng() * 560;
    planets.push({
      name: planetName(rng),
      x: Math.cos(angle) * distance,
      y: (rng() - 0.5) * 180,
      z: Math.sin(angle) * distance,
      radius: 16 + rng() * 26,
      hue: rng(),
      ring: rng() < 0.4,
    });
  }

  // each shard hangs near a planet — exploring finds them
  const shards: ShardSpec[] = [];
  for (let i = 0; i < SHARD_COUNT; i += 1) {
    const planet = planets[i % planets.length];
    const theta = rng() * Math.PI * 2;
    const phi = (rng() - 0.5) * Math.PI * 0.7;
    const orbit = planet.radius * (1.8 + rng() * 1.2);
    shards.push({
      id: `shard-${i}`,
      x: planet.x + Math.cos(theta) * Math.cos(phi) * orbit,
      y: planet.y + Math.sin(phi) * orbit,
      z: planet.z + Math.sin(theta) * Math.cos(phi) * orbit,
    });
  }
  return { planets, shards };
}
