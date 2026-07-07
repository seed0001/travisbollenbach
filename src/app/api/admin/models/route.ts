import { NextRequest, NextResponse } from "next/server";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import { getOpenRouter } from "@/lib/settings";

// Admin-only: list the models available on OpenRouter so the operator can
// pick one from a dropdown instead of typing ids by hand. Uses the stored
// key when present (unlocks any account-gated models); results are cached
// per instance for a few minutes.

const MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 5 * 60 * 1000;

export type ModelOption = { id: string; name: string };

let cache: { at: number; models: ModelOption[] } | null = null;

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const user = await getUserBySession(token);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  if (!refresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return NextResponse.json({ models: cache.models, cached: true });
  }

  const { apiKey } = await getOpenRouter();

  try {
    const response = await fetch(MODELS_URL, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `OpenRouter answered ${response.status}.` },
        { status: 502 },
      );
    }
    const data = await response.json().catch(() => null);
    const list: unknown[] = Array.isArray(data?.data) ? data.data : [];
    const models: ModelOption[] = list
      .flatMap((entry): ModelOption[] => {
        if (!entry || typeof entry !== "object") return [];
        const id = (entry as { id?: unknown }).id;
        if (typeof id !== "string") return [];
        const rawName = (entry as { name?: unknown }).name;
        return [{ id, name: typeof rawName === "string" ? rawName : id }];
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    if (models.length === 0) {
      return NextResponse.json(
        { error: "OpenRouter returned no models." },
        { status: 502 },
      );
    }
    cache = { at: Date.now(), models };
    return NextResponse.json({ models, cached: false });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach OpenRouter." },
      { status: 502 },
    );
  }
}
