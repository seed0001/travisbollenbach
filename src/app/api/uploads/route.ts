import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { UPLOADS_DIR } from "@/lib/studios";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

// Serve an uploaded studio image from the data volume. The filename is
// restricted to the uuid.ext shape so it can't escape the uploads directory.
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("f") ?? "";
  if (!/^[a-f0-9-]{36}\.(png|jpg|jpeg|webp|gif)$/i.test(name)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const ext = name.split(".").pop()!.toLowerCase();
  try {
    const data = await fs.readFile(path.join(UPLOADS_DIR, name));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
