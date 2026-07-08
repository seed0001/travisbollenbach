import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import { VRM_DIR } from "@/lib/studios";

export const dynamic = "force-dynamic";

// VRM avatars are glTF binaries and run big; allow more room than wall images.
const MAX_BYTES = 40 * 1024 * 1024; // 40 MB

// Content types browsers/three actually use for .vrm / .glb payloads.
const SERVE_TYPE = "model/gltf-binary";

// POST: a signed-in member uploads a .vrm (or .glb) avatar. Ownership of the
// unit is enforced when the returned path is saved onto the studio.
export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const user = await getUserBySession(token);
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const lower = file.name.toLowerCase();
  const ext = lower.endsWith(".vrm") ? "vrm" : lower.endsWith(".glb") ? "glb" : "";
  if (!ext) {
    return NextResponse.json(
      { error: "Upload a .vrm (or .glb) avatar file." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Avatar must be under 40 MB." },
      { status: 413 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const name = `${randomUUID()}.${ext}`;
  await fs.mkdir(VRM_DIR, { recursive: true });
  await fs.writeFile(path.join(VRM_DIR, name), bytes);

  return NextResponse.json({ url: `/api/studio/vrm?f=${name}` });
}

// GET: serve an uploaded avatar from the data volume. The filename is locked to
// the uuid.ext shape so it can't escape the directory.
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("f") ?? "";
  if (!/^[a-f0-9-]{36}\.(vrm|glb)$/i.test(name)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const data = await fs.readFile(path.join(VRM_DIR, name));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": SERVE_TYPE,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
