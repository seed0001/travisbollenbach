import { NextResponse } from "next/server";
import { getPublicStudios } from "@/lib/studios";

export const dynamic = "force-dynamic";

// Read-only studio content for the Construct to render on the walls. No owner
// identity is included.
export async function GET() {
  return NextResponse.json(
    { studios: await getPublicStudios() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
