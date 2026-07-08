import { NextRequest, NextResponse } from "next/server";
import {
  authenticate,
  createSession,
  normalizeEmail,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";

const RATE_LIMIT = 10; // attempts per window per IP
const RATE_WINDOW_MS = 10 * 60 * 1000;

const recentAttempts = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const stamps = (recentAttempts.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (stamps.length >= RATE_LIMIT) {
    recentAttempts.set(ip, stamps);
    return true;
  }
  stamps.push(now);
  recentAttempts.set(ip, stamps);
  return false;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts — try again in a few minutes." },
      { status: 429 },
    );
  }

  const user = await authenticate(email, password);
  if (!user) {
    return NextResponse.json(
      { error: "Wrong email or password." },
      { status: 401 },
    );
  }

  const token = await createSession(user.id);
  const response = NextResponse.json(user);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
