import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

// Block obvious internal targets to limit SSRF; this is a best-effort guard.
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

// Fetch a remote image and re-serve it same-origin so it can be used as a
// WebGL texture on a studio wall without cross-origin tainting.
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url") ?? "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Bad url." }, { status: 400 });
  }
  if (
    (target.protocol !== "http:" && target.protocol !== "https:") ||
    isBlockedHost(target.hostname)
  ) {
    return NextResponse.json({ error: "Blocked." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed." }, { status: 502 });
  }

  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !type.startsWith("image/")) {
    return NextResponse.json({ error: "Not an image." }, { status: 415 });
  }
  const buf = Buffer.from(await upstream.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Too large." }, { status: 413 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
