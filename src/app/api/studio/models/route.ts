import { NextRequest, NextResponse } from "next/server";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import { listOpenRouterModels } from "@/lib/openrouter";

export const dynamic = "force-dynamic";

// The OpenRouter model catalog, for the back-office model picker. Owner-only so
// it isn't an open proxy; the list itself is public data.
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const user = await getUserBySession(token);
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const result = await listOpenRouterModels();
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 502 });
  }
  return NextResponse.json({ models: result.models });
}
