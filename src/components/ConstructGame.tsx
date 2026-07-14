"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { Water } from "three/examples/jsm/objects/Water.js";
import {
  VRMLoaderPlugin,
  VRMUtils,
  type VRM,
  VRMHumanBoneName,
} from "@pixiv/three-vrm";
import { arena, storefronts } from "@/lib/content";
import {
  LobbyClient,
  type ChatMessage,
  type LobbyStatus,
  type PeerInfo,
} from "@/lib/lobby";

const EYE_HEIGHT = 2.2;
const MOVE_SPEED = 12;
const REVEAL_RADIUS = 13;
// The Superdome closes off the far end of the street. Walking into this
// forecourt zone (centered on the entrance) lets the visitor press E to enter.
const ARENA_ENTRANCE = { x: 0, z: -104, radius: 12 };
const ARENA_HREF = "/rabbit-hole/venue";

// The huge Ferris wheel stands on a platform beside the Colossus, off to the
// right of the plaza. Face in the y-z plane (axle along x), so it's seen from
// the side as you come down the pier and looms overhead at the far end.
// speed is negative so the wheel turns clockwise as seen from the boardwalk.
const WHEEL = { x: 54, y: 50, z: -150, radius: 46, cabins: 16, speed: -0.16 };
const WHEEL_BOARD = { x: 54, z: -150, radius: 13 }; // walk-up boarding zone

// The walkable deck: the main walk, a strip across the plaza front, and the
// Ferris-wheel platform to the right of the Colossus. Anything off it is
// railing then ocean, so movement is clamped to this union. The rectangles
// overlap generously so you can round the corner onto the platform without
// snagging on a seam.
function onDeck(x: number, z: number): boolean {
  if (x >= -24 && x <= 24 && z >= -116 && z <= 20) return true; // main walk
  if (x >= -42 && x <= 42 && z >= -124 && z <= -110) return true; // plaza front
  if (x >= 30 && x <= 74 && z >= -182 && z <= -118) return true; // wheel platform
  return false;
}

const ORB_COLORS = [
  "#8fb3ff",
  "#66e0ff",
  "#7dffa8",
  "#f0c36a",
  "#ff8fd6",
  "#ff6b6b",
  "#b28dff",
  "#e8ecff",
];

type ControlMode = "touch" | "gyro";

type SceneApi = {
  upsertPeer(peer: PeerInfo): void;
  movePeer(id: string, x: number, z: number): void;
  removePeer(id: string): void;
  recolorPeer(id: string, color: string): void;
  clearPeers(): void;
};

function subscribeToPointerType(callback: () => void) {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

// The lit sign band over each storefront: unit number + name in its accent.
function makeSignTexture(number: string, name: string, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, canvas.width, 5);
    ctx.fillRect(0, canvas.height - 5, canvas.width, 5);

    ctx.textBaseline = "middle";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 22;
    ctx.textAlign = "left";
    ctx.font = "800 96px Arial";
    ctx.fillStyle = accent;
    ctx.fillText(number, 44, canvas.height / 2 + 4);

    ctx.font = "700 74px Arial";
    ctx.fillStyle = "#dbe5ff";
    ctx.fillText(name.toUpperCase(), 210, canvas.height / 2 + 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The giant marquee over the venue entrance: one monolithic house name, with
// its two rooms lettered into the top corners (left wing / right wing). Driven
// by content.arena.billboard so the copy can be re-lettered from one place.
function makeBillboardTexture(
  name: string,
  leftWing: string,
  rightWing: string,
  subtitle: string,
  accent: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    ctx.textBaseline = "middle";

    // Top-corner wing labels — left room and right room.
    ctx.shadowColor = accent;
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#dbe5ff";
    ctx.font = "800 44px Arial";
    ctx.textAlign = "left";
    ctx.fillText(leftWing.toUpperCase(), 44, 62, 440);
    ctx.textAlign = "right";
    ctx.fillText(rightWing.toUpperCase(), canvas.width - 44, 62, 440);

    // Accent rule separating the corner labels from the house name.
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `${accent}`;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(44, 104);
    ctx.lineTo(canvas.width - 44, 104);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // The monolithic house name, centered and dominant.
    ctx.textAlign = "center";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 40;
    ctx.fillStyle = accent;
    ctx.font = "900 150px Arial";
    ctx.fillText(name.toUpperCase(), canvas.width / 2, 220, canvas.width - 80);

    ctx.shadowBlur = 12;
    ctx.fillStyle = "#8fa0c2";
    ctx.font = "600 42px Arial";
    ctx.fillText(subtitle, canvas.width / 2, 336, canvas.width - 90);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// --- Studio wall content (client-safe mirror of lib/studios) ----------------

type WallKind = "empty" | "image" | "website" | "youtube";
type WallSlot = { id: string; kind: WallKind; src: string; title: string };
type PublicStudio = {
  unit: string;
  claimed: boolean;
  studioName: string;
  proprietor: string;
  tagline: string;
  walls: WallSlot[];
  vrmSrc: string;
  avatarScale: number;
  avatarYaw: number;
};

function parseYouTubeId(input: string): string | null {
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

// The image URL to load onto a wall: uploads are same-origin, everything else
// (external images, YouTube thumbnails) goes through our proxy to dodge CORS.
function wallImageUrl(wall: WallSlot): string | null {
  if (wall.kind === "image") {
    if (!wall.src) return null;
    return wall.src.startsWith("/api/uploads")
      ? wall.src
      : `/api/proxy?url=${encodeURIComponent(wall.src)}`;
  }
  if (wall.kind === "youtube") {
    const id = parseYouTubeId(wall.src);
    if (!id) return null;
    return `/api/proxy?url=${encodeURIComponent(
      `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    )}`;
  }
  if (wall.kind === "website") {
    if (!/^https?:\/\//i.test(wall.src)) return null;
    // A rendered snapshot of the site's front page, served as an image.
    return `/api/shot?url=${encodeURIComponent(wall.src)}`;
  }
  return null;
}

// A blank framed panel for empty wall slots.
function makeBlankPosterTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 288;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0b1019";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(143,179,255,0.16)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A website slot renders as a poster naming the destination.
function makeWebsitePosterTexture(url: string, title: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }
  if (ctx) {
    ctx.fillStyle = "#0c1220";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(143,179,255,0.5)";
    ctx.lineWidth = 6;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
    ctx.textAlign = "center";
    ctx.fillStyle = "#dbe5ff";
    ctx.font = "800 48px Arial";
    ctx.fillText(title || host, canvas.width / 2, 170, canvas.width - 80);
    ctx.fillStyle = "#8fb3ff";
    ctx.font = "600 30px Arial";
    ctx.fillText(host, canvas.width / 2, 220, canvas.width - 80);
    ctx.fillStyle = "#8b93a7";
    ctx.font = "500 24px Arial";
    ctx.fillText("click to visit", canvas.width / 2, 290);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A translucent play triangle shown over video posters.
function makePlayBadgeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(6,10,18,0.72)";
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(50, 40);
    ctx.lineTo(50, 88);
    ctx.lineTo(92, 64);
    ctx.closePath();
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePeerLabelTexture(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.font = "700 40px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#0b1020";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#e8ecff";
    ctx.fillText(text, 256, 48);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,0.85)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.28)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

// --- The pier over the ocean: sun, sky, water, and weathered planks ---------

// One sun drives everything: the disc in the sky shader, the glitter path on
// the water, and the key light on uploaded avatars. Low over the water,
// slightly left of the pier's axis so it hangs beside the Colossus.
const SUN_DIR = new THREE.Vector3(-0.45, 0.1, -0.85).normalize();
// The sky, water, fog, lights, and lanterns are all driven by the sun's height
// above the horizon, which in turn comes from the real local time in Alabama
// (US Central). These palette stops are keyed on that elevation, in degrees:
// deep night through the warm horizon of sunrise/sunset up to bright noon.
// Everything in between is linearly interpolated, so the world eases through
// dawn, day, golden hour, dusk, and a starry night over the course of a day.
type SkyStop = {
  elev: number;
  zenith: number;
  horizon: number;
  sunCore: number;
  sunGlow: number;
  fog: number;
  water: number;
  waterSun: number;
  cloud: number; // cloud body tint at this time
  night: number; // 0 = full day, 1 = full night (stars, lit lanterns)
};

const SKY_STOPS: SkyStop[] = [
  // midnight — deep blue dark, faint moon-side glow, stars out
  { elev: -90, zenith: 0x030612, horizon: 0x0a1430, sunCore: 0x000000,
    sunGlow: 0x1b2b52, fog: 0x0a1226, water: 0x030910, waterSun: 0x2b3f6b,
    cloud: 0x141d33, night: 1 },
  // astronomical twilight
  { elev: -10, zenith: 0x0a1a3e, horizon: 0x2c2a54, sunCore: 0x000000,
    sunGlow: 0x54406e, fog: 0x1a1e3a, water: 0x081426, waterSun: 0x6a4f7a,
    cloud: 0x2a2740, night: 0.8 },
  // sun on the horizon — the warm sunrise/sunset band
  { elev: 0, zenith: 0x214f8f, horizon: 0xff8a4d, sunCore: 0xfff2d6,
    sunGlow: 0xff9a55, fog: 0xe0915f, water: 0x123246, waterSun: 0xffb066,
    cloud: 0x9a6a63, night: 0.28 },
  // golden hour
  { elev: 8, zenith: 0x2b63b0, horizon: 0xffd9a0, sunCore: 0xfff6e2,
    sunGlow: 0xffcaa0, fog: 0xd9b48c, water: 0x16506e, waterSun: 0xffdca8,
    cloud: 0xc79a86, night: 0 },
  // full daylight — pretty blues
  { elev: 30, zenith: 0x1f6fd8, horizon: 0xbcd8f2, sunCore: 0xfffdf5,
    sunGlow: 0xffe9c0, fog: 0xcfe0f0, water: 0x135a86, waterSun: 0xfff0d0,
    cloud: 0xeaf1fb, night: 0 },
  // high noon — deepest sky blue overhead
  { elev: 70, zenith: 0x1663d6, horizon: 0xcfe6fb, sunCore: 0xffffff,
    sunGlow: 0xfff0d0, fog: 0xd6e8f6, water: 0x106ea0, waterSun: 0xffffff,
    cloud: 0xffffff, night: 0 },
];

type SkyState = {
  zenith: THREE.Color;
  horizon: THREE.Color;
  sunCore: THREE.Color;
  sunGlow: THREE.Color;
  fog: THREE.Color;
  water: THREE.Color;
  waterSun: THREE.Color;
  cloud: THREE.Color;
  night: number;
};

// Interpolate the palette for a given sun elevation (degrees).
function sampleSky(elevDeg: number): SkyState {
  let lo = SKY_STOPS[0];
  let hi = SKY_STOPS[SKY_STOPS.length - 1];
  for (let i = 0; i < SKY_STOPS.length - 1; i += 1) {
    if (elevDeg >= SKY_STOPS[i].elev && elevDeg <= SKY_STOPS[i + 1].elev) {
      lo = SKY_STOPS[i];
      hi = SKY_STOPS[i + 1];
      break;
    }
  }
  const span = hi.elev - lo.elev;
  const t = span > 0 ? THREE.MathUtils.clamp((elevDeg - lo.elev) / span, 0, 1) : 0;
  const mix = (a: number, b: number) =>
    new THREE.Color(a).lerp(new THREE.Color(b), t);
  return {
    zenith: mix(lo.zenith, hi.zenith),
    horizon: mix(lo.horizon, hi.horizon),
    sunCore: mix(lo.sunCore, hi.sunCore),
    sunGlow: mix(lo.sunGlow, hi.sunGlow),
    fog: mix(lo.fog, hi.fog),
    water: mix(lo.water, hi.water),
    waterSun: mix(lo.waterSun, hi.waterSun),
    cloud: mix(lo.cloud, hi.cloud),
    night: THREE.MathUtils.lerp(lo.night, hi.night, t),
  };
}

// A real-ish solar model for Montgomery, Alabama: given the local hour and the
// day of the year, it returns the sun's elevation and azimuth, so sunrise and
// sunset track the season (long summer evenings, short winter days) the way
// they actually do there. Close enough to read as "the actual time of day"
// without pulling in a full ephemeris library.
const MONTGOMERY_LAT = THREE.MathUtils.degToRad(32.36);

type SolarPos = { elevDeg: number; azimuth: number };
function solarPosition(hour: number, dayOfYear: number): SolarPos {
  const decl =
    THREE.MathUtils.degToRad(23.44) *
    Math.sin((2 * Math.PI * (dayOfYear + 284)) / 365); // solar declination
  const H = THREE.MathUtils.degToRad(15 * (hour - 12)); // hour angle from noon
  const sinE =
    Math.sin(MONTGOMERY_LAT) * Math.sin(decl) +
    Math.cos(MONTGOMERY_LAT) * Math.cos(decl) * Math.cos(H);
  const e = Math.asin(THREE.MathUtils.clamp(sinE, -1, 1));
  const cosA =
    (Math.sin(decl) - Math.sin(MONTGOMERY_LAT) * Math.sin(e)) /
    (Math.cos(MONTGOMERY_LAT) * Math.cos(e) + 1e-6);
  let A = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1)); // azimuth from north
  if (Math.sin(H) > 0) A = 2 * Math.PI - A; // afternoon → swing west
  return { elevDeg: THREE.MathUtils.radToDeg(e), azimuth: A };
}

// World layout: +x is east, -z is south (toward the Colossus), so the sun
// rises over one railing, crosses high above the pier, and sets over the other.
function sunDirFromSolar(
  elevDeg: number,
  azimuth: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const e = THREE.MathUtils.degToRad(elevDeg);
  const ce = Math.cos(e);
  return out
    .set(ce * Math.sin(azimuth), Math.sin(e), ce * Math.cos(azimuth))
    .normalize();
}

function dayOfYear(year: number, month: number, day: number): number {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  let n = day;
  for (let m = 0; m < month - 1; m += 1) n += m === 1 && leap ? 29 : days[m];
  return n;
}

// The current local hour (0–24) and day-of-year in Alabama's zone (US Central).
function alabamaNow(): { hour: number; doy: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const hour =
    (get("hour") % 24) + get("minute") / 60 + get("second") / 3600;
  return { hour, doy: dayOfYear(get("year"), get("month"), get("day")) };
}

// Gradient sky dome with the sun disc, its glow, and drifting fbm clouds all
// computed per-pixel, so the sun stays aligned with the water's reflection.
const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vDir = wp.xyz - cameraPosition;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  uniform vec3 uSunDir;
  uniform vec3 uMoonDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunCore;
  uniform vec3 uSunGlow;
  uniform vec3 uCloud;
  uniform float uNight;
  uniform float uTime;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  // A twinkling star field: bin the view direction into cells, drop a bright
  // star into the sparse ones, and pulse each at its own rate.
  float stars(vec3 dir) {
    vec2 uv = vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0)));
    uv *= vec2(28.0, 34.0);
    vec2 cell = floor(uv);
    vec2 f = fract(uv) - 0.5;
    float rnd = hash(cell);
    float present = step(0.93, rnd);
    vec2 pos = (vec2(hash(cell + 1.7), hash(cell + 4.3)) - 0.5) * 0.7;
    float d = length(f - pos);
    float star = present * smoothstep(0.09, 0.0, d);
    float twinkle = 0.55 + 0.45 * sin(uTime * (1.5 + 3.5 * hash(cell + 9.1)) + rnd * 40.0);
    return star * twinkle * smoothstep(0.02, 0.2, dir.y); // fade near horizon
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    float t = pow(clamp((h + 0.04) / 0.65, 0.0, 1.0), 0.75);
    vec3 col = mix(uHorizon, uZenith, t);

    // Stars first, so clouds and the moon can sit in front of them.
    col += vec3(0.85, 0.9, 1.0) * stars(dir) * uNight;

    // Moon: a soft disc with a cool halo, only out at night.
    if (uNight > 0.01) {
      float m = clamp(dot(dir, uMoonDir), 0.0, 1.0);
      col += vec3(0.5, 0.6, 0.85) * pow(m, 180.0) * 0.5 * uNight;
      col = mix(col, vec3(0.92, 0.94, 1.0),
        smoothstep(0.9994, 0.99965, m) * uNight);
    }

    // Warm wash and halo around the sun, then the disc itself (daytime only —
    // the palette's sunGlow already goes dark once the sun is down).
    float d = clamp(dot(dir, uSunDir), 0.0, 1.0);
    col = mix(col, uSunGlow, pow(d, 6.0) * 0.5);
    col += uSunGlow * pow(d, 64.0) * 0.6;
    col = mix(col, uSunCore, smoothstep(0.99935, 0.99965, d) * (1.0 - uNight));

    // A slow-drifting cloud deck, tinted by the time of day.
    if (h > 0.015) {
      vec2 p = dir.xz / (h + 0.18) * 1.6 + vec2(uTime * 0.006, uTime * 0.0015);
      float cov = fbm(p);
      float cl = smoothstep(0.52, 0.8, cov) * smoothstep(0.015, 0.09, h);
      vec3 cloud = mix(uCloud, uCloud * 0.55, smoothstep(0.5, 0.95, cov));
      cloud += uSunGlow * pow(d, 3.0) * 0.35 * (1.0 - uNight);
      col = mix(col, cloud, cl * 0.8 * (1.0 - 0.35 * uNight));
    }

    gl_FragColor = vec4(col, 1.0);
  }
`;

// --- Procedural boardwalk decking ------------------------------------------
// A world-space wood shader for the deck: planks run along the pier (z), each
// board carved out with staggered butt joints, dark seams, domain-warped grain
// with growth-ring streaks and knots, iron nail heads, and a faint darker
// runner down the center so the "main road" still reads. Dusk-lit and fogged
// to sit under the same sky as everything else. Because it's driven by world
// coordinates it never tiles or repeats the way a bitmap would.
const WOOD_VERTEX = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WOOD_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec3 vWorldPos;
  uniform vec3 uSunDir;
  uniform vec3 uSunGlow;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uRunnerHalf;    // center runner half-width, in metres
  uniform float uRunnerZ;       // runner only ahead of this z (down the walk)
  uniform float uNight;         // 0 = day, 1 = night (darker deck, lit lamps)
  uniform vec2 uLampPos[12];    // lantern xz positions on the walk
  uniform float uLampGlow;      // how strongly the lanterns pool light (night)

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
      mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
    return v;
  }

  void main() {
    float wx = vWorldPos.x;
    float wz = vWorldPos.z;

    // --- planks across x -----------------------------------------------------
    float plankW = 0.42;
    float pf = wx / plankW;
    float pid = floor(pf);
    float pu = fract(pf);           // 0..1 across the plank
    float rp = hash(pid * 1.7);

    // --- boards along z (staggered butt joints per plank) --------------------
    float boardLen = mix(3.4, 6.2, hash(pid * 2.3 + 5.0));
    float zoff = rp * 11.0;
    float bf = (wz + zoff) / boardLen;
    float bid = floor(bf);
    float bu = fract(bf);           // 0..1 along the board
    float seed = hash2(vec2(pid, bid));

    // --- base tone: dark, warm, weathered; varies per board ------------------
    vec3 dark = vec3(0.115, 0.070, 0.038);
    vec3 mid = vec3(0.260, 0.160, 0.086);
    vec3 base = mix(dark, mid, 0.35 + 0.5 * seed);

    // long grain fibres running the board's length
    float fibre = fbm(vec2(pu * 26.0 + seed * 40.0, (wz + zoff) * 1.1));
    base *= mix(0.82, 1.12, fibre);

    // growth rings: warped bands along the plank width
    float warp = fbm(vec2(pu * 3.0 + seed * 10.0, (wz + zoff) * 0.35)) * 2.2;
    float rings = abs(sin((pu * 7.5 + warp + (wz + zoff) * 0.05) * 3.14159));
    base = mix(base, base * 0.55, pow(rings, 3.0) * 0.6);

    // an occasional dark knot
    float kn = fbm(vec2(pid * 3.1, floor((wz + zoff) * 0.5)) * 1.3);
    if (kn > 0.83) {
      vec2 kc = vec2((hash(pid) - 0.5) * 0.4 + 0.5, 0.5);
      float kd = length((vec2(pu, bu) - kc) * vec2(1.0, 0.5));
      base = mix(base * 0.4, base, smoothstep(0.02, 0.09, kd));
    }

    // weathering blotches, low frequency
    base *= mix(0.86, 1.06, fbm(vec2(wx * 0.5, wz * 0.5)));

    // --- carpentry: seams, joints, chamfered edges, nails --------------------
    // dark groove between planks, with a lit chamfer just inside each edge
    float seam = smoothstep(0.0, 0.05, pu) * smoothstep(1.0, 0.95, pu);
    base *= mix(0.28, 1.0, seam);
    float chamfer = smoothstep(0.05, 0.12, pu) * smoothstep(0.95, 0.88, pu);
    base *= mix(1.0, 1.08, chamfer);

    // butt joint groove across the board ends
    float joint = smoothstep(0.0, 0.02, bu) * smoothstep(1.0, 0.982, bu);
    base *= mix(0.32, 1.0, joint);

    // two iron nail heads near each board end
    float nail = 1.0;
    for (int e = 0; e < 2; e++) {
      float bz = e == 0 ? 0.06 : 0.94;
      for (int s = 0; s < 2; s++) {
        float bx = s == 0 ? 0.28 : 0.72;
        float nd = length((vec2(pu, bu) - vec2(bx, bz)) * vec2(1.0, 2.2));
        nail *= mix(0.45, 1.0, smoothstep(0.018, 0.03, nd));
        // tiny specular pip on the nail head
        if (nd < 0.02) base += uSunGlow * 0.10;
      }
    }
    base *= nail;

    // --- faint central runner (the pier's "road") ----------------------------
    float runner = (1.0 - smoothstep(uRunnerHalf - 2.0, uRunnerHalf, abs(wx)))
                 * step(uRunnerZ, wz);
    base *= mix(1.0, 0.72, runner * 0.6);

    // --- daylight, sheen, lantern pools, and fog -----------------------------
    vec3 V = normalize(cameraPosition - vWorldPos);
    float graze = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);   // low angles catch sky
    base += uSunGlow * graze * 0.06 * (1.0 - uNight);

    // Sky-driven brightness: bright by day, sinking to a dim moonlit floor at
    // night so the lanterns and neon do the lighting instead.
    float daylight = clamp(uSunDir.y + 0.85, 0.0, 1.0);
    base *= mix(0.16, 1.0, daylight);

    // Warm pools of light spilling onto the deck under each lit lantern.
    if (uLampGlow > 0.001) {
      vec3 warm = vec3(1.0, 0.72, 0.38);
      float pool = 0.0;
      for (int i = 0; i < 12; i++) {
        float d2 = dot(vWorldPos.xz - uLampPos[i], vWorldPos.xz - uLampPos[i]);
        pool += exp(-d2 * 0.11);
      }
      base += warm * pool * uLampGlow * (0.7 + 0.3 * fibre);
    }

    float dist = length(cameraPosition - vWorldPos);
    float fogF = clamp((uFogFar - dist) / (uFogFar - uFogNear), 0.0, 1.0);
    vec3 col = mix(uFogColor, base, fogF);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// --- Weathered patchwork walls ---------------------------------------------
// The shop shells get a rustic, mismatched-panel skin: a jittered grid of
// patches, each randomly old wood boards or a rusted metal sheet, with
// staggered seams, rust and water streaks bleeding downward, grime pooling
// low and sun-bleach up high, and scattered nail heads. World-space and
// normal-aware, so it wraps every wall of every unit without repeating, and
// it shares the day/night lighting, lantern wash, and fog with the deck.
const WALL_VERTEX = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vWorldNormal = mat3(modelMatrix) * normal;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WALL_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  uniform vec3 uSunDir;
  uniform vec3 uSunGlow;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uNight;
  uniform vec2 uLampPos[12];
  uniform float uLampGlow;

  float hash(float n) { return fract(sin(n) * 43758.5453123); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x),
      mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
    return v;
  }

  // The rustic material a patch is made of, chosen by its random id.
  vec3 patchTone(float r) {
    if (r < 0.34) return vec3(0.17, 0.115, 0.072);      // weathered brown board
    if (r < 0.60) return vec3(0.135, 0.145, 0.155);     // grey driftwood plank
    if (r < 0.80) return vec3(0.205, 0.120, 0.075);     // rusted iron sheet
    return vec3(0.095, 0.140, 0.150);                   // faded painted panel
  }

  void main() {
    vec3 n = normalize(vWorldNormal);
    // Parameterize the wall surface: vertical is world y, horizontal is
    // whichever ground axis runs along this face.
    float horiz = abs(n.x) > abs(n.z) ? vWorldPos.z : vWorldPos.x;
    float vert = vWorldPos.y;

    // Jittered patch grid: rows of varying height, columns of varying width,
    // offset per row so the seams never line up.
    float row = floor(vert / 2.15);
    float hoff = hash(row * 1.3) * 3.4;
    float colW = mix(1.5, 3.6, hash(row * 2.1 + 0.5));
    float col = floor((horiz + hoff) / colW);
    vec2 pid = vec2(col, row);
    float pr = hash2(pid);

    vec3 base = patchTone(hash(pr * 7.0));
    base *= mix(0.72, 1.22, hash2(pid + 3.3)); // per-patch brightness variance

    float pu = fract((horiz + hoff) / colW); // 0..1 across the patch
    float pv = fract(vert / 2.15);           // 0..1 up the patch

    // Wood patches get horizontal boards + grain; metal patches get vertical
    // streaks and a rivet line down each side.
    float ptype = hash2(pid + 9.1);
    if (ptype < 0.55) {
      float pitch = mix(0.22, 0.4, hash2(pid + 1.1));
      float board = fract(vert / pitch);
      base *= mix(0.62, 1.06,
        smoothstep(0.0, 0.09, board) * smoothstep(1.0, 0.9, board));
      base *= mix(0.82, 1.12, fbm(vec2(horiz * 3.5, vert * 22.0)));
    } else {
      base *= mix(0.8, 1.08, fbm(vec2(horiz * 7.0, vert * 0.7)));
      // rivets: two vertical rows near the patch edges
      float rr = min(
        smoothstep(0.04, 0.02, abs(pu - 0.1)),
        1.0) + smoothstep(0.04, 0.02, abs(pu - 0.9));
      float rivetY = smoothstep(0.14, 0.0, abs(fract(vert / 0.45) - 0.5));
      base *= 1.0 - 0.5 * rr * rivetY;
    }

    // Dark seams / gaps between patches.
    float seam = smoothstep(0.0, 0.028, pu) * smoothstep(1.0, 0.972, pu)
               * smoothstep(0.0, 0.03, pv) * smoothstep(1.0, 0.965, pv);
    base *= mix(0.34, 1.0, seam);

    // Rust and water streaks bleeding down the face, heavier lower.
    float streak = fbm(vec2(horiz * 2.6, vert * 0.14));
    float streakMask = smoothstep(0.55, 0.82, streak)
      * (0.35 + 0.65 * (1.0 - clamp(vert / 7.0, 0.0, 1.0)));
    base = mix(base, vec3(0.16, 0.075, 0.04), streakMask * 0.4);

    // Grime pooling near the deck, sun-bleaching toward the top.
    base *= mix(0.66, 1.1, clamp(vert / 7.0, 0.0, 1.0));
    base *= mix(0.9, 1.06, fbm(vec2(horiz * 0.6, vert * 0.6))); // blotchy age

    // A nail head near each patch corner.
    vec2 cc = (vec2(pu, pv) - 0.5);
    float nd = length(vec2(abs(cc.x) - 0.42, abs(cc.y) - 0.42) * vec2(1.0, 1.6));
    base *= mix(0.5, 1.0, smoothstep(0.02, 0.04, nd));

    // --- shared day/night lighting, lantern wash, and fog --------------------
    float daylight = clamp(uSunDir.y + 0.85, 0.0, 1.0);
    float ndl = max(dot(n, uSunDir), 0.0);
    base *= 0.72 + 0.4 * ndl * daylight; // faces toward the sun read brighter
    base *= mix(0.14, 1.0, daylight);

    if (uLampGlow > 0.001) {
      vec3 warm = vec3(1.0, 0.72, 0.38);
      float pool = 0.0;
      for (int i = 0; i < 12; i++) {
        vec2 dp = vWorldPos.xz - uLampPos[i];
        float d2 = dot(dp, dp) + (vert - 3.2) * (vert - 3.2);
        pool += exp(-d2 * 0.07);
      }
      base += warm * pool * uLampGlow * 0.6;
    }

    float dist = length(cameraPosition - vWorldPos);
    float fogF = clamp((uFogFar - dist) / (uFogFar - uFogNear), 0.0, 1.0);
    gl_FragColor = vec4(mix(uFogColor, base, fogF), 1.0);
  }
`;

// --- Device-orientation camera quaternion (AR-style look) -------------------

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const ZEE = new THREE.Vector3(0, 0, 1);
const orientEuler = new THREE.Euler();
const qScreen = new THREE.Quaternion();
const Q_FLIP = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

function setQuaternionFromOrientation(
  quaternion: THREE.Quaternion,
  alpha: number,
  beta: number,
  gamma: number,
  screenAngle: number,
) {
  orientEuler.set(beta, alpha, -gamma, "YXZ");
  quaternion.setFromEuler(orientEuler);
  quaternion.multiply(Q_FLIP); // camera looks out the back of the device
  quaternion.multiply(qScreen.setFromAxisAngle(ZEE, -screenAngle));
}

export default function ConstructGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const lockFnRef = useRef<(() => void) | null>(null);
  const modeRef = useRef<ControlMode>("touch");
  const lobbyRef = useRef<LobbyClient | null>(null);
  const sceneApiRef = useRef<SceneApi | null>(null);
  const sendMoveRef = useRef<
    ((x: number, z: number, yaw: number) => void) | null
  >(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef("");
  const colorRef = useRef(ORB_COLORS[0]);
  const wallApiRef = useRef<{
    applyStudios: (studios: PublicStudio[]) => void;
    applyWall: (unit: string, wall: WallSlot) => void;
    applySign: (unit: string, name: string) => void;
    applyAvatar: (
      unit: string,
      vrmSrc: string,
      avatarScale: number,
      avatarYaw: number,
    ) => void;
  } | null>(null);
  const studiosRef = useRef<Map<string, PublicStudio>>(new Map());
  const ownedRef = useRef<Set<string>>(new Set());
  const overlayOpenRef = useRef(false);
  // Ferris wheel: refs bridge the render loop (proximity, ride camera) and the
  // React HUD (walk-up prompt, exit button).
  const nearWheelRef = useRef(false);
  const ridingRef = useRef(false);
  const rideControlRef = useRef<{ board: () => void; exit: () => void } | null>(
    null,
  );

  const router = useRouter();
  const [locked, setLocked] = useState(false);
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState<ControlMode>("touch");
  const [nearStore, setNearStore] = useState<number>(-1);
  const [nearArena, setNearArena] = useState(false);
  const [nearWheel, setNearWheel] = useState(false);
  const [riding, setRiding] = useState(false);
  const [focusedWall, setFocusedWall] = useState<{
    unit: string;
    wallId: string;
  } | null>(null);
  const [viewer, setViewer] = useState<{
    kind: WallKind;
    src: string;
    title: string;
  } | null>(null);
  const [editor, setEditor] = useState<(WallSlot & { unit: string }) | null>(
    null,
  );
  const [wallBusy, setWallBusy] = useState(false);
  const [wallError, setWallError] = useState("");
  const editorFileRef = useRef<HTMLInputElement>(null);
  // Talk-to-the-dog chat (the site guide living in Unit 01).
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideMsgs, setGuideMsgs] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [guideInput, setGuideInput] = useState("");
  const [guideBusy, setGuideBusy] = useState(false);
  const [guideSpeak, setGuideSpeak] = useState(true); // read replies aloud
  const guideAudioRef = useRef<HTMLAudioElement | null>(null);
  const guideScrollRef = useRef<HTMLDivElement>(null);
  // Reactive copies of the studio data for the HUD (refs feed the scene/effects)
  const [studioMap, setStudioMap] = useState<Map<string, PublicStudio>>(
    new Map(),
  );
  const [ownedUnits, setOwnedUnits] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [color, setColor] = useState(ORB_COLORS[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [online, setOnline] = useState(1);
  const [lobbyStatus, setLobbyStatus] = useState<LobbyStatus>("connecting");
  const isTouch = useSyncExternalStore(
    subscribeToPointerType,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );

  // saved identity + default chat visibility (desktop open, mobile closed);
  // localStorage is client-only, so this can't be a state initializer
  useEffect(() => {
    const savedName = localStorage.getItem("construct-name");
    const savedColor = localStorage.getItem("construct-color");
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(savedName || `guest-${Math.floor(1000 + Math.random() * 9000)}`);
    if (savedColor && ORB_COLORS.includes(savedColor)) setColor(savedColor);
    setChatOpen(!window.matchMedia("(pointer: coarse)").matches);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: 999999 });
  }, [messages]);

  useEffect(() => {
    guideScrollRef.current?.scrollTo({ top: 999999 });
  }, [guideMsgs, guideBusy]);

  // Stop the dog's voice if the component unmounts mid-sentence.
  useEffect(() => () => stopDogVoice(), []);

  // Load the studios' wall content once inside, and note which units are ours.
  useEffect(() => {
    if (!entered) return;
    let cancelled = false;
    (async () => {
      try {
        const [pub, mine] = await Promise.all([
          fetch("/api/studios/public", { cache: "no-store" }).then((r) =>
            r.ok ? r.json() : { studios: [] },
          ),
          fetch("/api/studio", { cache: "no-store" }).then((r) =>
            r.ok ? r.json() : { studios: [] },
          ),
        ]);
        if (cancelled) return;
        const map = new Map<string, PublicStudio>();
        for (const s of pub.studios ?? []) map.set(s.unit, s);
        const owned = new Set<string>(
          (mine.studios ?? []).map((s: { unit: string }) => s.unit),
        );
        studiosRef.current = map;
        ownedRef.current = owned;
        setStudioMap(map);
        setOwnedUnits(owned);
        wallApiRef.current?.applyStudios([...map.values()]);
      } catch {
        /* studios are non-critical decoration */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entered]);

  useEffect(() => {
    overlayOpenRef.current = !!(viewer || editor || guideOpen);
  }, [viewer, editor, guideOpen]);

  // Press E to interact with the wall under the crosshair: owners edit it,
  // everyone else plays/visits its content. Falls back to a storefront action
  // (the Workshop) when not looking at a wall. Esc closes any overlay.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (event.code === "Escape") {
        if (viewer) setViewer(null);
        else if (editor) setEditor(null);
        return;
      }
      if (event.code !== "KeyE" || viewer || editor) return;
      if (focusedWall) {
        const studio = studiosRef.current.get(focusedWall.unit);
        const wall = studio?.walls.find((w) => w.id === focusedWall.wallId);
        if (wall) {
          if (document.pointerLockElement) document.exitPointerLock();
          if (ownedRef.current.has(focusedWall.unit)) {
            setEditor({ ...wall, unit: focusedWall.unit });
          } else if (wall.kind !== "empty") {
            setViewer({ kind: wall.kind, src: wall.src, title: wall.title });
          }
          return;
        }
      }
      if (nearArena) {
        if (document.pointerLockElement) document.exitPointerLock();
        router.push(ARENA_HREF);
        return;
      }
      const target = nearStore >= 0 ? storefronts[nearStore] : null;
      if (target?.action) {
        if (document.pointerLockElement) document.exitPointerLock();
        router.push(target.action.href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedWall, viewer, editor, nearStore, nearArena, router]);

  const toggleMic = async () => {
    const client = lobbyRef.current;
    if (!client) return;
    if (client.micEnabled) {
      client.disableMic();
      setMicOn(false);
    } else {
      setMicOn(await client.enableMic());
    }
  };

  const pickColor = (value: string) => {
    setColor(value);
    localStorage.setItem("construct-color", value);
    lobbyRef.current?.setColor(value);
  };

  const ensureName = () => {
    const finalName =
      name.trim() || `guest-${Math.floor(1000 + Math.random() * 9000)}`;
    if (finalName !== name) setName(finalName);
    nameRef.current = finalName;
    localStorage.setItem("construct-name", finalName);
  };

  const submitChat = (event: FormEvent) => {
    event.preventDefault();
    const text = chatText.trim();
    if (text) lobbyRef.current?.sendChat(text);
    setChatText("");
  };

  // --- Talk to the dog (the site guide) -------------------------------------
  const stopDogVoice = () => {
    const a = guideAudioRef.current;
    if (a) {
      a.pause();
      if (a.src) URL.revokeObjectURL(a.src);
      a.removeAttribute("src");
    }
  };

  // Read a reply aloud through Fish Audio TTS. Best-effort — if the voice
  // backend isn't set up, the text is still shown in the chat.
  const speakDog = async (text: string) => {
    try {
      const res = await fetch("/api/tts/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      stopDogVoice();
      const audio = guideAudioRef.current ?? new Audio();
      guideAudioRef.current = audio;
      audio.src = URL.createObjectURL(blob);
      void audio.play().catch(() => {});
    } catch {
      /* voice is optional */
    }
  };

  const sendToDog = async (event: FormEvent) => {
    event.preventDefault();
    const text = guideInput.trim();
    if (!text || guideBusy) return;
    const next = [...guideMsgs, { role: "user" as const, content: text }];
    setGuideMsgs(next);
    setGuideInput("");
    setGuideBusy(true);
    try {
      const res = await fetch("/api/guide/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-16) }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string };
      const reply =
        data.reply || "Hmm, I lost my train of thought. Ask me again?";
      setGuideMsgs((m) => [...m, { role: "assistant", content: reply }]);
      if (guideSpeak) void speakDog(reply);
    } catch {
      setGuideMsgs((m) => [
        ...m,
        { role: "assistant", content: "I couldn't hear you just then — try again?" },
      ]);
    } finally {
      setGuideBusy(false);
    }
  };

  const openGuide = () => {
    if (document.pointerLockElement) document.exitPointerLock();
    setGuideOpen(true);
    if (guideMsgs.length === 0) {
      setGuideMsgs([
        {
          role: "assistant",
          content:
            "Woof! I'm Chance, Travis's dog — I show folks around here. Ask me anything about the site.",
        },
      ]);
    }
  };

  const closeGuide = () => {
    stopDogVoice();
    setGuideOpen(false);
  };

  const uploadWallImage = async (file: File) => {
    setWallBusy(true);
    setWallError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/studio/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setEditor((e) => (e ? { ...e, kind: "image", src: data.url } : e));
    } catch (err) {
      setWallError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setWallBusy(false);
    }
  };

  const saveWall = async () => {
    if (!editor) return;
    setWallBusy(true);
    setWallError("");
    const edited: WallSlot = {
      id: editor.id,
      kind: editor.kind,
      src: editor.src,
      title: editor.title,
    };
    const current = studiosRef.current.get(editor.unit);
    const walls = (current?.walls ?? [edited]).map((w) =>
      w.id === editor.id ? edited : w,
    );
    try {
      const res = await fetch("/api/studio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit: editor.unit, walls }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      const saved = data.studio as PublicStudio;
      const entry: PublicStudio = {
        unit: saved.unit,
        // Editing walls is owner-only, so this unit is claimed; the PATCH
        // payload doesn't carry `claimed`, so keep the current flag.
        claimed: current?.claimed ?? true,
        studioName: saved.studioName,
        proprietor: saved.proprietor ?? current?.proprietor ?? "",
        tagline: saved.tagline ?? current?.tagline ?? "",
        walls: saved.walls,
        vrmSrc: saved.vrmSrc ?? current?.vrmSrc ?? "",
        avatarScale: saved.avatarScale ?? current?.avatarScale ?? 1,
        avatarYaw: saved.avatarYaw ?? current?.avatarYaw ?? 0,
      };
      studiosRef.current.set(saved.unit, entry);
      setStudioMap((prev) => new Map(prev).set(saved.unit, entry));
      wallApiRef.current?.applySign(saved.unit, saved.studioName);
      for (const w of saved.walls) wallApiRef.current?.applyWall(saved.unit, w);
      setEditor(null);
    } catch (err) {
      setWallError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setWallBusy(false);
    }
  };

  const enterTouch = async (wantGyro: boolean) => {
    let nextMode: ControlMode = "touch";
    if (wantGyro) {
      // iOS requires an explicit permission grant from a user gesture
      const OrientationEvent = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      try {
        if (typeof OrientationEvent.requestPermission === "function") {
          const result = await OrientationEvent.requestPermission();
          if (result === "granted") nextMode = "gyro";
        } else {
          nextMode = "gyro";
        }
      } catch {
        nextMode = "touch";
      }
    }
    modeRef.current = nextMode;
    setMode(nextMode);
    ensureName();
    setEntered(true);
  };

  const enterDesktop = () => {
    ensureName();
    setEntered(true);
    lockFnRef.current?.();
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // --- Scene -------------------------------------------------------------
    // The initial hour comes from Alabama's clock, unless a ?t=HH override is
    // present (handy for previewing night, sunrise, etc. without waiting).
    const timeParam = new URLSearchParams(window.location.search).get("t");
    const overrideHour =
      timeParam !== null && timeParam !== "" && Number.isFinite(Number(timeParam))
        ? ((Number(timeParam) % 24) + 24) % 24
        : null;
    // ?cycle=SECONDS runs a whole day in that many seconds, for a quick preview.
    const cycleParam = Number(
      new URLSearchParams(window.location.search).get("cycle"),
    );
    const cycleSeconds = Number.isFinite(cycleParam) && cycleParam > 0 ? cycleParam : 0;

    const startNow = alabamaNow();
    const startDoy = startNow.doy;
    const initialState = sampleSky(
      solarPosition(overrideHour ?? startNow.hour, startDoy).elevDeg,
    );

    const scene = new THREE.Scene();
    scene.background = initialState.horizon.clone();
    scene.fog = new THREE.Fog(initialState.fog.clone(), 90, 850);

    // The world's own surfaces are unlit (MeshBasicMaterial), but uploaded VRM
    // avatars use lit materials — light them to match the sky. Colors and
    // intensities are re-tuned by applyTimeOfDay as the sun moves.
    const ambientLight = new THREE.AmbientLight(0xffe8d0, 1.05);
    scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xffc088, 1.5);
    keyLight.position.copy(SUN_DIR).multiplyScalar(90);
    keyLight.position.y = 25; // lifted a touch so faces aren't pure rim light
    scene.add(keyLight);
    const hemiLight = new THREE.HemisphereLight(0x4a6a9c, 0x2b1d12, 0.7);
    scene.add(hemiLight);

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      3500,
    );
    camera.position.set(0, EYE_HEIGHT, 10);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

    const disposables: { dispose(): void }[] = [];

    // --- The ocean, the sky, and the sun --------------------------------------
    const WATER_Y = -5; // sea level; the deck rides ~5m above it on pilings

    const moonDir = new THREE.Vector3(0.3, 0.5, 0.4).normalize();
    const skyGeo = new THREE.SphereGeometry(1600, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      uniforms: {
        uSunDir: { value: SUN_DIR },
        uMoonDir: { value: moonDir },
        uZenith: { value: initialState.zenith.clone() },
        uHorizon: { value: initialState.horizon.clone() },
        uSunCore: { value: initialState.sunCore.clone() },
        uSunGlow: { value: initialState.sunGlow.clone() },
        uCloud: { value: initialState.cloud.clone() },
        uNight: { value: initialState.night },
        uTime: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
    disposables.push(skyGeo, skyMat);

    // The ocean itself is three.js's own Water (examples/webgl_shaders_ocean):
    // a flat mirror that renders the scene into a reflection texture and rolls
    // the waternormals map across it for moving ripples and a real sun glare.
    const waterGeo = new THREE.PlaneGeometry(4000, 4000);
    const waterNormals = new THREE.TextureLoader().load(
      "/textures/waternormals.jpg",
      (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      },
    );
    const water = new Water(waterGeo, {
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: SUN_DIR.clone(),
      sunColor: initialState.waterSun.getHex(),
      waterColor: initialState.water.getHex(),
      distortionScale: 3.7,
      fog: scene.fog !== undefined,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER_Y;
    scene.add(water);
    disposables.push(waterGeo, waterNormals, water.material);

    // --- The pier: an elevated boardwalk carrying the whole block -------------
    // The main walk holds the ten shops; it widens into a plaza under the
    // Colossus at the far end. Deck top sits at y=0 so the street's original
    // coordinates all still hold.
    const PIER_HALF_W = 26; // main walk half-width
    const PLAZA_HALF_W = 46; // wide platform under the Colossus
    const PIER_START_Z = 26; // near end, behind the spawn point
    const PLAZA_START_Z = -114; // where the walk widens
    const PIER_END_Z = -204; // far end, past the dome

    // The procedural wood shader, shared across every deck surface so the
    // grain runs continuously from the walk out onto the plaza.
    // Lantern positions on the walk (gaps between shopfronts), shared by the
    // lamp meshes below and the deck shader's warm light pools.
    const LAMP_XZ: [number, number][] = [];
    for (const lz of [4, -24, -44, -64, -84, -104]) {
      for (const lx of [-8.4, 8.4]) LAMP_XZ.push([lx, lz]);
    }

    const woodMat = new THREE.ShaderMaterial({
      vertexShader: WOOD_VERTEX,
      fragmentShader: WOOD_FRAGMENT,
      uniforms: {
        uSunDir: { value: SUN_DIR },
        uSunGlow: { value: initialState.sunGlow.clone() },
        uFogColor: { value: initialState.fog.clone() },
        uFogNear: { value: 90 },
        uFogFar: { value: 850 },
        uRunnerHalf: { value: 9 },
        uRunnerZ: { value: PLAZA_START_Z },
        uNight: { value: initialState.night },
        uLampPos: { value: LAMP_XZ.map(([x, z]) => new THREE.Vector2(x, z)) },
        uLampGlow: { value: 0 },
      },
    });
    disposables.push(woodMat);

    // Weathered patchwork skin shared by every shop wall (see WALL_FRAGMENT).
    const wallMat = new THREE.ShaderMaterial({
      vertexShader: WALL_VERTEX,
      fragmentShader: WALL_FRAGMENT,
      uniforms: {
        uSunDir: { value: SUN_DIR },
        uSunGlow: { value: initialState.sunGlow.clone() },
        uFogColor: { value: initialState.fog.clone() },
        uFogNear: { value: 90 },
        uFogFar: { value: 850 },
        uNight: { value: initialState.night },
        uLampPos: { value: LAMP_XZ.map(([x, z]) => new THREE.Vector2(x, z)) },
        uLampGlow: { value: 0 },
      },
    });
    disposables.push(wallMat);

    const deckSlabMat = new THREE.MeshBasicMaterial({ color: 0x1c1409 });
    disposables.push(deckSlabMat);

    const walkLen = PIER_START_Z - PLAZA_START_Z;
    const walkSlabGeo = new THREE.BoxGeometry(PIER_HALF_W * 2, 0.9, walkLen);
    const walkSlab = new THREE.Mesh(walkSlabGeo, deckSlabMat);
    walkSlab.position.set(0, -0.45, (PIER_START_Z + PLAZA_START_Z) / 2);
    scene.add(walkSlab);
    disposables.push(walkSlabGeo);

    const plazaLen = PLAZA_START_Z - PIER_END_Z;
    const plazaSlabGeo = new THREE.BoxGeometry(PLAZA_HALF_W * 2, 0.9, plazaLen);
    const plazaSlab = new THREE.Mesh(plazaSlabGeo, deckSlabMat);
    plazaSlab.position.set(0, -0.45, (PLAZA_START_Z + PIER_END_Z) / 2);
    scene.add(plazaSlab);
    disposables.push(plazaSlabGeo);

    // Plank decking laid over each slab, all sharing the one wood shader so the
    // grain, seams, and center runner are continuous across the whole pier.
    const addDeckTop = (w: number, l: number, z: number) => {
      const geo = new THREE.PlaneGeometry(w, l);
      const mesh = new THREE.Mesh(geo, woodMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, 0.01, z);
      scene.add(mesh);
      disposables.push(geo);
    };
    addDeckTop(PIER_HALF_W * 2, walkLen, (PIER_START_Z + PLAZA_START_Z) / 2);
    addDeckTop(PLAZA_HALF_W * 2, plazaLen, (PLAZA_START_Z + PIER_END_Z) / 2);

    // Pilings marching down into the water along every deck edge.
    const pilingGeo = new THREE.CylinderGeometry(0.5, 0.5, 9.5, 10);
    const pilingMat = new THREE.MeshBasicMaterial({ color: 0x2e2318 });
    disposables.push(pilingGeo, pilingMat);
    const pilingSpots: [number, number][] = [];
    for (let z = 24; z >= PLAZA_START_Z; z -= 8) {
      pilingSpots.push([-25, z], [25, z]);
    }
    for (let z = PLAZA_START_Z - 4; z >= PIER_END_Z + 2; z -= 8) {
      pilingSpots.push([-45, z], [45, z]);
    }
    for (let x = -44; x <= 44; x += 10) {
      pilingSpots.push([x, PLAZA_START_Z - 2], [x, PIER_END_Z + 2]);
    }
    const pilings = new THREE.InstancedMesh(
      pilingGeo,
      pilingMat,
      pilingSpots.length,
    );
    const pilingPose = new THREE.Matrix4();
    pilingSpots.forEach(([px, pz], i) => {
      pilingPose.setPosition(px, -4.75, pz);
      pilings.setMatrixAt(i, pilingPose);
    });
    scene.add(pilings);

    // Wooden railings around every open edge (past the walkable deck).
    const railMat = new THREE.MeshBasicMaterial({ color: 0x5a4634 });
    disposables.push(railMat);
    const postPoses: THREE.Matrix4[] = [];
    const addRailing = (x1: number, z1: number, x2: number, z2: number) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const yawAngle = Math.atan2(x2 - x1, z2 - z1);
      const cx = (x1 + x2) / 2;
      const cz = (z1 + z2) / 2;
      for (const [ry, h] of [
        [1.12, 0.13],
        [0.64, 0.09],
      ]) {
        const geo = new THREE.BoxGeometry(0.12, h, len);
        const rail = new THREE.Mesh(geo, railMat);
        rail.position.set(cx, ry, cz);
        rail.rotation.y = yawAngle;
        scene.add(rail);
        disposables.push(geo);
      }
      const posts = Math.max(2, Math.round(len / 4) + 1);
      for (let i = 0; i < posts; i += 1) {
        const t = i / (posts - 1);
        const m = new THREE.Matrix4().makeRotationY(yawAngle);
        m.setPosition(x1 + (x2 - x1) * t, 0.55, z1 + (z2 - z1) * t);
        postPoses.push(m);
      }
    };
    const railEdge = PIER_HALF_W - 0.3;
    const plazaEdge = PLAZA_HALF_W - 0.3;
    addRailing(-railEdge, PIER_START_Z - 0.5, railEdge, PIER_START_Z - 0.5);
    addRailing(-railEdge, PIER_START_Z - 0.5, -railEdge, PLAZA_START_Z);
    addRailing(railEdge, PIER_START_Z - 0.5, railEdge, PLAZA_START_Z);
    addRailing(-plazaEdge, PLAZA_START_Z, -railEdge, PLAZA_START_Z);
    addRailing(railEdge, PLAZA_START_Z, plazaEdge, PLAZA_START_Z);
    addRailing(-plazaEdge, PLAZA_START_Z, -plazaEdge, PIER_END_Z + 0.5);
    addRailing(plazaEdge, PLAZA_START_Z, plazaEdge, PIER_END_Z + 0.5);
    addRailing(-plazaEdge, PIER_END_Z + 0.5, plazaEdge, PIER_END_Z + 0.5);
    const postGeoRail = new THREE.BoxGeometry(0.16, 1.2, 0.16);
    disposables.push(postGeoRail);
    const railPosts = new THREE.InstancedMesh(
      postGeoRail,
      railMat,
      postPoses.length,
    );
    postPoses.forEach((m, i) => railPosts.setMatrixAt(i, m));
    scene.add(railPosts);

    // Boardwalk lamps in the gaps between shopfronts. The globe and its glow
    // sprite are toggled from cold/dim by day to warm/bright at night by
    // applyTimeOfDay; the deck shader pools matching light beneath them.
    const lampPostGeo = new THREE.CylinderGeometry(0.07, 0.11, 3.6, 8);
    const lampPostMat = new THREE.MeshBasicMaterial({ color: 0x232833 });
    const lampGlobeGeo = new THREE.SphereGeometry(0.28, 16, 12);
    // Each lamp gets its own globe + glow material so we can animate them.
    const lampGlobeMat = new THREE.MeshBasicMaterial({ color: 0xffdba4 });
    const lampGlowTex = makeGlowTexture();
    disposables.push(lampPostGeo, lampPostMat, lampGlobeGeo, lampGlobeMat, lampGlowTex);
    const lampGlows: THREE.SpriteMaterial[] = [];
    for (const [lx, lz] of LAMP_XZ) {
      const lamp = new THREE.Group();
      lamp.position.set(lx, 0, lz);
      const pole = new THREE.Mesh(lampPostGeo, lampPostMat);
      pole.position.y = 1.8;
      lamp.add(pole);
      const globe = new THREE.Mesh(lampGlobeGeo, lampGlobeMat);
      globe.position.y = 3.75;
      lamp.add(globe);
      const glowMat = new THREE.SpriteMaterial({
        map: lampGlowTex,
        color: 0xffc27a,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.2,
      });
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(2.6, 2.6, 1);
      glow.position.y = 3.75;
      lamp.add(glow);
      lampGlows.push(glowMat);
      disposables.push(glowMat);
      scene.add(lamp);
    }

    // --- Time of day: push the sun to its hour and retune the whole world -----
    const dayKey = new THREE.Color(0xffc088);
    const nightKey = new THREE.Color(0x3a4d78);
    const dayAmbient = new THREE.Color(0xffe8d0);
    const nightAmbient = new THREE.Color(0x2a3a5c);
    let wheelLightAmount = 0; // how lit the Ferris-wheel bulbs are (night → 1)
    const applyTimeOfDay = (hour: number, doy: number) => {
      const sp = solarPosition(hour, doy);
      const elev = sp.elevDeg;
      sunDirFromSolar(elev, sp.azimuth, SUN_DIR); // mutated; sky & wood read it live
      const s = sampleSky(elev);

      // The moon rides opposite the sun, kept above the horizon.
      moonDir
        .set(-SUN_DIR.x, Math.abs(SUN_DIR.y) * 0.5 + 0.4, -SUN_DIR.z)
        .normalize();

      // Sky
      skyMat.uniforms.uZenith.value.copy(s.zenith);
      skyMat.uniforms.uHorizon.value.copy(s.horizon);
      skyMat.uniforms.uSunCore.value.copy(s.sunCore);
      skyMat.uniforms.uSunGlow.value.copy(s.sunGlow);
      skyMat.uniforms.uCloud.value.copy(s.cloud);
      skyMat.uniforms.uNight.value = s.night;

      // Ocean + fog + background
      const wu = (water.material as THREE.ShaderMaterial).uniforms;
      wu.sunDirection.value.copy(SUN_DIR);
      wu.waterColor.value.copy(s.water);
      wu.sunColor.value.copy(s.waterSun);
      scene.fog!.color.copy(s.fog);
      (scene.background as THREE.Color).copy(s.horizon).lerp(s.zenith, 0.5);

      // Deck + shop walls share the palette's glow/fog/night.
      for (const m of [woodMat, wallMat]) {
        m.uniforms.uSunGlow.value.copy(s.sunGlow);
        m.uniforms.uFogColor.value.copy(s.fog);
        m.uniforms.uNight.value = s.night;
      }

      // Lanterns fade up as the sun sinks past ~10°, full once it's down.
      const lampOn = THREE.MathUtils.clamp(
        1 - THREE.MathUtils.smoothstep(elev, 2, 12),
        0,
        1,
      );
      woodMat.uniforms.uLampGlow.value = lampOn * 0.5;
      wallMat.uniforms.uLampGlow.value = lampOn * 0.5;
      wheelLightAmount = lampOn; // the Ferris wheel lights up with the lanterns
      for (const g of lampGlows) g.opacity = THREE.MathUtils.lerp(0.14, 0.95, lampOn);
      lampGlobeMat.color
        .set(0x6a5836)
        .lerp(new THREE.Color(0xfff0c8), lampOn);

      // Scene lights for the (lit) avatars
      const dayAmt = THREE.MathUtils.clamp(
        THREE.MathUtils.smoothstep(elev, -6, 12),
        0,
        1,
      );
      keyLight.position.copy(SUN_DIR).multiplyScalar(90);
      keyLight.position.y = Math.max(12, keyLight.position.y);
      keyLight.color.copy(dayKey).lerp(nightKey, 1 - dayAmt);
      keyLight.intensity = THREE.MathUtils.lerp(0.15, 1.6, dayAmt);
      ambientLight.color.copy(nightAmbient).lerp(dayAmbient, dayAmt);
      ambientLight.intensity = THREE.MathUtils.lerp(0.5, 1.15, dayAmt);
      hemiLight.intensity = THREE.MathUtils.lerp(0.3, 0.8, dayAmt);
    };
    applyTimeOfDay(overrideHour ?? startNow.hour, startDoy);

    // --- The block itself: rentable storefronts along the pier's walk --------
    const STREET_HALF = 9; // half the walk width between the two rows
    const STORE_W = 16; // unit frontage (runs along the walk / z axis)
    const STORE_D = 13; // unit depth (into the building / x axis)
    const STORE_H = 7; // wall height
    const ROW_START_Z = -14; // first unit's center
    const ROW_STEP = STORE_W + 4; // frontage + gap between units

    // Shared geometry across all ten units (built with the opening facing +x).
    const backWallGeo = new THREE.BoxGeometry(0.3, STORE_H, STORE_W);
    const sideWallGeo = new THREE.BoxGeometry(STORE_D, STORE_H, 0.3);
    const ceilGeo = new THREE.BoxGeometry(STORE_D, 0.3, STORE_W);
    const unitFloorGeo = new THREE.BoxGeometry(STORE_D, 0.12, STORE_W);
    const postGeo = new THREE.BoxGeometry(0.5, STORE_H, 0.5);
    const awningGeo = new THREE.BoxGeometry(0.6, 1.5, STORE_W);
    const signGeo = new THREE.PlaneGeometry(STORE_W - 1.4, 1.3);
    const posterGeo = new THREE.PlaneGeometry(6.4, 3.3);
    const posterFrameGeo = new THREE.PlaneGeometry(6.9, 3.8);
    const badgeGeo = new THREE.PlaneGeometry(1.5, 1.5);
    const sillGeo = new THREE.BoxGeometry(0.5, 0.08, STORE_W);
    const blankPosterTex = makeBlankPosterTexture();
    const playBadgeTex = makePlayBadgeTexture();
    const badgeMat = new THREE.MeshBasicMaterial({
      map: playBadgeTex,
      transparent: true,
      depthWrite: false,
    });
    const ceilMat = new THREE.MeshBasicMaterial({ color: 0x0d121b });
    const unitFloorMat = new THREE.MeshBasicMaterial({ color: 0x0e131d });
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x2c3852,
      transparent: true,
      opacity: 0.7,
    });
    const backEdges = new THREE.EdgesGeometry(backWallGeo);
    const sideEdges = new THREE.EdgesGeometry(sideWallGeo);
    disposables.push(
      backWallGeo,
      sideWallGeo,
      ceilGeo,
      unitFloorGeo,
      postGeo,
      awningGeo,
      signGeo,
      posterGeo,
      posterFrameGeo,
      badgeGeo,
      sillGeo,
      ceilMat,
      unitFloorMat,
      edgeMat,
      backEdges,
      sideEdges,
      blankPosterTex,
      playBadgeTex,
      badgeMat,
    );

    // Registry of every wall poster so their textures can be swapped when a
    // studio loads or its owner edits it, and so clicks can be routed.
    type Poster = {
      unit: string;
      wallId: string;
      content: THREE.Mesh;
      material: THREE.MeshBasicMaterial;
      badge: THREE.Mesh;
      ownTex: THREE.Texture | null; // texture we created for this slot (to dispose)
    };
    const posters = new Map<string, Poster>();
    // Each unit's lit sign, so an owner's name change can be re-rendered onto it.
    const signs = new Map<
      string,
      { material: THREE.MeshBasicMaterial; ownTex: THREE.Texture }
    >();
    const posterMeshes: THREE.Mesh[] = [];
    const textureLoader = new THREE.TextureLoader();
    let sceneDisposed = false;

    const posterKey = (unit: string, wallId: string) => `${unit}:${wallId}`;

    // Point a poster at a wall's current content (image / youtube / website /
    // blank), disposing whatever texture it held before.
    const applyWall = (wall: WallSlot, unit: string) => {
      const poster = posters.get(posterKey(unit, wall.id));
      if (!poster) return;
      poster.badge.visible = wall.kind === "youtube";

      const clearOwn = () => {
        if (poster.ownTex) {
          poster.ownTex.dispose();
          poster.ownTex = null;
        }
      };

      const setTex = (tex: THREE.Texture) => {
        clearOwn();
        poster.ownTex = tex;
        poster.material.map = tex;
        poster.material.needsUpdate = true;
      };
      const setBlank = () => {
        clearOwn();
        poster.material.map = blankPosterTex;
        poster.material.needsUpdate = true;
      };
      // If a website screenshot can't be fetched, fall back to a poster naming
      // the site so the wall still reads as that destination.
      const setWebsitePoster = () =>
        setTex(makeWebsitePosterTexture(wall.src, wall.title));

      if (wall.kind === "empty") {
        setBlank();
        return;
      }

      // image / youtube thumbnail / website screenshot all load as a bitmap
      const url = wallImageUrl(wall);
      if (!url) {
        if (wall.kind === "website") setWebsitePoster();
        else setBlank();
        return;
      }
      textureLoader.load(
        url,
        (tex) => {
          if (sceneDisposed) {
            tex.dispose();
            return;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          setTex(tex);
        },
        undefined,
        () => {
          if (wall.kind === "website") setWebsitePoster();
          else setBlank();
        },
      );
    };

    // Re-render a unit's awning sign with the owner's chosen studio name,
    // falling back to the static content name when none is set.
    const applySign = (unit: string, name: string) => {
      const entry = signs.get(unit);
      const store = storefronts.find((s) => s.number === unit);
      if (!entry || !store) return;
      const tex = makeSignTexture(store.number, name || store.name, store.accent);
      entry.material.map = tex;
      entry.material.needsUpdate = true;
      entry.ownTex.dispose();
      entry.ownTex = tex;
    };

    const storePositions: THREE.Vector3[] = [];
    // Interior center + orientation for each unit, so an uploaded avatar can be
    // dropped inside and paced along the frontage.
    const avatarAnchors = new Map<
      string,
      { x: number; z: number; onLeft: boolean }
    >();
    storefronts.forEach((store, i) => {
      const onLeft = i < 5;
      const rowIndex = onLeft ? i : i - 5;
      const z = ROW_START_Z - rowIndex * ROW_STEP;
      const groupX = onLeft
        ? -(STREET_HALF + STORE_D / 2)
        : STREET_HALF + STORE_D / 2;
      avatarAnchors.set(store.number, { x: groupX, z, onLeft });

      const group = new THREE.Group();
      group.position.set(groupX, 0, z);
      if (!onLeft) group.rotation.y = Math.PI; // opening faces the street

      const accent = new THREE.Color(store.accent);
      const accentMat = new THREE.MeshBasicMaterial({ color: accent });
      disposables.push(accentMat);

      // Shell — weathered patchwork walls, dark edge lines picking out corners
      const back = new THREE.Mesh(backWallGeo, wallMat);
      back.position.set(-STORE_D / 2, STORE_H / 2, 0);
      group.add(back);
      const backLine = new THREE.LineSegments(backEdges, edgeMat);
      backLine.position.copy(back.position);
      group.add(backLine);

      for (const sz of [-STORE_W / 2, STORE_W / 2]) {
        const side = new THREE.Mesh(sideWallGeo, wallMat);
        side.position.set(0, STORE_H / 2, sz);
        group.add(side);
        const sideLine = new THREE.LineSegments(sideEdges, edgeMat);
        sideLine.position.copy(side.position);
        group.add(sideLine);
      }

      const ceil = new THREE.Mesh(ceilGeo, ceilMat);
      ceil.position.set(0, STORE_H, 0);
      group.add(ceil);

      const unitFloor = new THREE.Mesh(unitFloorGeo, unitFloorMat);
      unitFloor.position.set(0, 0.06, 0);
      group.add(unitFloor);

      // Storefront frame: posts, awning band, threshold sill (accent)
      for (const pz of [-STORE_W / 2, STORE_W / 2]) {
        const post = new THREE.Mesh(postGeo, accentMat);
        post.position.set(STORE_D / 2, STORE_H / 2, pz);
        group.add(post);
      }
      const awning = new THREE.Mesh(awningGeo, accentMat);
      awning.position.set(STORE_D / 2, STORE_H - 0.75, 0);
      group.add(awning);

      const sill = new THREE.Mesh(sillGeo, accentMat);
      sill.position.set(STORE_D / 2, 0.05, 0);
      group.add(sill);

      // Lit sign on the awning, facing the street. Registered so the owner's
      // studio name can replace the static content name once studios load.
      const signTex = makeSignTexture(store.number, store.name, store.accent);
      const signMat = new THREE.MeshBasicMaterial({
        map: signTex,
        transparent: true,
      });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(STORE_D / 2 + 0.34, STORE_H - 0.75, 0);
      sign.rotation.y = Math.PI / 2;
      group.add(sign);
      disposables.push(signTex, signMat);
      signs.set(store.number, { material: signMat, ownTex: signTex });

      // Three customizable poster walls: the back wall and the two sides.
      const posterSlots: {
        wallId: string;
        pos: [number, number, number];
        rotY: number;
      }[] = [
        {
          wallId: "center",
          pos: [-STORE_D / 2 + 0.16, STORE_H / 2 + 0.1, 0],
          rotY: Math.PI / 2,
        },
        {
          wallId: "left",
          pos: [-0.5, STORE_H / 2 + 0.1, STORE_W / 2 - 0.16],
          rotY: Math.PI,
        },
        {
          wallId: "right",
          pos: [-0.5, STORE_H / 2 + 0.1, -STORE_W / 2 + 0.16],
          rotY: 0,
        },
      ];
      for (const slot of posterSlots) {
        const posterGroup = new THREE.Group();
        posterGroup.position.set(...slot.pos);
        posterGroup.rotation.y = slot.rotY;

        const frame = new THREE.Mesh(posterFrameGeo, accentMat);
        posterGroup.add(frame);

        const material = new THREE.MeshBasicMaterial({ map: blankPosterTex });
        const content = new THREE.Mesh(posterGeo, material);
        content.position.z = 0.04;
        content.userData = { unit: store.number, wallId: slot.wallId };
        posterGroup.add(content);
        posterMeshes.push(content);

        const badge = new THREE.Mesh(badgeGeo, badgeMat);
        badge.position.z = 0.06;
        badge.visible = false;
        posterGroup.add(badge);

        group.add(posterGroup);
        disposables.push(material);
        posters.set(posterKey(store.number, slot.wallId), {
          unit: store.number,
          wallId: slot.wallId,
          content,
          material,
          badge,
          ownTex: null,
        });
      }

      scene.add(group);

      // Proximity anchor at the doorway, out on the street side
      const doorX = onLeft ? -STREET_HALF : STREET_HALF;
      storePositions.push(new THREE.Vector3(doorX, 0, z));
    });

    // --- Uploaded avatars: a host that walks around inside each unit ----------
    // Formats: VRM gets a procedural humanoid walk; GLB/glTF/FBX that ship
    // their own animation clip play that clip while pacing; anything rigless
    // just glides along the path.
    type Avatar = {
      root: THREE.Object3D; // what we add to the scene and move
      vrm: VRM | null; // set only for VRM files (drives the procedural walk)
      mixer: THREE.AnimationMixer | null; // set when the model carries clips
      baseY: number; // rest height once scaled + stood on the floor
      normScale: number; // auto-fit scale that brings it to a normal height
      ownerScale: number; // owner's size multiplier on top of normScale
      yawOffset: number; // owner's facing correction, radians
      onLeft: boolean;
      ends: [number, number]; // the two z coordinates it paces between
      targetEnd: 0 | 1;
      state: "walk" | "pause";
      pauseUntil: number;
      gait: number; // walk-cycle accumulator (procedural VRM walk)
      bones: Partial<Record<string, THREE.Object3D | null>> | null;
    };
    const avatars = new Map<string, Avatar>();
    const AVATAR_PATROL_HALF = STORE_W / 2 - 3;
    const AVATAR_WALK_SPEED = 1.6; // metres/sec
    const AVATAR_FLOOR_Y = 0.12;
    const AVATAR_TARGET_HEIGHT = 1.7; // metres — normalize every model to this
    const gltfLoader = new GLTFLoader();
    gltfLoader.register((parser) => new VRMLoaderPlugin(parser));
    const fbxLoader = new FBXLoader();

    const bone = (vrm: VRM, name: VRMHumanBoneName) =>
      vrm.humanoid?.getNormalizedBoneNode(name) ?? null;
    const idleYawFor = (onLeft: boolean) => (onLeft ? Math.PI / 2 : -Math.PI / 2);
    const avatarExt = (src: string) =>
      (src.match(/\.(vrm|glb|gltf|fbx)$/i)?.[1] ?? "").toLowerCase();

    // Prefer a locomotion clip; fall back to idle, then whatever's first.
    const pickClip = (clips: THREE.AnimationClip[]) =>
      clips.find((c) => /walk|run|move|locomo/i.test(c.name)) ??
      clips.find((c) => /idle|stand|breath/i.test(c.name)) ??
      clips[0];

    const disposeObject3D = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      });
    };

    const removeAvatar = (unit: string) => {
      const existing = avatars.get(unit);
      if (!existing) return;
      avatars.delete(unit);
      existing.mixer?.stopAllAction();
      scene.remove(existing.root);
      if (existing.vrm) VRMUtils.deepDispose(existing.vrm.scene);
      else disposeObject3D(existing.root);
    };

    // Stand a (freshly scaled) model's feet on the floor, and report the y it
    // rests at so the walk bob can offset from it.
    const restOnFloor = (root: THREE.Object3D) => {
      root.position.y = 0;
      root.updateMatrixWorld(true);
      const minY = new THREE.Box3().setFromObject(root).min.y;
      root.position.y = AVATAR_FLOOR_Y - minY;
      return root.position.y;
    };

    // Scale a freshly loaded model to a consistent height, stand it on the
    // floor at its unit's anchor, and register it as a pacing avatar.
    const placeAvatar = (
      unit: string,
      anchor: { x: number; z: number; onLeft: boolean },
      src: string,
      root: THREE.Object3D,
      vrm: VRM | null,
      clips: THREE.AnimationClip[],
      ownerScale: number,
      yawOffset: number,
    ) => {
      if (sceneDisposed) {
        if (vrm) VRMUtils.deepDispose(vrm.scene);
        else disposeObject3D(root);
        return;
      }
      removeAvatar(unit); // replace any previous avatar for this unit
      root.traverse((obj) => {
        obj.frustumCulled = false;
      });

      // Auto-fit to a sane height (FBX especially arrives in cm / huge), then
      // apply the owner's size multiplier on top.
      root.position.set(anchor.x, 0, anchor.z);
      root.rotation.y = idleYawFor(anchor.onLeft);
      root.scale.setScalar(1);
      root.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
      const height = size.y > 1e-3 ? size.y : 1;
      const normScale = AVATAR_TARGET_HEIGHT / height;
      root.scale.setScalar(normScale * ownerScale);

      // Stand its feet on the floor at the unit anchor, facing the street.
      const baseY = restOnFloor(root);
      root.userData.vrmSrc = src;
      scene.add(root);

      // Non-VRM models animate via their own clips (if any).
      let mixer: THREE.AnimationMixer | null = null;
      if (!vrm && clips.length > 0) {
        mixer = new THREE.AnimationMixer(root);
        mixer.clipAction(pickClip(clips)).play();
      }

      avatars.set(unit, {
        root,
        vrm,
        mixer,
        baseY,
        normScale,
        ownerScale,
        yawOffset,
        onLeft: anchor.onLeft,
        ends: [anchor.z - AVATAR_PATROL_HALF, anchor.z + AVATAR_PATROL_HALF],
        targetEnd: 0,
        state: "pause",
        pauseUntil: 0,
        gait: 0,
        bones: vrm
          ? {
              spine: bone(vrm, VRMHumanBoneName.Spine),
              chest: bone(vrm, VRMHumanBoneName.Chest),
              head: bone(vrm, VRMHumanBoneName.Head),
              leftUpperArm: bone(vrm, VRMHumanBoneName.LeftUpperArm),
              rightUpperArm: bone(vrm, VRMHumanBoneName.RightUpperArm),
              leftUpperLeg: bone(vrm, VRMHumanBoneName.LeftUpperLeg),
              rightUpperLeg: bone(vrm, VRMHumanBoneName.RightUpperLeg),
              leftLowerLeg: bone(vrm, VRMHumanBoneName.LeftLowerLeg),
              rightLowerLeg: bone(vrm, VRMHumanBoneName.RightLowerLeg),
            }
          : null,
      });
    };

    const loadAvatar = (
      unit: string,
      src: string,
      ownerScale: number,
      yawOffset: number,
    ) => {
      const anchor = avatarAnchors.get(unit);
      if (!anchor) return;
      // an avatar is decoration — a failed load shouldn't break the world
      const onError = () => {};
      if (avatarExt(src) === "fbx") {
        fbxLoader.load(
          src,
          (obj) =>
            placeAvatar(
              unit,
              anchor,
              src,
              obj,
              null,
              obj.animations ?? [],
              ownerScale,
              yawOffset,
            ),
          undefined,
          onError,
        );
        return;
      }
      gltfLoader.load(
        src,
        (gltf) => {
          const vrm = (gltf.userData.vrm as VRM | undefined) ?? null;
          if (vrm) VRMUtils.rotateVRM0(vrm); // VRM0 faces -Z; align it to +Z
          const root = vrm ? vrm.scene : gltf.scene;
          placeAvatar(
            unit,
            anchor,
            src,
            root,
            vrm,
            gltf.animations ?? [],
            ownerScale,
            yawOffset,
          );
        },
        undefined,
        onError,
      );
    };

    const applyAvatar = (
      unit: string,
      src: string,
      avatarScaleDeg: number,
      avatarYawDeg: number,
    ) => {
      const scale = avatarScaleDeg > 0 ? avatarScaleDeg : 1;
      const yawOffset = THREE.MathUtils.degToRad(avatarYawDeg || 0);
      const current = avatars.get(unit);
      if (!src) {
        removeAvatar(unit);
        return;
      }
      // Same model already loaded: just re-apply the owner's size/facing in
      // place instead of reloading the whole file.
      if (current && current.root.userData.vrmSrc === src) {
        if (current.ownerScale !== scale) {
          current.ownerScale = scale;
          current.root.scale.setScalar(current.normScale * scale);
          current.baseY = restOnFloor(current.root);
        }
        current.yawOffset = yawOffset;
        return;
      }
      loadAvatar(unit, src, scale, yawOffset);
    };

    // Set a normalized humanoid bone's pose (relative to its neutral rest).
    const poseBone = (node: THREE.Object3D | null | undefined, x: number) => {
      if (node) node.rotation.x = x;
    };

    const updateAvatars = (elapsed: number, delta: number) => {
      avatars.forEach((avatar) => {
        const root = avatar.root;
        const b = avatar.bones;
        let desiredYaw: number;

        if (avatar.state === "walk") {
          const targetZ = avatar.ends[avatar.targetEnd];
          const dz = targetZ - root.position.z;
          const dir = dz >= 0 ? 1 : -1;
          const step = AVATAR_WALK_SPEED * delta;
          if (Math.abs(dz) <= step) {
            root.position.z = targetZ;
            avatar.state = "pause";
            avatar.pauseUntil = elapsed + 1 + Math.random() * 2.5;
          } else {
            root.position.z += dir * step;
          }
          desiredYaw = dir > 0 ? 0 : Math.PI; // face the way we're walking
          if (b) {
            // procedural humanoid gait (VRM only)
            avatar.gait += delta * 6.5;
            const swing = Math.sin(avatar.gait) * 0.5;
            poseBone(b.leftUpperLeg, swing);
            poseBone(b.rightUpperLeg, -swing);
            poseBone(b.leftLowerLeg, -Math.max(0, -swing) * 0.6);
            poseBone(b.rightLowerLeg, -Math.max(0, swing) * 0.6);
            poseBone(b.leftUpperArm, -swing * 0.45);
            poseBone(b.rightUpperArm, swing * 0.45);
            poseBone(b.spine, Math.abs(swing) * 0.05);
            root.position.y = avatar.baseY + Math.abs(Math.sin(avatar.gait)) * 0.04;
          } else {
            root.position.y = avatar.baseY;
          }
        } else {
          if (elapsed >= avatar.pauseUntil) {
            avatar.targetEnd = avatar.targetEnd === 0 ? 1 : 0;
            avatar.state = "walk";
          }
          desiredYaw = idleYawFor(avatar.onLeft); // face the street
          if (b) {
            const breathe = Math.sin(elapsed * 1.6) * 0.04;
            poseBone(b.spine, breathe);
            poseBone(b.chest, breathe * 0.5);
            poseBone(b.head, Math.sin(elapsed * 0.9) * 0.03);
            poseBone(b.leftUpperLeg, 0);
            poseBone(b.rightUpperLeg, 0);
            poseBone(b.leftLowerLeg, 0);
            poseBone(b.rightLowerLeg, 0);
            poseBone(b.leftUpperArm, 0);
            poseBone(b.rightUpperArm, 0);
          }
          root.position.y = avatar.baseY;
        }

        // Ease toward the desired facing (plus the owner's correction) along
        // the shortest arc.
        let diff = desiredYaw + avatar.yawOffset - root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        root.rotation.y += diff * Math.min(1, delta * 6);

        avatar.mixer?.update(delta);
        avatar.vrm?.update(delta);
      });
    };

    // --- The Arena: a domed game hall closing off the end of the street ------
    {
      const arenaAccent = new THREE.Color(arena.accent);
      const FACADE_Z = -120; // front face of the frontage
      const FACADE_H = 24; // frontage height
      const OPENING_HALF = 8; // half-width of the central entrance gap
      const FACADE_HALF = 34; // half-width of the whole frontage
      const LINTEL_H = FACADE_H - 11; // billboard band height over the doorway

      const arenaGroup = new THREE.Group();

      // Dark shell + neon edge/trim, matching the storefront material language.
      const arenaWallMat = new THREE.MeshBasicMaterial({ color: 0x0c1220 });
      const arenaTrimMat = new THREE.MeshBasicMaterial({ color: arenaAccent });
      const arenaEdgeMat = new THREE.LineBasicMaterial({
        color: arenaAccent,
        transparent: true,
        opacity: 0.5,
      });
      disposables.push(arenaWallMat, arenaTrimMat, arenaEdgeMat);

      // A faceted geodesic dome rising behind the frontage.
      const domeGeo = new THREE.SphereGeometry(
        36,
        22,
        12,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      );
      const domeMat = new THREE.MeshBasicMaterial({ color: 0x0a0f1b });
      const dome = new THREE.Mesh(domeGeo, domeMat);
      dome.position.set(0, 0, -156); // base ring front sits flush with FACADE_Z
      arenaGroup.add(dome);
      const domeWireMat = new THREE.MeshBasicMaterial({
        color: arenaAccent,
        wireframe: true,
        transparent: true,
        opacity: 0.14,
      });
      const domeWire = new THREE.Mesh(domeGeo, domeWireMat);
      domeWire.position.copy(dome.position);
      arenaGroup.add(domeWire);
      disposables.push(domeGeo, domeMat, domeWireMat);

      // Two frontage pillars flanking the central entrance gap.
      const pillarW = FACADE_HALF - OPENING_HALF;
      const pillarGeo = new THREE.BoxGeometry(pillarW, FACADE_H, 4);
      const pillarEdges = new THREE.EdgesGeometry(pillarGeo);
      disposables.push(pillarGeo, pillarEdges);
      for (const sx of [-1, 1]) {
        const pillar = new THREE.Mesh(pillarGeo, arenaWallMat);
        pillar.position.set(
          sx * (OPENING_HALF + pillarW / 2),
          FACADE_H / 2,
          FACADE_Z,
        );
        arenaGroup.add(pillar);
        const edges = new THREE.LineSegments(pillarEdges, arenaEdgeMat);
        edges.position.copy(pillar.position);
        arenaGroup.add(edges);
      }

      // Lintel spanning the entrance, carrying the billboard.
      const lintelGeo = new THREE.BoxGeometry(OPENING_HALF * 2 + 2, LINTEL_H, 4);
      const lintel = new THREE.Mesh(lintelGeo, arenaWallMat);
      lintel.position.set(0, FACADE_H - LINTEL_H / 2, FACADE_Z);
      arenaGroup.add(lintel);
      disposables.push(lintelGeo);

      // Accent threshold strip on the ground under the doorway.
      const thresholdGeo = new THREE.BoxGeometry(OPENING_HALF * 2, 0.12, 3);
      const threshold = new THREE.Mesh(thresholdGeo, arenaTrimMat);
      threshold.position.set(0, 0.06, FACADE_Z + 2.4);
      arenaGroup.add(threshold);
      disposables.push(thresholdGeo);

      // A curtain of light filling the entrance — "step through here".
      const portalGeo = new THREE.PlaneGeometry(OPENING_HALF * 2, LINTEL_H);
      const portalMat = new THREE.MeshBasicMaterial({
        color: arenaAccent,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const portal = new THREE.Mesh(portalGeo, portalMat);
      portal.position.set(0, LINTEL_H / 2, FACADE_Z + 0.3);
      arenaGroup.add(portal);
      disposables.push(portalGeo, portalMat);

      // The changeable billboard (see content.arena.billboard).
      const bbFrameGeo = new THREE.PlaneGeometry(OPENING_HALF * 2 + 2, 8);
      const bbFrame = new THREE.Mesh(bbFrameGeo, arenaTrimMat);
      bbFrame.position.set(0, FACADE_H - 5, FACADE_Z + 2.0);
      arenaGroup.add(bbFrame);
      const billboardTex = makeBillboardTexture(
        arena.billboard.name,
        arena.billboard.leftWing,
        arena.billboard.rightWing,
        arena.billboard.subtitle,
        arena.accent,
      );
      const billboardMat = new THREE.MeshBasicMaterial({
        map: billboardTex,
        transparent: true,
      });
      const billboardGeo = new THREE.PlaneGeometry(OPENING_HALF * 2 + 1, 7);
      const billboard = new THREE.Mesh(billboardGeo, billboardMat);
      billboard.position.set(0, FACADE_H - 5, FACADE_Z + 2.1);
      arenaGroup.add(billboard);
      disposables.push(bbFrameGeo, billboardTex, billboardMat, billboardGeo);

      scene.add(arenaGroup);
    }

    // --- The Ferris wheel: huge, beside the Colossus -------------------------
    // Basic pass: a boarding platform, an A-frame carrying a spinning wheel of
    // spokes + a rim, and upright cabins you can ride. Fine detailing later.
    const gondolas: { mesh: THREE.Group; base: number }[] = [];
    let wheelAngle = 0;
    let wheelRunning = false;
    const rideCamPos = new THREE.Vector3();
    let rideCabin = 0;
    let updateWheel: (delta: number) => void = () => {};
    // Exiting the ride drops the rider back onto the platform by the base.
    const rideExit = () => {
      camera.position.set(WHEEL.x, EYE_HEIGHT, WHEEL.z + 12);
    };
    {
      const C = new THREE.Vector3(WHEEL.x, WHEEL.y, WHEEL.z);
      const R = WHEEL.radius;

      // Platform deck beside the plaza (the part past the plaza's own edge),
      // reusing the pier's wood shader so the planks stay continuous.
      const platW = 30;
      const platCx = 74 - platW / 2; // hug the plaza edge at x≈44, out to x=74
      const platL = 64;
      const platSlabGeo = new THREE.BoxGeometry(platW, 0.9, platL);
      const platSlab = new THREE.Mesh(platSlabGeo, deckSlabMat);
      platSlab.position.set(platCx, -0.45, WHEEL.z);
      scene.add(platSlab);
      const platTopGeo = new THREE.PlaneGeometry(platW, platL);
      const platTop = new THREE.Mesh(platTopGeo, woodMat);
      platTop.rotation.x = -Math.PI / 2;
      platTop.position.set(platCx, 0.012, WHEEL.z);
      scene.add(platTop);
      disposables.push(platSlabGeo, platTopGeo);

      // Materials — neon rim/spokes over a dark steel frame, to match the world.
      const frameMat = new THREE.MeshBasicMaterial({ color: 0x1b2436 });
      const rimMat = new THREE.MeshBasicMaterial({ color: 0x66e0ff });
      const spokeMat = new THREE.MeshBasicMaterial({ color: 0x8fb3ff });
      const hubMat = new THREE.MeshBasicMaterial({ color: 0x223049 });
      const cabinColors = [
        0x8fb3ff, 0x66e0ff, 0x7dffa8, 0xf0c36a, 0xff8fd6, 0xff6b6b, 0xb28dff,
        0xe8ecff,
      ];
      const cabinMats = cabinColors.map(
        (c) => new THREE.MeshBasicMaterial({ color: c }),
      );
      disposables.push(frameMat, rimMat, spokeMat, hubMat, ...cabinMats);

      // A cylinder strut between two points (used for legs, axle, spokes).
      const strut = (
        a: THREE.Vector3,
        b: THREE.Vector3,
        material: THREE.Material,
        thick: number,
        parent: THREE.Object3D,
      ) => {
        const dir = new THREE.Vector3().subVectors(b, a);
        const len = dir.length() || 0.001;
        const geo = new THREE.CylinderGeometry(thick, thick, len, 8);
        disposables.push(geo);
        const m = new THREE.Mesh(geo, material);
        m.position.copy(a).addScaledVector(dir, 0.5);
        m.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.clone().normalize(),
        );
        // struts built in world space are re-parented relative to `parent`.
        parent.add(m);
        m.position.sub(parent.position);
        return m;
      };

      // Static A-frame legs on both sides of the axle, plus the axle itself.
      const axleLeft = new THREE.Vector3(WHEEL.x - 16, WHEEL.y, WHEEL.z);
      const axleRight = new THREE.Vector3(WHEEL.x + 16, WHEEL.y, WHEEL.z);
      for (const axle of [axleLeft, axleRight]) {
        strut(
          new THREE.Vector3(axle.x, 0, axle.z - 12),
          axle,
          frameMat,
          0.9,
          scene,
        );
        strut(
          new THREE.Vector3(axle.x, 0, axle.z + 12),
          axle,
          frameMat,
          0.9,
          scene,
        );
      }
      strut(axleLeft, axleRight, hubMat, 1.1, scene);

      // Spinning wheel: hub, spokes, and a rim ring, in a group that rotates
      // about the world x-axis (the axle). Built in local space (origin = hub).
      const wheelSpin = new THREE.Group();
      wheelSpin.position.copy(C);
      scene.add(wheelSpin);

      const hubGeo = new THREE.CylinderGeometry(2.4, 2.4, 3, 16);
      const hub = new THREE.Mesh(hubGeo, hubMat);
      hub.rotation.z = Math.PI / 2; // lie the hub along the x-axis
      wheelSpin.add(hub);
      disposables.push(hubGeo);

      // Rim as a torus in the y-z plane (rotate the default x-y torus by 90°).
      const rimGeo = new THREE.TorusGeometry(R, 0.55, 10, 72);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.y = Math.PI / 2;
      wheelSpin.add(rim);
      const rimGeoInner = new THREE.TorusGeometry(R - 3, 0.28, 8, 72);
      const rimInner = new THREE.Mesh(rimGeoInner, rimMat);
      rimInner.rotation.y = Math.PI / 2;
      wheelSpin.add(rimInner);
      disposables.push(rimGeo, rimGeoInner);

      // Spokes from hub to rim (local y-z plane; x stays 0).
      for (let i = 0; i < WHEEL.cabins; i += 1) {
        const a = (i / WHEEL.cabins) * Math.PI * 2;
        strut(
          new THREE.Vector3(WHEEL.x, WHEEL.y, WHEEL.z),
          new THREE.Vector3(
            WHEEL.x,
            WHEEL.y + R * Math.sin(a),
            WHEEL.z + R * Math.cos(a),
          ),
          spokeMat,
          0.18,
          wheelSpin,
        );
      }

      // Cabins: kept upright (not children of the spinning group), repositioned
      // each frame along the rim. Each is a little open gondola with a roof.
      const cabinBodyGeo = new THREE.BoxGeometry(4.4, 2.6, 3.6);
      const cabinRoofGeo = new THREE.BoxGeometry(4.8, 0.4, 4.0);
      disposables.push(cabinBodyGeo, cabinRoofGeo);
      for (let i = 0; i < WHEEL.cabins; i += 1) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(cabinBodyGeo, cabinMats[i % cabinMats.length]);
        body.position.y = -1.3; // hang below its rim attach point
        g.add(body);
        const roof = new THREE.Mesh(cabinRoofGeo, frameMat);
        roof.position.y = 0.2;
        g.add(roof);
        scene.add(g);
        gondolas.push({ mesh: g, base: (i / WHEEL.cabins) * Math.PI * 2 });
      }

      // Lights strung around the wheel — a ring of bulbs on the outer rim plus
      // beads running out along each spoke. They ride the spinning group (so
      // the lights go around with it), glow warm at night, and a travelling
      // wave chases around the rim. Additive glow sprites via a Points cloud.
      const bulbPos: number[] = [];
      const bulbWave: number[] = []; // 0..1 position along the chase, per bulb
      const RIM_BULBS = 60;
      for (let i = 0; i < RIM_BULBS; i += 1) {
        const a = (i / RIM_BULBS) * Math.PI * 2;
        bulbPos.push(0, (R + 0.5) * Math.cos(a), (R + 0.5) * Math.sin(a));
        bulbWave.push(i / RIM_BULBS);
      }
      for (let s = 0; s < WHEEL.cabins; s += 1) {
        const a = (s / WHEEL.cabins) * Math.PI * 2;
        for (const f of [0.35, 0.55, 0.75, 0.95]) {
          bulbPos.push(0, R * f * Math.cos(a), R * f * Math.sin(a));
          bulbWave.push(s / WHEEL.cabins);
        }
      }
      const bulbCount = bulbPos.length / 3;
      const bulbGeo = new THREE.BufferGeometry();
      bulbGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(bulbPos, 3),
      );
      const bulbColorAttr = new THREE.Float32BufferAttribute(
        new Float32Array(bulbCount * 3),
        3,
      );
      bulbGeo.setAttribute("color", bulbColorAttr);
      const bulbTex = makeGlowTexture();
      const bulbMat = new THREE.PointsMaterial({
        map: bulbTex,
        size: 3.2,
        sizeAttenuation: true,
        transparent: true,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const bulbs = new THREE.Points(bulbGeo, bulbMat);
      wheelSpin.add(bulbs);
      disposables.push(bulbGeo, bulbTex, bulbMat);
      const bulbWarm = new THREE.Color(0xffe6b0);
      const bulbCool = new THREE.Color(0x8fd9ff);
      const bulbC = new THREE.Color();
      let bulbClock = 0;

      // Advance the wheel and keep the cabins hanging upright on the rim.
      updateWheel = (delta: number) => {
        if (wheelRunning) wheelAngle += WHEEL.speed * delta;
        // Spin the spokes/rim/bulbs the same way the cabins travel (a positive
        // x-rotation runs the rim backwards, so negate it to match) — both go
        // clockwise as seen from the boardwalk.
        wheelSpin.rotation.x = -wheelAngle;
        for (const g of gondolas) {
          const a = wheelAngle + g.base;
          g.mesh.position.set(
            WHEEL.x,
            WHEEL.y + R * Math.sin(a),
            WHEEL.z + R * Math.cos(a),
          );
        }
        // Ride camera: sit up above the cabin and a little out in front of the
        // wheel (toward the pier), so you see the boardwalk and ocean around
        // you instead of the inside of the car.
        if (ridingRef.current) {
          rideCamPos.copy(gondolas[rideCabin].mesh.position);
          rideCamPos.x = WHEEL.x - 5;
          rideCamPos.y += 2.2;
        }
        // Bulbs: a chase wave around the rim, all scaled by how dark it is.
        bulbClock += delta;
        const arr = bulbColorAttr.array as Float32Array;
        for (let i = 0; i < bulbCount; i += 1) {
          const wave = 0.55 + 0.45 * Math.sin(bulbClock * 3 - bulbWave[i] * 12);
          const b = wheelLightAmount * wave;
          bulbC.copy(i % 2 === 0 ? bulbWarm : bulbCool).multiplyScalar(b);
          arr[i * 3] = bulbC.r;
          arr[i * 3 + 1] = bulbC.g;
          arr[i * 3 + 2] = bulbC.b;
        }
        bulbColorAttr.needsUpdate = true;
      };

      // Board the cabin nearest the bottom; exit drops you back on the platform.
      rideControlRef.current = {
        board: () => {
          let best = 0;
          let bestY = Infinity;
          gondolas.forEach((g, i) => {
            if (g.mesh.position.y < bestY) {
              bestY = g.mesh.position.y;
              best = i;
            }
          });
          rideCabin = best;
          ridingRef.current = true;
          wheelRunning = true;
          // Face out toward the pier (−x) at the horizon, so the first thing
          // you see is the boardwalk, not the wheel behind you.
          yaw = Math.PI / 2;
          pitch = 0;
          setRiding(true);
          setNearWheel(false);
        },
        exit: () => {
          ridingRef.current = false;
          setRiding(false);
          rideExit();
        },
      };
    }

    // Let React push studio content onto the walls as it loads / is edited.
    wallApiRef.current = {
      applyStudios(studios) {
        for (const studio of studios) {
          applySign(studio.unit, studio.studioName);
          for (const wall of studio.walls) applyWall(wall, studio.unit);
          applyAvatar(
            studio.unit,
            studio.vrmSrc ?? "",
            studio.avatarScale ?? 1,
            studio.avatarYaw ?? 0,
          );
        }
      },
      applyWall(unit, wall) {
        applyWall(wall, unit);
      },
      applySign(unit, name) {
        applySign(unit, name);
      },
      applyAvatar(unit, vrmSrc, avatarScale, avatarYaw) {
        applyAvatar(unit, vrmSrc, avatarScale, avatarYaw);
      },
    };
    // If studio data already arrived before the scene built, apply it now.
    if (studiosRef.current.size > 0) {
      wallApiRef.current.applyStudios([...studiosRef.current.values()]);
    }

    // --- Other visitors: glowing orbs -----------------------------------------
    type RemoteOrb = {
      group: THREE.Group;
      material: THREE.MeshBasicMaterial;
      glowMaterial: THREE.SpriteMaterial;
      labelTexture: THREE.CanvasTexture;
      labelMaterial: THREE.SpriteMaterial;
      target: THREE.Vector2;
      phase: number;
    };
    const remoteOrbs = new Map<string, RemoteOrb>();
    const orbGeometry = new THREE.SphereGeometry(0.5, 24, 24);
    const glowTexture = makeGlowTexture();
    disposables.push(orbGeometry, glowTexture);

    const removeOrb = (id: string) => {
      const orb = remoteOrbs.get(id);
      if (!orb) return;
      remoteOrbs.delete(id);
      scene.remove(orb.group);
      orb.material.dispose();
      orb.glowMaterial.dispose();
      orb.labelTexture.dispose();
      orb.labelMaterial.dispose();
    };

    sceneApiRef.current = {
      upsertPeer(peer) {
        removeOrb(peer.id);
        const group = new THREE.Group();
        group.position.set(peer.x, 1.6, peer.z);

        const material = new THREE.MeshBasicMaterial({ color: peer.color });
        group.add(new THREE.Mesh(orbGeometry, material));

        const glowMaterial = new THREE.SpriteMaterial({
          map: glowTexture,
          color: peer.color,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.9,
        });
        const glow = new THREE.Sprite(glowMaterial);
        glow.scale.set(3.2, 3.2, 1);
        group.add(glow);

        const labelTexture = makePeerLabelTexture(peer.name);
        const labelMaterial = new THREE.SpriteMaterial({
          map: labelTexture,
          transparent: true,
          depthWrite: false,
        });
        const label = new THREE.Sprite(labelMaterial);
        label.scale.set(4.5, 0.85, 1);
        label.position.y = 1.2;
        group.add(label);

        scene.add(group);
        remoteOrbs.set(peer.id, {
          group,
          material,
          glowMaterial,
          labelTexture,
          labelMaterial,
          target: new THREE.Vector2(peer.x, peer.z),
          phase: Math.random() * Math.PI * 2,
        });
      },
      movePeer(id, x, z) {
        remoteOrbs.get(id)?.target.set(x, z);
      },
      removePeer: removeOrb,
      recolorPeer(id, value) {
        const orb = remoteOrbs.get(id);
        if (!orb) return;
        orb.material.color.set(value);
        orb.glowMaterial.color.set(value);
      },
      clearPeers() {
        for (const id of [...remoteOrbs.keys()]) removeOrb(id);
      },
    };

    // --- Controls state ---------------------------------------------------------
    const keys = new Set<string>();
    let yaw = 0; // spawn facing down the -z street of storefronts
    let pitch = 0;
    let gyroYawOffset = 0; // swipe-to-turn on top of device orientation
    const yawOffsetQ = new THREE.Quaternion();

    const gyro = { alpha: 0, beta: 0, gamma: 0, has: false };
    let screenAngle = THREE.MathUtils.degToRad(
      window.screen.orientation?.angle ?? 0,
    );

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha === null) return;
      gyro.alpha = THREE.MathUtils.degToRad(event.alpha);
      gyro.beta = THREE.MathUtils.degToRad(event.beta ?? 0);
      gyro.gamma = THREE.MathUtils.degToRad(event.gamma ?? 0);
      gyro.has = true;
    };

    const onScreenRotate = () => {
      screenAngle = THREE.MathUtils.degToRad(
        window.screen.orientation?.angle ?? 0,
      );
    };

    const isTyping = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      return (
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event)) return;
      if (event.code === "Enter" || event.code === "NumpadEnter") {
        // jump to the group chat: free the cursor, open + focus the box
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock();
        }
        setChatOpen(true);
        window.setTimeout(() => chatInputRef.current?.focus(), 50);
        return;
      }
      // E boards the Ferris wheel when near its base, and gets off while riding.
      if (event.code === "KeyE" && !overlayOpenRef.current) {
        if (ridingRef.current) {
          rideControlRef.current?.exit();
          return;
        }
        if (nearWheelRef.current) {
          rideControlRef.current?.board();
          return;
        }
      }
      keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (isTyping(event)) return;
      keys.delete(event.code);
    };

    const applyLook = (dx: number, dy: number, sensitivity: number) => {
      yaw -= dx * sensitivity;
      pitch -= dy * sensitivity;
      pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
    };

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      applyLook(event.movementX, event.movementY, 0.0022);
    };

    const onPointerLockChange = () => {
      setLocked(document.pointerLockElement === renderer.domElement);
    };

    const requestLock = () => {
      if (!window.matchMedia("(pointer: coarse)").matches) {
        renderer.domElement.requestPointerLock();
      }
    };
    lockFnRef.current = requestLock;

    // --- Touch controls: left half = move stick, right half = look/turn ----------
    const touchState = {
      moveId: -1,
      moveStart: new THREE.Vector2(),
      moveDelta: new THREE.Vector2(),
      lookId: -1,
      lookLast: new THREE.Vector2(),
    };

    const onTouchStart = (event: TouchEvent) => {
      event.preventDefault();
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.clientX < window.innerWidth / 2 && touchState.moveId === -1) {
          touchState.moveId = touch.identifier;
          touchState.moveStart.set(touch.clientX, touch.clientY);
          touchState.moveDelta.set(0, 0);
        } else if (touchState.lookId === -1) {
          touchState.lookId = touch.identifier;
          touchState.lookLast.set(touch.clientX, touch.clientY);
        }
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === touchState.moveId) {
          touchState.moveDelta.set(
            (touch.clientX - touchState.moveStart.x) / 60,
            (touch.clientY - touchState.moveStart.y) / 60,
          );
          touchState.moveDelta.clampScalar(-1, 1);
        } else if (touch.identifier === touchState.lookId) {
          if (modeRef.current === "gyro") {
            // device handles pitch/roll; swiping turns the body
            gyroYawOffset -= (touch.clientX - touchState.lookLast.x) * 0.004;
            touchState.lookLast.set(touch.clientX, touch.clientY);
          } else {
            applyLook(
              touch.clientX - touchState.lookLast.x,
              touch.clientY - touchState.lookLast.y,
              0.0045,
            );
            touchState.lookLast.set(touch.clientX, touch.clientY);
          }
        }
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === touchState.moveId) {
          touchState.moveId = -1;
          touchState.moveDelta.set(0, 0);
        } else if (touch.identifier === touchState.lookId) {
          touchState.lookId = -1;
        }
      }
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    window.addEventListener("deviceorientation", onOrientation);
    window.screen.orientation?.addEventListener("change", onScreenRotate);
    renderer.domElement.addEventListener("click", requestLock);
    renderer.domElement.addEventListener("touchstart", onTouchStart, {
      passive: false,
    });
    renderer.domElement.addEventListener("touchmove", onTouchMove, {
      passive: false,
    });
    renderer.domElement.addEventListener("touchend", onTouchEnd);
    window.addEventListener("resize", onResize);

    // --- Animation loop ------------------------------------------------------------
    const clock = new THREE.Clock();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const velocity = new THREE.Vector3();
    let currentNear = -1;
    let currentNearArena = false;
    let currentNearWheel = false;
    let animationFrame = 0;
    let lastBroadcast = 0;
    const lastSent = new THREE.Vector2(Infinity, Infinity);
    let lastSentYaw = 0;
    const focusRay = new THREE.Raycaster();
    const SCREEN_CENTER = new THREE.Vector2(0, 0);
    let focusKey: string | null = null;
    let focusFrame = 0;
    let lastTodSync = -999; // throttle real-clock time-of-day resyncs

    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      // the ocean ripples and the clouds drift; stars twinkle off uTime
      (
        water.material as THREE.ShaderMaterial
      ).uniforms.time.value += delta;
      skyMat.uniforms.uTime.value = elapsed;

      // ?cycle=SECONDS spins a full day in that time so the whole day↔night
      // arc previews at a glance; otherwise re-read Alabama's real clock about
      // once a second so the world tracks the actual time of day as it drifts.
      if (cycleSeconds > 0) {
        applyTimeOfDay((elapsed / cycleSeconds) * 24, startDoy);
      } else if (overrideHour === null && elapsed - lastTodSync > 1) {
        lastTodSync = elapsed;
        const n = alabamaNow();
        applyTimeOfDay(n.hour, n.doy);
      }

      // orientation: AR-style from device sensors, or yaw/pitch from input
      if (modeRef.current === "gyro" && gyro.has) {
        setQuaternionFromOrientation(
          camera.quaternion,
          gyro.alpha,
          gyro.beta,
          gyro.gamma,
          screenAngle,
        );
        camera.quaternion.premultiply(
          yawOffsetQ.setFromAxisAngle(WORLD_UP, gyroYawOffset),
        );
      } else {
        camera.rotation.set(0, 0, 0);
        camera.rotateY(yaw);
        camera.rotateX(pitch);
      }

      // movement basis: where the camera faces, flattened to the floor
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-4) {
        forward.set(0, 0, -1);
      } else {
        forward.normalize();
      }
      right.crossVectors(forward, WORLD_UP); // forward × up = right-hand side

      velocity.set(0, 0, 0);
      if (keys.has("KeyW") || keys.has("ArrowUp")) velocity.add(forward);
      if (keys.has("KeyS") || keys.has("ArrowDown")) velocity.sub(forward);
      if (keys.has("KeyD") || keys.has("ArrowRight")) velocity.add(right);
      if (keys.has("KeyA") || keys.has("ArrowLeft")) velocity.sub(right);

      if (touchState.moveId !== -1) {
        velocity.addScaledVector(forward, -touchState.moveDelta.y);
        velocity.addScaledVector(right, touchState.moveDelta.x);
      }

      if (overlayOpenRef.current || ridingRef.current) velocity.set(0, 0, 0);

      // Walk the deck (union of walk / plaza front / wheel platform), sliding
      // along edges instead of stopping dead. Skipped while riding the wheel.
      if (velocity.lengthSq() > 0 && !ridingRef.current) {
        if (velocity.lengthSq() > 1) velocity.normalize();
        const step = MOVE_SPEED * delta;
        const nx = camera.position.x + velocity.x * step;
        const nz = camera.position.z + velocity.z * step;
        if (onDeck(nx, camera.position.z)) camera.position.x = nx;
        if (onDeck(camera.position.x, nz)) camera.position.z = nz;
      }

      // advance the wheel + hang the cabins; ride camera follows a cabin
      updateWheel(delta);

      if (ridingRef.current) {
        camera.position.copy(rideCamPos);
      } else if (modeRef.current !== "gyro") {
        // subtle idle bob (skip in gyro mode — the sensor already moves)
        camera.position.y = EYE_HEIGHT + Math.sin(elapsed * 1.4) * 0.035;
      } else {
        camera.position.y = EYE_HEIGHT;
      }

      // remote orbs drift toward their latest reported spot and bob gently
      const smoothing = 1 - Math.exp(-8 * delta);
      remoteOrbs.forEach((orb) => {
        orb.group.position.x +=
          (orb.target.x - orb.group.position.x) * smoothing;
        orb.group.position.z +=
          (orb.target.y - orb.group.position.z) * smoothing;
        orb.group.position.y = 1.6 + Math.sin(elapsed * 1.8 + orb.phase) * 0.14;
      });

      // uploaded store hosts pace around their units
      updateAvatars(elapsed, delta);

      // share our own position with the lobby ~10x/sec, only when it changed
      if (elapsed - lastBroadcast > 0.1) {
        const dx = camera.position.x - lastSent.x;
        const dz = camera.position.z - lastSent.y;
        if (dx * dx + dz * dz > 0.0004 || Math.abs(yaw - lastSentYaw) > 0.02) {
          sendMoveRef.current?.(camera.position.x, camera.position.z, yaw);
          lastSent.set(camera.position.x, camera.position.z);
          lastSentYaw = yaw;
        }
        lastBroadcast = elapsed;
      }

      // proximity check
      let nearest = -1;
      let nearestDistance = REVEAL_RADIUS;
      for (let i = 0; i < storePositions.length; i += 1) {
        const distance = Math.hypot(
          storePositions[i].x - camera.position.x,
          storePositions[i].z - camera.position.z,
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = i;
        }
      }
      if (nearest !== currentNear) {
        currentNear = nearest;
        setNearStore(nearest);
      }

      // Arena entrance proximity (its own forecourt zone at the street's end)
      const nearArenaNow =
        Math.hypot(
          camera.position.x - ARENA_ENTRANCE.x,
          camera.position.z - ARENA_ENTRANCE.z,
        ) < ARENA_ENTRANCE.radius;
      if (nearArenaNow !== currentNearArena) {
        currentNearArena = nearArenaNow;
        setNearArena(nearArenaNow);
      }

      // Ferris-wheel boarding proximity (its base on the platform)
      const nearWheelNow =
        !ridingRef.current &&
        Math.hypot(
          camera.position.x - WHEEL_BOARD.x,
          camera.position.z - WHEEL_BOARD.z,
        ) < WHEEL_BOARD.radius;
      if (nearWheelNow !== currentNearWheel) {
        currentNearWheel = nearWheelNow;
        nearWheelRef.current = nearWheelNow;
        setNearWheel(nearWheelNow);
      }

      // Which poster wall is under the crosshair (throttled, paused in overlays)
      focusFrame += 1;
      if (!overlayOpenRef.current && focusFrame % 4 === 0) {
        focusRay.setFromCamera(SCREEN_CENTER, camera);
        const hit = focusRay
          .intersectObjects(posterMeshes, false)
          .find((h) => h.distance <= 15);
        const ud = hit
          ? (hit.object.userData as { unit: string; wallId: string })
          : null;
        const key = ud ? posterKey(ud.unit, ud.wallId) : null;
        if (key !== focusKey) {
          focusKey = key;
          setFocusedWall(ud);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      sceneDisposed = true;
      wallApiRef.current = null;
      posters.forEach((p) => p.ownTex?.dispose());
      [...avatars.keys()].forEach(removeAvatar);
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      window.removeEventListener("deviceorientation", onOrientation);
      window.screen.orientation?.removeEventListener("change", onScreenRotate);
      renderer.domElement.removeEventListener("click", requestLock);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", onResize);
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      }
      sceneApiRef.current?.clearPeers();
      sceneApiRef.current = null;
      disposables.forEach((resource) => resource.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // --- Join the shared lobby once the visitor enters ------------------------
  useEffect(() => {
    if (!entered) return;

    const pushSystem = (text: string) => {
      setMessages((prev) => [
        ...prev.slice(-80),
        {
          id: `sys-${Date.now()}-${Math.random()}`,
          name: "",
          color: "#8fb3ff",
          text,
          ts: Date.now(),
          system: true,
        },
      ]);
    };

    const client = new LobbyClient({
      onStatus: setLobbyStatus,
      onWelcome: (_selfId, peers) => {
        setOnline(peers.length + 1);
        peers.forEach((peer) => sceneApiRef.current?.upsertPeer(peer));
      },
      onPeerJoined: (peer) => {
        setOnline((count) => count + 1);
        sceneApiRef.current?.upsertPeer(peer);
        pushSystem(`${peer.name} entered the construct`);
      },
      onPeerLeft: (id, peerName) => {
        setOnline((count) => Math.max(1, count - 1));
        sceneApiRef.current?.removePeer(id);
        pushSystem(`${peerName} left`);
      },
      onPeerMoved: (id, x, z) => sceneApiRef.current?.movePeer(id, x, z),
      onPeerColor: (id, value) => sceneApiRef.current?.recolorPeer(id, value),
      onChat: (message) =>
        setMessages((prev) => [...prev.slice(-80), message]),
      onReset: () => {
        setOnline(1);
        sceneApiRef.current?.clearPeers();
      },
    });

    client.connect(nameRef.current, colorRef.current, 0, 10, 0);
    lobbyRef.current = client;
    sendMoveRef.current = (x, z, yaw) => client.sendMove(x, z, yaw);

    return () => {
      sendMoveRef.current = null;
      lobbyRef.current = null;
      client.dispose();
      setMicOn(false);
    };
  }, [entered]);

  const near = nearStore >= 0 ? storefronts[nearStore] : null;
  const nearStudio = near ? studioMap.get(near.number) : undefined;
  const nearMine = near ? ownedUnits.has(near.number) : false;
  // A unit only reads "for lease" while it's a vacant slot no owner has taken.
  // Once claimed, the owner's signage (name, proprietor, spiel) takes over.
  const nearForLease = !!near && near.status === "vacant" && !nearStudio?.claimed;
  const nearName =
    (nearStudio?.studioName && nearStudio.studioName.trim()) ||
    near?.name ||
    "";
  const nearProprietor = nearStudio?.proprietor?.trim() ?? "";
  const nearStatusLabel = nearForLease
    ? "available to rent"
    : nearStudio?.claimed
      ? "now open"
      : near?.status === "live"
        ? "open now"
        : "now open";
  const nearBlurb = nearForLease
    ? "This space is for lease — put your images, products, and brand on these walls."
    : nearStudio?.tagline?.trim() ||
      (near?.status === "vacant"
        ? "Now open — step inside and look around."
        : (near?.tagline ?? ""));

  // Resolve the wall under the crosshair for the interaction prompt.
  const focusWall = (() => {
    if (!focusedWall) return null;
    const studio = studioMap.get(focusedWall.unit);
    const wall = studio?.walls.find((w) => w.id === focusedWall.wallId);
    if (!wall) return null;
    return { ...wall, mine: ownedUnits.has(focusedWall.unit) };
  })();
  const focusPrompt = focusWall
    ? focusWall.mine
      ? "Press E to edit this wall"
      : focusWall.kind === "youtube"
        ? "Press E to play"
        : focusWall.kind === "website"
          ? "Press E to visit"
          : focusWall.kind === "image"
            ? "Press E to view"
            : ""
    : "";

  const viewerImageSrc =
    viewer?.kind === "image" ? viewer.src : "";
  const viewerYouTube =
    viewer?.kind === "youtube" ? parseYouTubeId(viewer.src) : null;

  const showTouchOverlay = isTouch && !entered;
  const showDesktopOverlay = !isTouch && !entered;

  const identityControls = (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <label className="flex flex-col gap-2 text-left">
        <span className="text-[10px] uppercase tracking-[0.25em] text-ink-dim">
          your name
        </span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={24}
          className="rounded-md border border-white/18 bg-white/[0.055] px-3 py-2 text-sm text-[#dbe5ff] outline-none focus:border-[#8fb3ff]/60"
        />
      </label>
      <div className="flex flex-col gap-2 text-left">
        <span className="text-[10px] uppercase tracking-[0.25em] text-ink-dim">
          your orb
        </span>
        <div className="flex flex-wrap gap-2.5">
          {ORB_COLORS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => pickColor(value)}
              aria-label={`orb color ${value}`}
              className={`h-8 w-8 rounded-full transition-transform ${
                color === value
                  ? "scale-110 ring-2 ring-white/80 ring-offset-2 ring-offset-black"
                  : "opacity-70 hover:opacity-100"
              }`}
              style={{ backgroundColor: value, boxShadow: `0 0 16px ${value}` }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div ref={hostRef} className="stage-fixed" />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {/* crosshair */}
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#dbe5ff]/80" />

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#dbe5ff]">
              the construct
            </p>
            {entered && (
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink-dim">
                {lobbyStatus === "connected"
                  ? `${online} online`
                  : lobbyStatus === "connecting"
                    ? "connecting…"
                    : "reconnecting…"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {entered && (
              <>
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`pointer-events-auto rounded-md border px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] transition-colors ${
                    micOn
                      ? "border-[#7dffa8]/70 bg-[#7dffa8]/15 text-[#7dffa8]"
                      : "border-white/18 bg-white/[0.055] text-[#dbe5ff] hover:bg-[#dbe5ff] hover:text-[#0b1020]"
                  }`}
                >
                  {micOn ? "mic live" : "mic off"}
                </button>
                <button
                  type="button"
                  onClick={() => setChatOpen((open) => !open)}
                  className="pointer-events-auto rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
                >
                  chat
                </button>
              </>
            )}
            <Link
              href="/rabbit-hole"
              className="pointer-events-auto rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
            >
              exit
            </Link>
          </div>
        </div>

        {/* controls hint */}
        <p className="absolute inset-x-0 bottom-4 px-4 text-center text-[11px] uppercase tracking-[0.25em] text-ink-dim">
          {isTouch
            ? mode === "gyro"
              ? "move your phone to look — left thumb: walk — swipe right side: turn"
              : "left thumb: walk — right thumb: look"
            : locked
              ? "wasd / arrows: move — mouse: look — enter: chat — esc: release cursor"
              : "cursor released — click the scene to look around again"}
        </p>

        {/* group chat */}
        {entered && chatOpen && (
          <div className="pointer-events-auto absolute bottom-14 left-4 flex w-[min(320px,78vw)] flex-col rounded-lg border border-white/14 bg-[#0b1020]/85 backdrop-blur-sm">
            <div
              ref={chatScrollRef}
              className="flex max-h-44 flex-col gap-1.5 overflow-y-auto p-3"
            >
              {messages.length === 0 && (
                <p className="text-[11px] text-ink-dim">
                  group chat — anyone in the construct can read this
                </p>
              )}
              {messages.map((message, index) =>
                message.system ? (
                  <p
                    key={`${message.ts}-${index}`}
                    className="text-[11px] italic text-ink-dim"
                  >
                    {message.text}
                  </p>
                ) : (
                  <p
                    key={`${message.ts}-${index}`}
                    className="break-words text-xs leading-snug text-ink-soft"
                  >
                    <span className="font-bold" style={{ color: message.color }}>
                      {message.name}
                    </span>{" "}
                    {message.text}
                  </p>
                ),
              )}
            </div>
            <form onSubmit={submitChat} className="border-t border-white/10 p-2">
              <input
                ref={chatInputRef}
                value={chatText}
                onChange={(event) => setChatText(event.target.value)}
                maxLength={280}
                placeholder="type to chat…"
                className="w-full bg-transparent px-1 text-xs text-[#dbe5ff] outline-none placeholder:text-ink-dim"
              />
            </form>
          </div>
        )}

        {/* storefront placard */}
        {near && (
          <div className="absolute inset-x-0 bottom-14 flex justify-center px-4">
            <div className="max-w-md rounded-lg border border-white/14 bg-[#0b1020]/88 p-5 text-center backdrop-blur-sm">
              <p
                className="text-[11px] font-bold uppercase tracking-[0.28em]"
                style={{ color: near.accent }}
              >
                unit {near.number} · {nearStatusLabel}
              </p>
              <p className="mt-1.5 text-lg font-black tracking-tight text-[#dbe5ff]">
                {nearName}
              </p>
              {nearProprietor && (
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-dim">
                  Run by {nearProprietor}
                </p>
              )}
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                {nearBlurb}
              </p>
              {near.action && (
                <Link
                  href={near.action.href}
                  className="pointer-events-auto mt-4 inline-block rounded-md border border-[#8fb3ff]/60 bg-[#121826]/72 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
                >
                  {near.action.label}
                  <span className="ml-2 hidden text-[10px] text-ink-dim sm:inline">
                    or press E
                  </span>
                </Link>
              )}
              {near.number === "01" && (
                <button
                  type="button"
                  onClick={openGuide}
                  className="pointer-events-auto mt-3 block w-full rounded-md border border-[#f0c36a]/60 bg-[#121826]/72 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#f0c36a] transition-colors hover:bg-[#f0c36a] hover:text-[#0b1020]"
                >
                  🐾 Talk to Chance
                </button>
              )}
              {nearMine && (
                <Link
                  href="/studio"
                  className="pointer-events-auto mt-4 inline-block rounded-md border border-[#7dffa8]/60 bg-[#121826]/72 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#7dffa8] transition-colors hover:bg-[#7dffa8] hover:text-[#0b1020]"
                >
                  Manage your studio →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* arena entrance placard (the Superdome at the street's end) */}
        {nearArena && !near && (
          <div className="absolute inset-x-0 bottom-14 flex justify-center px-4">
            <div
              className="max-w-md rounded-lg border bg-[#0b1020]/88 p-5 text-center backdrop-blur-sm"
              style={{ borderColor: `${arena.accent}66` }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-[0.28em]"
                style={{ color: arena.accent }}
              >
                the colossus
              </p>
              <p className="mt-1.5 text-lg font-black tracking-tight text-[#dbe5ff]">
                {arena.entrance.name}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                {arena.entrance.blurb}
              </p>
              <Link
                href={ARENA_HREF}
                className="pointer-events-auto mt-4 inline-block rounded-md border bg-[#121826]/72 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:text-[#0b1020]"
                style={{ borderColor: `${arena.accent}99` }}
              >
                {arena.entrance.cta}
                <span className="ml-2 hidden text-[10px] text-ink-dim sm:inline">
                  or press E
                </span>
              </Link>
            </div>
          </div>
        )}

        {/* Ferris-wheel boarding placard */}
        {nearWheel && !riding && !near && !nearArena && (
          <div className="absolute inset-x-0 bottom-14 flex justify-center px-4">
            <div className="max-w-md rounded-lg border border-[#66e0ff]/50 bg-[#0b1020]/88 p-5 text-center backdrop-blur-sm">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#66e0ff]">
                the boardwalk
              </p>
              <p className="mt-1.5 text-lg font-black tracking-tight text-[#dbe5ff]">
                The Ferris Wheel
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                Climb aboard and take it for a spin, high over the pier.
              </p>
              <button
                type="button"
                onClick={() => rideControlRef.current?.board()}
                className="pointer-events-auto mt-4 inline-block rounded-md border border-[#66e0ff]/70 bg-[#121826]/72 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#66e0ff] hover:text-[#0b1020]"
              >
                Ride the wheel
                <span className="ml-2 hidden text-[10px] text-ink-dim sm:inline">
                  or press E
                </span>
              </button>
            </div>
          </div>
        )}

        {/* riding the wheel — get off */}
        {riding && (
          <div className="absolute inset-x-0 bottom-14 flex justify-center px-4">
            <button
              type="button"
              onClick={() => rideControlRef.current?.exit()}
              className="pointer-events-auto rounded-md border border-[#66e0ff]/70 bg-[#0b1020]/88 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] backdrop-blur-sm transition-colors hover:bg-[#66e0ff] hover:text-[#0b1020]"
            >
              Get off the wheel
              <span className="ml-2 hidden text-[10px] text-ink-dim sm:inline">
                or press E
              </span>
            </button>
          </div>
        )}

        {/* wall interaction prompt (under the crosshair) */}
        {focusPrompt && !viewer && !editor && (
          <div className="absolute inset-x-0 top-[57%] flex justify-center px-4">
            <p className="rounded-md border border-white/14 bg-[#0b1020]/85 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dbe5ff] backdrop-blur-sm">
              {focusPrompt}
            </p>
          </div>
        )}
      </div>

      {/* enter overlay (desktop) */}
      {showDesktopOverlay && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-black/80 px-6 py-10 text-center">
          <p className="text-2xl font-black uppercase tracking-[0.24em] text-[#dbe5ff]">
            the construct
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            A boardwalk pier over open water. Walk the planks, step into the
            storefronts, and claim a space of your own. Anyone else out here
            appears as a glowing orb — talk, or type in the group chat.
          </p>
          {identityControls}
          <button
            type="button"
            onClick={enterDesktop}
            className="w-full max-w-xs rounded-md border border-[#8fb3ff]/60 bg-[#121826]/72 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
          >
            enter the construct
          </button>
          <Link
            href="/rabbit-hole"
            className="text-xs uppercase tracking-[0.22em] text-ink-dim underline-offset-4 transition-colors hover:text-[#dbe5ff] hover:underline"
          >
            back to the environment page
          </Link>
        </div>
      )}

      {/* tap-to-enter overlay (mobile) — pick control style */}
      {showTouchOverlay && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-black/85 px-6 py-10 text-center">
          <p className="text-2xl font-black uppercase tracking-[0.24em] text-[#dbe5ff]">
            the construct
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            A boardwalk pier of storefronts over open water. Walk the planks,
            look around, and claim a space. Anyone else out here appears as a
            glowing orb — talk, or type in the group chat.
          </p>
          {identityControls}
          <button
            type="button"
            onClick={() => enterTouch(true)}
            className="w-full max-w-xs rounded-md border border-[#8fb3ff]/60 bg-[#121826]/72 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors active:bg-[#dbe5ff] active:text-[#0b1020]"
          >
            enter with motion controls
            <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-ink-soft">
              move your phone to look around, AR style
            </span>
          </button>
          <button
            type="button"
            onClick={() => enterTouch(false)}
            className="w-full max-w-xs rounded-md border border-white/18 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-ink-soft transition-colors active:bg-[#dbe5ff] active:text-[#0b1020]"
          >
            enter with touch controls
            <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-ink-dim">
              drag to look, thumb to walk
            </span>
          </button>
          <Link
            href="/rabbit-hole"
            className="mt-2 text-xs uppercase tracking-[0.22em] text-ink-dim underline-offset-4 transition-colors hover:text-[#dbe5ff]"
          >
            back to the environment page
          </Link>
        </div>
      )}

      {/* Talk to the dog — the site guide */}
      {guideOpen && (
        <div className="pointer-events-auto absolute inset-0 z-40 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="flex h-[75vh] w-full max-w-md flex-col rounded-xl border border-[#f0c36a]/30 bg-[#0b1020] shadow-2xl sm:h-[70vh]">
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#f0c36a]">
                  🐾 Chance
                </p>
                <p className="text-[11px] text-ink-dim">
                  Travis&apos;s dog · ask about the site
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (guideSpeak) stopDogVoice();
                    setGuideSpeak((v) => !v);
                  }}
                  className={`rounded-md border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                    guideSpeak
                      ? "border-[#f0c36a]/70 bg-[#f0c36a]/15 text-[#f0c36a]"
                      : "border-white/18 text-ink-dim hover:text-ink-soft"
                  }`}
                >
                  {guideSpeak ? "🔊 voice" : "🔇 muted"}
                </button>
                <button
                  type="button"
                  onClick={closeGuide}
                  className="rounded-md border border-white/20 px-3 py-1.5 text-[11px] uppercase tracking-wider text-ink-soft hover:bg-white/10"
                >
                  close
                </button>
              </div>
            </div>

            <div
              ref={guideScrollRef}
              className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
            >
              {guideMsgs.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user" ? "flex justify-end" : "flex justify-start"
                  }
                >
                  <p
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#8fb3ff]/20 text-[#dbe5ff]"
                        : "bg-white/[0.06] text-ink-soft"
                    }`}
                  >
                    {m.content}
                  </p>
                </div>
              ))}
              {guideBusy && (
                <div className="flex justify-start">
                  <p className="rounded-2xl bg-white/[0.06] px-3.5 py-2 text-sm text-ink-dim">
                    …sniffing around for an answer
                  </p>
                </div>
              )}
            </div>

            <form
              onSubmit={sendToDog}
              className="flex gap-2 border-t border-white/10 p-3"
            >
              <input
                value={guideInput}
                onChange={(e) => setGuideInput(e.target.value)}
                autoFocus
                maxLength={2000}
                placeholder="Ask the dog about the site…"
                className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-[#dbe5ff] outline-none focus:border-[#f0c36a]"
              />
              <button
                type="submit"
                disabled={guideBusy || !guideInput.trim()}
                className="shrink-0 rounded-lg border border-[#f0c36a]/60 bg-[#121826]/72 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-[#f0c36a] transition-colors hover:bg-[#f0c36a] hover:text-[#0b1020] disabled:opacity-40"
              >
                ask
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Wall content viewer — one thing plays at a time */}
      {viewer && (
        <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/92 p-4">
          <button
            type="button"
            onClick={() => setViewer(null)}
            className="absolute right-4 top-4 rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
          >
            close ✕
          </button>
          {viewer.title && (
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#dbe5ff]">
              {viewer.title}
            </p>
          )}
          {viewer.kind === "youtube" && viewerYouTube && (
            <iframe
              title={viewer.title || "video"}
              className="aspect-video w-full max-w-4xl rounded-lg border border-white/12"
              src={`https://www.youtube.com/embed/${viewerYouTube}?autoplay=1&rel=0`}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
          )}
          {viewer.kind === "website" && (
            <>
              <iframe
                title={viewer.title || "website"}
                className="h-[70vh] w-full max-w-5xl rounded-lg border border-white/12 bg-white"
                src={viewer.src}
              />
              <a
                href={viewer.src}
                target="_blank"
                rel="noreferrer"
                className="text-xs uppercase tracking-[0.2em] text-ink-dim transition-colors hover:text-[#dbe5ff]"
              >
                open in a new tab ↗
              </a>
            </>
          )}
          {viewer.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewerImageSrc}
              alt={viewer.title || ""}
              className="max-h-[82vh] max-w-full rounded-lg border border-white/12 object-contain"
            />
          )}
        </div>
      )}

      {/* Owner wall editor — walk up to your own wall and set what hangs there */}
      {editor && (
        <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/14 bg-[#0b1020] p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#dbe5ff]">
                edit wall · unit {editor.unit}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditor(null);
                  setWallError("");
                }}
                className="text-ink-dim transition-colors hover:text-[#dbe5ff]"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex gap-1.5">
              {(["empty", "image", "website", "youtube"] as WallKind[]).map(
                (k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setEditor((e) => (e ? { ...e, kind: k } : e))}
                    className={`rounded-md border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                      editor.kind === k
                        ? "border-[#8fb3ff] text-[#8fb3ff]"
                        : "border-white/18 text-ink-dim hover:text-ink-soft"
                    }`}
                  >
                    {k === "empty" ? "blank" : k}
                  </button>
                ),
              )}
            </div>

            {editor.kind !== "empty" && (
              <div className="mt-4 space-y-3">
                <input
                  value={editor.src}
                  onChange={(e) =>
                    setEditor((x) => (x ? { ...x, src: e.target.value } : x))
                  }
                  placeholder={
                    editor.kind === "image"
                      ? "https://image-url… (or upload)"
                      : editor.kind === "youtube"
                        ? "https://youtube.com/watch?v=…"
                        : "https://your-site.com"
                  }
                  className="w-full rounded-lg border border-white/18 bg-black/50 px-3 py-2 text-sm text-[#dbe5ff] outline-none focus:border-[#8fb3ff]"
                />
                <input
                  value={editor.title}
                  onChange={(e) =>
                    setEditor((x) => (x ? { ...x, title: e.target.value } : x))
                  }
                  placeholder="caption (optional)"
                  maxLength={80}
                  className="w-full rounded-lg border border-white/18 bg-black/50 px-3 py-2 text-sm text-[#dbe5ff] outline-none focus:border-[#8fb3ff]"
                />
                {editor.kind === "image" && (
                  <div>
                    <button
                      type="button"
                      onClick={() => editorFileRef.current?.click()}
                      disabled={wallBusy}
                      className="rounded-md border border-white/18 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-[#8fb3ff] hover:text-[#8fb3ff] disabled:opacity-50"
                    >
                      {wallBusy ? "uploading…" : "upload image"}
                    </button>
                    <input
                      ref={editorFileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadWallImage(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {wallError && (
              <p className="mt-3 text-sm text-pill-red">{wallError}</p>
            )}

            <div className="mt-5 flex items-center gap-4">
              <button
                type="button"
                onClick={saveWall}
                disabled={wallBusy}
                className="rounded-lg border border-[#8fb3ff]/60 bg-[#121826]/72 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020] disabled:opacity-50"
              >
                {wallBusy ? "saving…" : "save wall"}
              </button>
              <Link
                href="/studio"
                className="text-xs uppercase tracking-[0.18em] text-ink-dim transition-colors hover:text-[#dbe5ff]"
              >
                full back office →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
