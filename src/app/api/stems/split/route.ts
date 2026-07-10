import { NextResponse } from "next/server";
import { initStemCache, splitUploadedSong } from "@/lib/server/stemSplit";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  await initStemCache();

  try {
    const body = Buffer.from(await request.arrayBuffer());
    const filename =
      request.headers.get("x-filename")?.trim() ||
      request.headers.get("X-Filename")?.trim() ||
      "song.mp3";

    const result = await splitUploadedSong(body, filename);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[luna-stems]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stem split failed" },
      { status: 500 },
    );
  }
}
