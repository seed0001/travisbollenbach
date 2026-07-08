import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";

// Same volume convention as comments/auth so stats survive redeploys.
const DATA_DIR =
  process.env.DATA_DIR ??
  process.env.COMMENTS_DIR ??
  path.join(process.cwd(), "data");
const ANALYTICS_FILE = path.join(DATA_DIR, "analytics.json");

const MAX_DAYS = 120;
const MAX_PATHS_PER_DAY = 200;
const MAX_REFERRERS_PER_DAY = 100;
const MAX_UNIQUES_PER_DAY = 5000;

export type DayStats = {
  views: Record<string, number>;
  referrers: Record<string, number>;
  uniques: string[];
};

// Keyed by UTC day, "YYYY-MM-DD"
export type AnalyticsData = Record<string, DayStats>;

let writeLock: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = writeLock.then(task, task);
  writeLock = run.catch(() => undefined);
  return run;
}

export async function readAnalytics(): Promise<AnalyticsData> {
  try {
    const parsed = JSON.parse(await fs.readFile(ANALYTICS_FILE, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Normalize a tracked path: no query/hash, no trailing slash, capped length. */
export function cleanPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  let p = value.split(/[?#]/)[0];
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  if (!p || p.length > 120) return null;
  // internal routes aren't visitor traffic
  if (p.startsWith("/api") || p.startsWith("/admin") || p.startsWith("/_next")) {
    return null;
  }
  return p;
}

/** Extract just the host from a referrer URL; ignore same-site referrals. */
export function cleanReferrer(value: unknown, ownHost: string): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const host = new URL(value).hostname;
    if (!host || host === ownHost || host.length > 100) return null;
    return host;
  } catch {
    return null;
  }
}

/** Day-scoped visitor fingerprint — raw IP/UA never hit disk. */
export function visitorId(ip: string, userAgent: string, day: string): string {
  return createHash("sha256")
    .update(`${ip}|${userAgent}|${day}`)
    .digest("hex")
    .slice(0, 16);
}

export async function recordPageView(input: {
  path: string;
  referrerHost: string | null;
  visitor: string;
}): Promise<void> {
  await withLock(async () => {
    const data = await readAnalytics();
    const day = dayKey();
    const stats: DayStats = data[day] ?? {
      views: {},
      referrers: {},
      uniques: [],
    };

    if (
      stats.views[input.path] !== undefined ||
      Object.keys(stats.views).length < MAX_PATHS_PER_DAY
    ) {
      stats.views[input.path] = (stats.views[input.path] ?? 0) + 1;
    }

    if (
      input.referrerHost &&
      (stats.referrers[input.referrerHost] !== undefined ||
        Object.keys(stats.referrers).length < MAX_REFERRERS_PER_DAY)
    ) {
      stats.referrers[input.referrerHost] =
        (stats.referrers[input.referrerHost] ?? 0) + 1;
    }

    if (
      !stats.uniques.includes(input.visitor) &&
      stats.uniques.length < MAX_UNIQUES_PER_DAY
    ) {
      stats.uniques.push(input.visitor);
    }

    data[day] = stats;

    // keep only the most recent MAX_DAYS days
    const days = Object.keys(data).sort();
    for (const stale of days.slice(0, Math.max(0, days.length - MAX_DAYS))) {
      delete data[stale];
    }

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(ANALYTICS_FILE, JSON.stringify(data), "utf8");
  });
}
