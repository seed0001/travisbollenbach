import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  createUser,
  normalizeEmail,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";

const MAX_NAME = 40;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;
const RATE_LIMIT = 5; // signups per window per IP
const RATE_WINDOW_MS = 60 * 60 * 1000;

const recentSignups = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const stamps = (recentSignups.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (stamps.length >= RATE_LIMIT) {
    recentSignups.set(ip, stamps);
    return true;
  }
  stamps.push(now);
  recentSignups.set(ip, stamps);
  return false;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  // Honeypot: real visitors never fill this hidden field
  if (body.website) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const name =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim().slice(0, MAX_NAME)
      : (email?.split("@")[0] ?? "");

  if (!email) {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400 },
    );
  }
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD} characters.` },
      { status: 400 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Slow down — try again later." },
      { status: 429 },
    );
  }

  const result = await createUser({ email, password, name });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  const token = await createSession(result.id);
  const response = NextResponse.json(result, { status: 201 });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
