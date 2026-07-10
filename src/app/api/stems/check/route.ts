import { NextResponse } from "next/server";
import { checkStemSplitterReady } from "@/lib/server/stemSplit";

export async function GET() {
  const result = await checkStemSplitterReady();
  return NextResponse.json(result);
}
