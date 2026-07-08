import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";
import { SHOTS_DIR } from "@/lib/studios";

export const dynamic = "force-dynamic";

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // refresh snapshots weekly
const MAX_BYTES = 8 * 1024 * 1024;

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

// A rendered screenshot of a site's front page, cached on the data volume.
// The actual rendering is done by an external screenshot service so we don't
// need a headless browser in production; swap the provider here if needed.
function providerUrl(target: string): string {
  return `https://image.thum.io/get/width/1200/noanimate/${target}`;
}

function imageResponse(data: Buffer, type: string, maxAge: number) {
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Cache-Control": `public, max-age=${maxAge}`,
    },
  });
}

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

  const key =
    createHash("sha256").update(target.toString()).digest("hex").slice(0, 32) +
    ".jpg";
  const file = path.join(SHOTS_DIR, key);

  // Serve a fresh cached snapshot.
  try {
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs < TTL_MS) {
      return imageResponse(await fs.readFile(file), "image/jpeg", 86400);
    }
  } catch {
    /* not cached yet */
  }

  // Render a new snapshot.
  try {
    const upstream = await fetch(providerUrl(target.toString()), {
      signal: AbortSignal.timeout(20000),
    });
    const type = upstream.headers.get("content-type") ?? "";
    if (upstream.ok && type.startsWith("image/")) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.byteLength > 0 && buf.byteLength <= MAX_BYTES) {
        await fs.mkdir(SHOTS_DIR, { recursive: true });
        await fs.writeFile(file, buf);
        return imageResponse(buf, type, 86400);
      }
    }
  } catch {
    /* provider failed — fall through to stale cache / error */
  }

  // Provider failed: serve a stale snapshot if we have one.
  try {
    return imageResponse(await fs.readFile(file), "image/jpeg", 3600);
  } catch {
    return NextResponse.json({ error: "No snapshot." }, { status: 502 });
  }
}
