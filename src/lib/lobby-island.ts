import * as THREE from "three";
import { createNoise2D } from "./terrain";

// ---------------------------------------------------------------------------
// The Nexus island — the lobby world. A small bounded night island, one
// plaza, sealed gates around the rim waiting to become escape rooms. Unlike
// the open Construct, this world is finite on purpose: everyone lands here,
// so everyone is within walking distance of everyone else.
// ---------------------------------------------------------------------------

export const ISLAND_SEED = 0x10bb7;
export const ISLAND_RADIUS = 70; // land beyond this sinks under the water
export const WALK_RADIUS = 62; // players are held inside this ring
export const PLAZA_RADIUS = 16;
export const LOBBY_WATER_LEVEL = 0;

/** Gates around the plaza — the escape rooms. Angles are on the plaza ring;
 * a gate with an href is open and walkable, the rest are sealed. */
export const GATES: {
  id: string;
  title: string;
  angle: number;
  href?: string;
}[] = [
  {
    id: "room-01",
    title: "Room 01 — The Galaxy",
    angle: 0,
    href: "/rooms/galaxy",
  },
  { id: "room-02", title: "Room 02 — sealed", angle: (Math.PI * 2) / 5 },
  { id: "room-03", title: "Room 03 — sealed", angle: (Math.PI * 4) / 5 },
  { id: "room-04", title: "Room 04 — sealed", angle: (Math.PI * 6) / 5 },
  { id: "room-05", title: "Room 05 — sealed", angle: (Math.PI * 8) / 5 },
];

export const GATE_RING_RADIUS = 34;

const noise = createNoise2D(ISLAND_SEED);
const detail = createNoise2D(ISLAND_SEED + 77);

export function islandHeightAt(x: number, z: number): number {
  const d = Math.hypot(x, z);
  // rolling ground, flattening into the central plaza, sinking at the rim
  const rough =
    noise(x * 0.02, z * 0.02) * 2.6 + detail(x * 0.09, z * 0.09) * 0.7;
  const base = 2.4 + rough;
  const rim = THREE.MathUtils.smoothstep(d, ISLAND_RADIUS * 0.55, ISLAND_RADIUS);
  const wild = base * (1 - rim) - rim * 7;
  const plaza = THREE.MathUtils.smoothstep(d, PLAZA_RADIUS * 0.4, PLAZA_RADIUS + 10);
  return THREE.MathUtils.lerp(2.2, wild, plaza);
}

// Natural night palette — moonlit moss, cool stone, pale shore
const C_GRASS = new THREE.Color(0x2b4234);
const C_GRASS_LIT = new THREE.Color(0x49694c);
const C_SAND = new THREE.Color(0x6e6a5c);
const C_PLAZA = new THREE.Color(0x363b44);

export function buildIslandGeometry(): THREE.BufferGeometry {
  const size = (ISLAND_RADIUS + 20) * 2;
  const segments = 110;
  const plane = new THREE.PlaneGeometry(size, size, segments, segments);
  plane.rotateX(-Math.PI / 2);

  const pos = plane.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    pos.setY(i, islandHeightAt(pos.getX(i), pos.getZ(i)));
  }

  const geometry = plane.toNonIndexed();
  plane.dispose();
  geometry.computeVertexNormals();

  const p = geometry.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const color = new THREE.Color();
  for (let f = 0; f < p.count; f += 3) {
    const cx = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3;
    const cy = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
    const cz = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3;
    const d = Math.hypot(cx, cz);

    if (cy < LOBBY_WATER_LEVEL + 0.6) {
      color.copy(C_SAND);
    } else if (d < PLAZA_RADIUS + 2) {
      color.copy(C_PLAZA);
    } else {
      const lush = THREE.MathUtils.clamp(
        noise(cx * 0.05, cz * 0.05) * 0.5 + 0.5,
        0,
        1,
      );
      color.copy(C_GRASS).lerp(C_GRASS_LIT, lush);
    }
    // faceted variation, same trick as the open world
    color.multiplyScalar(1 + detail(cx * 0.23, cz * 0.23) * 0.08);

    for (let v = 0; v < 3; v += 1) {
      const i = (f + v) * 3;
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}
