import * as THREE from "three";

// ---------------------------------------------------------------------------
// The world generator. The entire terrain is a pure function of WORLD_SEED and
// position — nothing is stored. Walk a mile out and back and every hill is
// exactly where you left it, because it was never anywhere else.
// ---------------------------------------------------------------------------

export const WORLD_SEED = 0x5eed;

export const CHUNK_SIZE = 64; // world units per tile side
export const CHUNK_SEGMENTS = 32; // quads per side — divides CHUNK_SIZE exactly, so chunk edges share bit-identical vertices
export const VIEW_CHUNKS = 5; // radius of loaded tiles around the player
export const WATER_LEVEL = 0;

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

// Seeded 2D simplex noise. Returns roughly [-1, 1].
export function createNoise2D(seed: number) {
  const rand = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) p[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i += 1) perm[i] = p[i & 255];

  const GRAD: readonly (readonly [number, number])[] = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;

  return (xin: number, yin: number) => {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = 1 - i1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;

    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      const g = GRAD[perm[ii + perm[jj]] & 7];
      t0 *= t0;
      n += t0 * t0 * (g[0] * x0 + g[1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      const g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7];
      t1 *= t1;
      n += t1 * t1 * (g[0] * x1 + g[1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      const g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7];
      t2 *= t2;
      n += t2 * t2 * (g[0] * x2 + g[1] * y2);
    }
    return 70 * n;
  };
}

type Noise2D = ReturnType<typeof createNoise2D>;

function fbm(
  noise: Noise2D,
  x: number,
  z: number,
  octaves: number,
  frequency: number,
) {
  let amplitude = 1;
  let freq = frequency;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o += 1) {
    sum += noise(x * freq, z * freq) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// Stylized flat-shaded palette
const C_SAND = new THREE.Color(0xdccf9b);
const C_SEABED = new THREE.Color(0x4e5b4a);
const C_GRASS_LUSH = new THREE.Color(0x3e8a4e);
const C_GRASS_DRY = new THREE.Color(0x8fa050);
const C_ROCK = new THREE.Color(0x7d7568);
const C_SNOW = new THREE.Color(0xeef3f6);

export type Terrain = {
  heightAt(x: number, z: number): number;
  buildChunkGeometry(cx: number, cz: number): THREE.BufferGeometry;
};

export function createTerrain(seed: number): Terrain {
  const mountains = createNoise2D(seed);
  const hills = createNoise2D(seed + 101);
  const detail = createNoise2D(seed + 202);
  const moisture = createNoise2D(seed + 303);

  const heightAt = (x: number, z: number) => {
    const c = fbm(mountains, x, z, 4, 0.0016); // continents and seas
    const h = fbm(hills, x, z, 4, 0.011); // rolling hills
    const d = detail(x * 0.06, z * 0.06); // surface roughness
    let wild = c * 34 + 8 + h * 7 + d * 0.9;
    if (wild > 18) wild += (wild - 18) * 0.9; // exaggerate highlands into peaks

    // The monolith corridor stays a gentle dry meadow no matter what the
    // noise wants — the spine runs from spawn down to the last monolith.
    const clampedZ = THREE.MathUtils.clamp(z, -118, 8);
    const spine = Math.hypot(x, z - clampedZ);
    const blend = THREE.MathUtils.smoothstep(spine, 35, 95);
    const meadow = 3.4 + h * 1.8;
    return meadow + (wild - meadow) * blend;
  };

  const pickColor = (
    out: THREE.Color,
    y: number,
    slope: number,
    x: number,
    z: number,
  ) => {
    const wet = fbm(moisture, x, z, 3, 0.004);
    const snowLine = 30 + wet * 5;
    if (y < WATER_LEVEL + 0.7) {
      out.copy(C_SAND);
      if (y < WATER_LEVEL - 1.5) {
        out.lerp(C_SEABED, Math.min(1, (WATER_LEVEL - 1.5 - y) / 6));
      }
    } else if (slope < 0.68) {
      out.copy(C_ROCK);
      if (y > snowLine) out.lerp(C_SNOW, 0.45);
    } else if (y > snowLine) {
      out.copy(C_SNOW);
    } else {
      const lush = THREE.MathUtils.clamp(wet * 0.5 + 0.5, 0, 1);
      out.copy(C_GRASS_DRY).lerp(C_GRASS_LUSH, lush);
      out.lerp(C_ROCK, THREE.MathUtils.smoothstep(y, 20, snowLine) * 0.7);
      if (y < WATER_LEVEL + 1.6) out.lerp(C_SAND, 0.5);
    }
    // subtle per-face variation keeps the facets lively
    out.multiplyScalar(1 + detail(x * 0.21, z * 0.21) * 0.05);
  };

  const buildChunkGeometry = (cx: number, cz: number) => {
    const originX = cx * CHUNK_SIZE;
    const originZ = cz * CHUNK_SIZE;
    const step = CHUNK_SIZE / CHUNK_SEGMENTS;
    const side = CHUNK_SEGMENTS + 1;

    const positions = new Float32Array(side * side * 3);
    for (let iz = 0; iz < side; iz += 1) {
      for (let ix = 0; ix < side; ix += 1) {
        const idx = (iz * side + ix) * 3;
        const lx = ix * step;
        const lz = iz * step;
        positions[idx] = lx;
        positions[idx + 1] = heightAt(originX + lx, originZ + lz);
        positions[idx + 2] = lz;
      }
    }

    const indices = new Uint32Array(CHUNK_SEGMENTS * CHUNK_SEGMENTS * 6);
    let o = 0;
    for (let iz = 0; iz < CHUNK_SEGMENTS; iz += 1) {
      for (let ix = 0; ix < CHUNK_SEGMENTS; ix += 1) {
        const a = iz * side + ix;
        const b = a + 1;
        const c = a + side;
        const d = c + 1;
        indices[o] = a;
        indices[o + 1] = c;
        indices[o + 2] = b;
        indices[o + 3] = b;
        indices[o + 4] = c;
        indices[o + 5] = d;
        o += 6;
      }
    }

    const indexed = new THREE.BufferGeometry();
    indexed.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    indexed.setIndex(new THREE.BufferAttribute(indices, 1));

    // Non-indexed so every face owns its vertices — that is what makes the
    // shading flat and the color per-facet.
    const geometry = indexed.toNonIndexed();
    indexed.dispose();
    geometry.computeVertexNormals();

    const pos = geometry.attributes.position;
    const nor = geometry.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const color = new THREE.Color();
    for (let f = 0; f < pos.count; f += 3) {
      const cyy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
      const cwx =
        (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3 + originX;
      const cwz =
        (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3 + originZ;
      const slope = (nor.getY(f) + nor.getY(f + 1) + nor.getY(f + 2)) / 3;
      pickColor(color, cyy, slope, cwx, cwz);
      for (let v = 0; v < 3; v += 1) {
        const i = (f + v) * 3;
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
      }
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  };

  return { heightAt, buildChunkGeometry };
}

// ---------------------------------------------------------------------------
// Chunk streaming: keep a bubble of tiles alive around the player, build the
// nearest missing one per frame, drop the ones left far behind. Because the
// terrain is a pure function of the seed, dropped chunks regenerate
// identically when the player comes back.
// ---------------------------------------------------------------------------

export type ChunkManager = {
  update(x: number, z: number): void;
  prewarm(x: number, z: number, radius: number): void;
  dispose(): void;
};

export function createChunkManager(
  scene: THREE.Scene,
  terrain: Terrain,
): ChunkManager {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const chunks = new Map<string, THREE.Mesh>();

  const build = (cx: number, cz: number, key: string) => {
    const mesh = new THREE.Mesh(terrain.buildChunkGeometry(cx, cz), material);
    mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    scene.add(mesh);
    chunks.set(key, mesh);
  };

  const drop = (key: string, mesh: THREE.Mesh) => {
    scene.remove(mesh);
    mesh.geometry.dispose();
    chunks.delete(key);
  };

  const update = (x: number, z: number) => {
    const pcx = Math.floor(x / CHUNK_SIZE);
    const pcz = Math.floor(z / CHUNK_SIZE);

    for (const [key, mesh] of chunks) {
      const [cx, cz] = key.split(",").map(Number);
      if (
        Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) >
        VIEW_CHUNKS + 1
      ) {
        drop(key, mesh);
      }
    }

    // one chunk per frame, nearest ring first
    for (let r = 0; r <= VIEW_CHUNKS; r += 1) {
      for (let dz = -r; dz <= r; dz += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const key = `${pcx + dx},${pcz + dz}`;
          if (!chunks.has(key)) {
            build(pcx + dx, pcz + dz, key);
            return;
          }
        }
      }
    }
  };

  const prewarm = (x: number, z: number, radius: number) => {
    const pcx = Math.floor(x / CHUNK_SIZE);
    const pcz = Math.floor(z / CHUNK_SIZE);
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const key = `${pcx + dx},${pcz + dz}`;
        if (!chunks.has(key)) build(pcx + dx, pcz + dz, key);
      }
    }
  };

  const dispose = () => {
    for (const [key, mesh] of chunks) drop(key, mesh);
    material.dispose();
  };

  return { update, prewarm, dispose };
}
