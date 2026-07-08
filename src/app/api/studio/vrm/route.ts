import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import { VRM_DIR } from "@/lib/studios";

export const dynamic = "force-dynamic";

// Avatar models run big (FBX with baked textures especially); give them room.
const MAX_BYTES = 60 * 1024 * 1024; // 60 MB

// Accepted avatar formats and the content type we serve each one back as.
const AVATAR_TYPES: Record<string, string> = {
  vrm: "model/gltf-binary",
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  fbx: "application/octet-stream",
};

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

  const ext = file.name.toLowerCase().match(/\.(vrm|glb|gltf|fbx)$/)?.[1] ?? "";
  if (!ext) {
    return NextResponse.json(
      { error: "Upload a .vrm, .glb, .gltf, or .fbx avatar file." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Avatar must be under 60 MB." },
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
  const match = name.match(/^[a-f0-9-]{36}\.(vrm|glb|gltf|fbx)$/i);
  if (!match) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const data = await fs.readFile(path.join(VRM_DIR, name));
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type":
          AVATAR_TYPES[match[1].toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
