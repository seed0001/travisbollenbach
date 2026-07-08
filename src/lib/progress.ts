import { promises as fs } from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Player progression. XP, points, avatar identity, and cleared rooms live on
// the same data volume as accounts (see auth.ts). The lobby server reads
// progress.json directly (server/lobby.mjs), so the file shape here is the
// contract between the two.
// ---------------------------------------------------------------------------

const DATA_DIR =
  process.env.DATA_DIR ??
  process.env.COMMENTS_DIR ??
  path.join(process.cwd(), "data");
const PROGRESS_FILE = path.join(DATA_DIR, "progress.json");

export type Progress = {
  xp: number;
  points: number;
  /** avatar body color, degrees on the hue wheel */
  avatarHue: number;
  /** room ids the player has escaped, in clear order */
  roomsCleared: string[];
  /** shard ids collected in the galaxy room */
  galaxyShards: string[];
  /** per-room collected item ids (rooms after the galaxy use this) */
  collectibles?: Record<string, string[]>;
  firstJoinedLobbyAt?: string;
  updatedAt: string;
};

type ProgressFile = Record<string, Progress>;

let writeLock: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = writeLock.then(task, task);
  writeLock = run.catch(() => undefined);
  return run;
}

async function readAll(): Promise<ProgressFile> {
  try {
    return JSON.parse(await fs.readFile(PROGRESS_FILE, "utf8")) as ProgressFile;
  } catch {
    return {};
  }
}

async function writeAll(data: ProgressFile): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(data, null, 2), "utf8");
}

/** A stable default hue derived from the user id, so every player has a color
 * before they ever open the picker. Matches the derivation in server/lobby.mjs. */
export function defaultHue(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i += 1) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

function blank(userId: string): Progress {
  return {
    xp: 0,
    points: 0,
    avatarHue: defaultHue(userId),
    roomsCleared: [],
    galaxyShards: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function getProgress(userId: string): Promise<Progress> {
  const all = await readAll();
  const record = all[userId] ?? blank(userId);
  // records written before the galaxy room existed lack the field
  if (!Array.isArray(record.galaxyShards)) record.galaxyShards = [];
  return record;
}

export async function setAvatarHue(
  userId: string,
  hue: number,
): Promise<Progress> {
  return withLock(async () => {
    const all = await readAll();
    const record = all[userId] ?? blank(userId);
    record.avatarHue = Math.round(Math.min(360, Math.max(0, hue)));
    record.updatedAt = new Date().toISOString();
    all[userId] = record;
    await writeAll(all);
    return record;
  });
}

export async function addXp(
  userId: string,
  amount: number,
  opts: { points?: number; roomCleared?: string } = {},
): Promise<Progress> {
  return withLock(async () => {
    const all = await readAll();
    const record = all[userId] ?? blank(userId);
    record.xp += Math.max(0, Math.round(amount));
    if (opts.points) record.points += Math.max(0, Math.round(opts.points));
    if (opts.roomCleared && !record.roomsCleared.includes(opts.roomCleared)) {
      record.roomsCleared.push(opts.roomCleared);
    }
    record.updatedAt = new Date().toISOString();
    all[userId] = record;
    await writeAll(all);
    return record;
  });
}

/** Pick up a shard in the galaxy room. Idempotent per shard; collecting the
 * full set clears the room and pays the bonus exactly once. */
export async function collectShard(
  userId: string,
  shardId: string,
  opts: { shardXp: number; totalShards: number; clearXp: number; roomId: string },
): Promise<{ progress: Progress; added: boolean; clearedNow: boolean }> {
  return withLock(async () => {
    const all = await readAll();
    const record = all[userId] ?? blank(userId);
    if (!Array.isArray(record.galaxyShards)) record.galaxyShards = [];
    if (record.galaxyShards.includes(shardId)) {
      return { progress: record, added: false, clearedNow: false };
    }
    record.galaxyShards.push(shardId);
    record.xp += opts.shardXp;
    let clearedNow = false;
    if (
      record.galaxyShards.length >= opts.totalShards &&
      !record.roomsCleared.includes(opts.roomId)
    ) {
      record.roomsCleared.push(opts.roomId);
      record.xp += opts.clearXp;
      record.points += 50;
      clearedNow = true;
    }
    record.updatedAt = new Date().toISOString();
    all[userId] = record;
    await writeAll(all);
    return { progress: record, added: true, clearedNow };
  });
}

/** Pick up a collectible in any room (the generalized successor to
 * collectShard). Idempotent per item; completing the set clears the room. */
export async function collectItem(
  userId: string,
  roomId: string,
  itemId: string,
  opts: { itemXp: number; totalItems: number; clearXp: number },
): Promise<{ progress: Progress; added: boolean; clearedNow: boolean }> {
  return withLock(async () => {
    const all = await readAll();
    const record = all[userId] ?? blank(userId);
    if (!record.collectibles) record.collectibles = {};
    const held = record.collectibles[roomId] ?? [];
    if (held.includes(itemId)) {
      return { progress: record, added: false, clearedNow: false };
    }
    held.push(itemId);
    record.collectibles[roomId] = held;
    record.xp += opts.itemXp;
    let clearedNow = false;
    if (
      held.length >= opts.totalItems &&
      !record.roomsCleared.includes(roomId)
    ) {
      record.roomsCleared.push(roomId);
      record.xp += opts.clearXp;
      record.points += 50;
      clearedNow = true;
    }
    record.updatedAt = new Date().toISOString();
    all[userId] = record;
    await writeAll(all);
    return { progress: record, added: true, clearedNow };
  });
}

/** First time a player ever enters the lobby: stamp it and grant arrival XP. */
export async function markLobbyJoin(userId: string): Promise<Progress> {
  return withLock(async () => {
    const all = await readAll();
    const record = all[userId] ?? blank(userId);
    if (!record.firstJoinedLobbyAt) {
      record.firstJoinedLobbyAt = new Date().toISOString();
      record.xp += 10;
    }
    record.updatedAt = new Date().toISOString();
    all[userId] = record;
    await writeAll(all);
    return record;
  });
}
