import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getCachedStemPath } from "@/lib/server/stemSplit";

type RouteParams = {
  params: Promise<{ jobId: string; stem: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { jobId, stem } = await params;
  const kind = stem === "vocals.wav" ? "vocals" : stem === "instrumental.wav" ? "instrumental" : null;

  if (!kind) {
    return NextResponse.json({ error: "Invalid stem type" }, { status: 400 });
  }

  const filePath = getCachedStemPath(jobId, kind);
  if (!filePath) {
    return NextResponse.json({ error: "Stem cache expired or not found" }, { status: 404 });
  }

  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: "Stem file missing" }, { status: 404 });
  }

  const nodeStream = createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "audio/wav",
    },
  });
}
