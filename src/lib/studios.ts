import { promises as fs } from "fs";
import path from "path";
import { storefronts } from "./content";

// Studio ownership + wall content for each storefront unit. Same volume
// convention as auth/analytics so it survives redeploys (mount DATA_DIR).
const DATA_DIR =
  process.env.DATA_DIR ??
  process.env.COMMENTS_DIR ??
  path.join(process.cwd(), "data");
const STUDIOS_FILE = path.join(DATA_DIR, "studios.json");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
export const VRM_DIR = path.join(DATA_DIR, "vrm");
export const SHOTS_DIR = path.join(DATA_DIR, "shots");

export type WallKind = "empty" | "image" | "website" | "youtube";

export type WallSlot = {
  id: string; // one of WALL_IDS
  kind: WallKind;
  src: string; // image URL / upload path, website URL, or youtube URL
  title: string;
};

export type MerchLink = { label: string; url: string };

export type Studio = {
  unit: string; // "01".."10"
  ownerUserId: string | null;
  ownerEmail: string | null;
  studioName: string;
  // Public-facing signage the owner controls. `proprietor` is a display name
  // ("Run by …" — never their email), `tagline` is the spiel a visitor reads
  // when they walk up to the unit. Both empty until the owner sets them.
  proprietor: string;
  tagline: string;
  walls: WallSlot[];
  links: MerchLink[];
  // An uploaded VRM avatar that walks around inside the unit ("" = none).
  // Stored as the same-origin serve path: /api/studio/vrm?f=<uuid>.vrm
  vrmSrc: string;
  // Owner tweaks for the avatar: a size multiplier on top of the auto-fit
  // height, and a facing offset in degrees (some models face the wrong way).
  avatarScale: number;
  avatarYaw: number;
  // The game this unit hosts in the Arena. Renting a unit gets you a pod in
  // the Superdome; point it at your own app (e.g. a Railway deployment) and
  // the pod goes live. Empty gameUrl = the pod shows "coming soon".
  gameName: string;
  gameTagline: string;
  gameUrl: string;
};

// What a visitor's client sees — no owner identity leaks out.
export type PublicStudio = {
  unit: string;
  // Whether an owner has been assigned this unit. Drives the storefront's
  // "taken vs for lease" signage in the Construct.
  claimed: boolean;
  studioName: string;
  proprietor: string;
  tagline: string;
  walls: WallSlot[];
  vrmSrc: string;
  avatarScale: number;
  avatarYaw: number;
};

// One pod in the Arena lobby, derived from a unit. The accent comes from the
// storefront so a pod matches the look of its shop on the street. No owner
// identity leaks out.
export type PublicArenaGame = {
  unit: string; // "01".."10"
  name: string;
  tagline: string;
  accent: string; // hex, drives the pod's light and sign
  status: "live" | "soon"; // "live" once the owner sets a game URL
  href: string; // the owner's game URL when live, else ""
};

// The three poster slots every unit gets: back wall + the two side walls.
export const WALL_IDS = ["center", "left", "right"] as const;
export const WALL_LABELS: Record<string, string> = {
  center: "Back wall",
  left: "Left wall",
  right: "Right wall",
};

const MAX_URL = 600;
const MAX_TITLE = 80;
const MAX_NAME = 60;
const MAX_LINKS = 12;
const MAX_LABEL = 60;
const MAX_TAGLINE = 100;
const MAX_SPIEL = 180; // the storefront walk-up spiel

type StudioStore = Record<string, Studio>;

let writeLock: Promise<unknown> = Promise.resolve();
function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = writeLock.then(task, task);
  writeLock = run.catch(() => undefined);
  return run;
}

async function readStore(): Promise<StudioStore> {
  try {
    const parsed = JSON.parse(await fs.readFile(STUDIOS_FILE, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStore(store: StudioStore): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STUDIOS_FILE, JSON.stringify(store, null, 2), "utf8");
}

function validUnit(unit: unknown): unit is string {
  return (
    typeof unit === "string" && storefronts.some((s) => s.number === unit)
  );
}

function defaultStudio(unit: string): Studio {
  const front = storefronts.find((s) => s.number === unit);
  return {
    unit,
    ownerUserId: null,
    ownerEmail: null,
    studioName: front ? front.name : `Unit ${unit}`,
    proprietor: "",
    tagline: "",
    walls: WALL_IDS.map((id) => ({ id, kind: "empty", src: "", title: "" })),
    links: [],
    vrmSrc: "",
    avatarScale: 1,
    avatarYaw: 0,
    gameName: "",
    gameTagline: "",
    gameUrl: "",
  };
}

// Owners can grow the avatar but not turn it into a skyscraper — cap the
// multiplier. (Auto-fit height ≈ 1.7 m, so 3x ≈ 5 m, under the 7 m ceiling.)
export const AVATAR_SCALE_MIN = 0.5;
export const AVATAR_SCALE_MAX = 3;

function clampAvatarScale(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(AVATAR_SCALE_MAX, Math.max(AVATAR_SCALE_MIN, n));
}

function normalizeAvatarYaw(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return ((Math.round(n) % 360) + 360) % 360;
}

// The avatar path is one we minted ourselves in /api/studio/vrm; only accept
// that same-origin shape so nothing arbitrary ends up loaded into the scene.
function cleanVrmSrc(value: unknown): string {
  if (typeof value !== "string") return "";
  const s = value.trim().slice(0, MAX_URL);
  if (!s) return "";
  return /^\/api\/studio\/vrm\?f=[a-f0-9-]{36}\.(vrm|glb|gltf|fbx)$/i.test(s)
    ? s
    : "";
}

// Parse a YouTube video id out of a URL (or a bare id). Shared by the back
// office, the wall renderer, and the play overlay so they all agree.
export function youtubeId(input: string): string | null {
  const s = (input ?? "").trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.slice(1, 12);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const m = u.pathname.match(/\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // not a URL
  }
  return null;
}

// The owner's game lives on their own host (e.g. a Railway app), so unlike
// wall content it must be an absolute http(s) URL — no same-origin shortcuts.
function cleanGameUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const s = value.trim().slice(0, MAX_URL);
  if (!s) return "";
  try {
    const u = new URL(s);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    // not a URL
  }
  return "";
}

function cleanUrl(value: unknown, kind: WallKind): string {
  if (typeof value !== "string") return "";
  const s = value.trim().slice(0, MAX_URL);
  if (!s) return "";
  if (kind === "youtube") return youtubeId(s) ? s : "";
  // Uploaded assets are same-origin; everything else must be http(s).
  if (s.startsWith("/api/uploads")) return s;
  if (/^https?:\/\//i.test(s)) return s;
  return "";
}

function sanitizeWall(id: string, raw: unknown): WallSlot {
  const w = (raw ?? {}) as Partial<WallSlot>;
  let kind: WallKind =
    w.kind === "image" || w.kind === "website" || w.kind === "youtube"
      ? w.kind
      : "empty";
  const src = cleanUrl(w.src, kind);
  if (kind !== "empty" && !src) kind = "empty";
  const title =
    typeof w.title === "string" ? w.title.trim().slice(0, MAX_TITLE) : "";
  return { id, kind, src, title };
}

function sanitizeLinks(raw: unknown): MerchLink[] {
  if (!Array.isArray(raw)) return [];
  const out: MerchLink[] = [];
  for (const item of raw.slice(0, MAX_LINKS)) {
    const l = (item ?? {}) as Partial<MerchLink>;
    const label =
      typeof l.label === "string" ? l.label.trim().slice(0, MAX_LABEL) : "";
    const url =
      typeof l.url === "string" && /^https?:\/\//i.test(l.url.trim())
        ? l.url.trim().slice(0, MAX_URL)
        : "";
    if (label && url) out.push({ label, url });
  }
  return out;
}

export async function listStudios(): Promise<Studio[]> {
  const store = await readStore();
  return storefronts.map((s) => store[s.number] ?? defaultStudio(s.number));
}

export async function getPublicStudios(): Promise<PublicStudio[]> {
  const all = await listStudios();
  return all.map((s) => ({
    unit: s.unit,
    claimed: s.ownerUserId != null,
    studioName: s.studioName,
    proprietor: s.proprietor ?? "",
    tagline: s.tagline ?? "",
    walls: s.walls,
    vrmSrc: s.vrmSrc ?? "",
    avatarScale: s.avatarScale ?? 1,
    avatarYaw: s.avatarYaw ?? 0,
  }));
}

// The Arena lobby: every unit is a pod, in street order. A unit whose owner
// has set a game URL is "live"; the rest read "coming soon". The pod's accent
// and fallback name come from the storefront so a pod matches its shop.
export async function getPublicArenaGames(): Promise<PublicArenaGame[]> {
  const all = await listStudios();
  return all.map((s) => {
    const front = storefronts.find((f) => f.number === s.unit);
    const href = cleanGameUrl(s.gameUrl);
    const name =
      (s.gameName ?? "").trim() || s.studioName || `Unit ${s.unit}`;
    const tagline =
      (s.gameTagline ?? "").trim() || "A world hosted from this unit's shop.";
    return {
      unit: s.unit,
      name,
      tagline,
      accent: front?.accent ?? "#66e0ff",
      status: href ? "live" : "soon",
      href,
    };
  });
}

export async function getStudiosByOwner(userId: string): Promise<Studio[]> {
  const store = await readStore();
  return Object.values(store)
    .filter((s) => s.ownerUserId === userId)
    .sort((a, b) => (a.unit < b.unit ? -1 : 1));
}

export async function assignUnit(
  unit: string,
  ownerUserId: string,
  ownerEmail: string,
): Promise<Studio | null> {
  if (!validUnit(unit)) return null;
  return withLock(async () => {
    const store = await readStore();
    const studio = store[unit] ?? defaultStudio(unit);
    studio.ownerUserId = ownerUserId;
    studio.ownerEmail = ownerEmail;
    // Drop the "For Lease" placeholder the moment the unit is taken, so its
    // sign and placard stop advertising a vacancy. The owner renames it in the
    // back office; until then it reads as a neutral "Unit NN".
    const front = storefronts.find((f) => f.number === unit);
    if (
      !studio.studioName.trim() ||
      (front?.status === "vacant" && studio.studioName === front.name)
    ) {
      studio.studioName = `Unit ${unit}`;
    }
    studio.proprietor = studio.proprietor ?? "";
    studio.tagline = studio.tagline ?? "";
    store[unit] = studio;
    await writeStore(store);
    return studio;
  });
}

export async function vacateUnit(unit: string): Promise<boolean> {
  if (!validUnit(unit)) return false;
  return withLock(async () => {
    const store = await readStore();
    const studio = store[unit];
    if (!studio) return false;
    studio.ownerUserId = null;
    studio.ownerEmail = null;
    await writeStore(store);
    return true;
  });
}

export async function updateStudio(
  unit: string,
  patch: {
    studioName?: unknown;
    proprietor?: unknown;
    tagline?: unknown;
    walls?: unknown;
    links?: unknown;
    vrmSrc?: unknown;
    avatarScale?: unknown;
    avatarYaw?: unknown;
    gameName?: unknown;
    gameTagline?: unknown;
    gameUrl?: unknown;
  },
  by: { userId: string; isAdmin: boolean },
): Promise<Studio | { error: string }> {
  if (!validUnit(unit)) return { error: "Unknown unit." };
  return withLock(async () => {
    const store = await readStore();
    const studio = store[unit] ?? defaultStudio(unit);
    if (!by.isAdmin && studio.ownerUserId !== by.userId) {
      return { error: "This isn't your storefront." };
    }
    if (typeof patch.studioName === "string" && patch.studioName.trim()) {
      studio.studioName = patch.studioName.trim().slice(0, MAX_NAME);
    }
    if (typeof patch.proprietor === "string") {
      studio.proprietor = patch.proprietor.trim().slice(0, MAX_NAME);
    }
    if (typeof patch.tagline === "string") {
      studio.tagline = patch.tagline.trim().slice(0, MAX_SPIEL);
    }
    if (Array.isArray(patch.walls)) {
      studio.walls = WALL_IDS.map((id) =>
        sanitizeWall(
          id,
          (patch.walls as unknown[]).find(
            (w) => (w as { id?: string })?.id === id,
          ),
        ),
      );
    }
    if (patch.links !== undefined) {
      studio.links = sanitizeLinks(patch.links);
    }
    if (patch.vrmSrc !== undefined) {
      studio.vrmSrc = cleanVrmSrc(patch.vrmSrc);
    }
    if (patch.avatarScale !== undefined) {
      studio.avatarScale = clampAvatarScale(patch.avatarScale);
    }
    if (patch.avatarYaw !== undefined) {
      studio.avatarYaw = normalizeAvatarYaw(patch.avatarYaw);
    }
    if (typeof patch.gameName === "string") {
      studio.gameName = patch.gameName.trim().slice(0, MAX_NAME);
    }
    if (typeof patch.gameTagline === "string") {
      studio.gameTagline = patch.gameTagline.trim().slice(0, MAX_TAGLINE);
    }
    if (patch.gameUrl !== undefined) {
      studio.gameUrl = cleanGameUrl(patch.gameUrl);
    }
    studio.proprietor = studio.proprietor ?? "";
    studio.tagline = studio.tagline ?? "";
    studio.vrmSrc = studio.vrmSrc ?? "";
    studio.avatarScale = studio.avatarScale ?? 1;
    studio.avatarYaw = studio.avatarYaw ?? 0;
    studio.gameName = studio.gameName ?? "";
    studio.gameTagline = studio.gameTagline ?? "";
    studio.gameUrl = studio.gameUrl ?? "";
    store[unit] = studio;
    await writeStore(store);
    return studio;
  });
}
