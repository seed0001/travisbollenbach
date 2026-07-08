import { NextRequest, NextResponse } from "next/server";
import {
  cleanPath,
  cleanReferrer,
  dayKey,
  recordPageView,
  visitorId,
} from "@/lib/analytics";

const RATE_LIMIT = 100; // pageviews per window per IP
const RATE_WINDOW_MS = 10 * 60 * 1000;

const recentHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const stamps = (recentHits.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (stamps.length >= RATE_LIMIT) {
    recentHits.set(ip, stamps);
    return true;
  }
  stamps.push(now);
  recentHits.set(ip, stamps);
  if (recentHits.size > 5000) {
    for (const [key, value] of recentHits) {
      if (value.every((t) => now - t >= RATE_WINDOW_MS)) {
        recentHits.delete(key);
      }
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new NextResponse(null, { status: 204 });
  }

  const path = cleanPath(body.path);
  if (!path) {
    return new NextResponse(null, { status: 204 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return new NextResponse(null, { status: 204 });
  }

  const ownHost = request.headers.get("host")?.split(":")[0] ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";

  await recordPageView({
    path,
    referrerHost: cleanReferrer(body.referrer, ownHost),
    visitor: visitorId(ip, userAgent, dayKey()),
  });

  return new NextResponse(null, { status: 204 });
}
