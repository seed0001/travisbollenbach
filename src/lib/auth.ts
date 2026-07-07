import { promises as fs } from "fs";
import path from "path";
import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "crypto";
import { promisify } from "util";

// Same volume convention as the comments API: point DATA_DIR (or the existing
// COMMENTS_DIR) at a mounted volume in production so accounts survive redeploys.
const DATA_DIR =
  process.env.DATA_DIR ??
  process.env.COMMENTS_DIR ??
  path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

export const SESSION_COOKIE = "tb_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const MAX_SESSIONS = 5000;

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string; // "<salt hex>:<scrypt key hex>"
  role: "admin" | "user";
  createdAt: string;
};

export type PublicUser = Omit<User, "passwordHash">;

type Session = {
  tokenHash: string;
  userId: string;
  expiresAt: string;
};

// File writes are read-modify-write; serialize them so two requests can't
// clobber each other within this instance.
let writeLock: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = writeLock.then(task, task);
  writeLock = run.catch(() => undefined);
  return run;
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

/** When ADMIN_EMAIL is set, the admin seat is pinned to that address — no one
 * else can claim it, even on a brand-new (or wiped) database. Without it, the
 * first account to register owns the ship. */
function pinnedAdminEmail(): string | null {
  return normalizeEmail(process.env.ADMIN_EMAIL);
}

export async function createUser(input: {
  email: string;
  password: string;
  name: string;
}): Promise<PublicUser | { error: string }> {
  return withLock(async () => {
    const users = await readJson<User[]>(USERS_FILE, []);
    if (users.some((u) => u.email === input.email)) {
      return { error: "An account with that email already exists." };
    }
    const adminEmail = pinnedAdminEmail();
    const user: User = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      role: adminEmail
        ? input.email === adminEmail
          ? "admin"
          : "user"
        : users.length === 0
          ? "admin"
          : "user",
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    await writeJson(USERS_FILE, users);
    return toPublicUser(user);
  });
}

export async function authenticate(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const users = await readJson<User[]>(USERS_FILE, []);
  const user = users.find((u) => u.email === email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return null;
  }
  // If the admin seat is pinned to this address, restore the role on login —
  // covers accounts created before ADMIN_EMAIL was set or after a data wipe.
  if (user.role !== "admin" && user.email === pinnedAdminEmail()) {
    await withLock(async () => {
      const current = await readJson<User[]>(USERS_FILE, []);
      const record = current.find((u) => u.id === user.id);
      if (record && record.role !== "admin") {
        record.role = "admin";
        await writeJson(USERS_FILE, current);
      }
    });
    user.role = "admin";
  }
  return toPublicUser(user);
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  await withLock(async () => {
    const sessions = await readJson<Session[]>(SESSIONS_FILE, []);
    const live = sessions.filter((s) => Date.parse(s.expiresAt) > now);
    live.push({
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(now + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
    });
    await writeJson(SESSIONS_FILE, live.slice(-MAX_SESSIONS));
  });
  return token;
}

export async function getUserBySession(
  token: string,
): Promise<PublicUser | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const sessions = await readJson<Session[]>(SESSIONS_FILE, []);
  const session = sessions.find(
    (s) => s.tokenHash === tokenHash && Date.parse(s.expiresAt) > Date.now(),
  );
  if (!session) return null;
  const users = await readJson<User[]>(USERS_FILE, []);
  const user = users.find((u) => u.id === session.userId);
  return user ? toPublicUser(user) : null;
}

export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  const tokenHash = hashToken(token);
  await withLock(async () => {
    const sessions = await readJson<Session[]>(SESSIONS_FILE, []);
    const remaining = sessions.filter((s) => s.tokenHash !== tokenHash);
    if (remaining.length !== sessions.length) {
      await writeJson(SESSIONS_FILE, remaining);
    }
  });
}
