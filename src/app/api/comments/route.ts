import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

// Set COMMENTS_DIR to a mounted volume path in production (e.g. /data on
// Railway) so comments survive redeploys. Falls back to ./data locally.
const DATA_DIR = process.env.COMMENTS_DIR ?? path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "comments.json");

const MAX_NAME = 40;
const MAX_MESSAGE = 500;
const MAX_STORED = 1000;
const RATE_LIMIT = 5; // posts per window per IP
const RATE_WINDOW_MS = 10 * 60 * 1000;

export type StoredComment = {
  id: string;
  name: string;
  message: string;
  createdAt: string;
};

async function readComments(): Promise<StoredComment[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Simple in-memory rate limiter — per server instance, which is fine here
const recentPosts = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const stamps = (recentPosts.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (stamps.length >= RATE_LIMIT) {
    recentPosts.set(ip, stamps);
    return true;
  }
  stamps.push(now);
  recentPosts.set(ip, stamps);
  // keep the map from growing unbounded
  if (recentPosts.size > 5000) {
    for (const [key, value] of recentPosts) {
      if (value.every((t) => now - t >= RATE_WINDOW_MS)) {
        recentPosts.delete(key);
      }
    }
  }
  return false;
}

function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  // strip control characters (newlines allowed), collapse newline runs
  const trimmed = value
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

export async function GET() {
  const comments = await readComments();
  // newest first, cap the payload
  return NextResponse.json(comments.slice(-100).reverse());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  // Honeypot: real visitors never fill this hidden field
  if (body.website) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const name = clean(body.name, MAX_NAME);
  const message = clean(body.message, MAX_MESSAGE);
  if (!name || !message) {
    return NextResponse.json(
      {
        error: `Name (up to ${MAX_NAME} chars) and message (up to ${MAX_MESSAGE}) are required.`,
      },
      { status: 400 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Slow down — try again in a few minutes." },
      { status: 429 },
    );
  }

  const comment: StoredComment = {
    id: crypto.randomUUID(),
    name,
    message,
    createdAt: new Date().toISOString(),
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  const comments = await readComments();
  comments.push(comment);
  await fs.writeFile(
    DATA_FILE,
    JSON.stringify(comments.slice(-MAX_STORED), null, 2),
    "utf8",
  );

  return NextResponse.json(comment, { status: 201 });
}
