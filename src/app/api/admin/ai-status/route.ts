import { NextRequest, NextResponse } from "next/server";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import { readSettings } from "@/lib/settings";

// Admin-only: live health check of the AI link. Unlike the model catalog
// (a public OpenRouter endpoint that succeeds with no key at all), this
// calls an auth-required endpoint with the exact key the chat routes will
// use, so it proves — or pinpoints — the studio's uplink end to end.

const KEY_URL = "https://openrouter.ai/api/v1/key";

export type AiLinkStatus = {
  status: "ok" | "no_key" | "invalid_key" | "unreachable";
  keySource: "admin" | "env" | "none";
  model: string;
  keyPreview: string;
  detail: string;
};

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const user = await getUserBySession(token);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const settings = await readSettings();
  const envKey = process.env.OPENROUTER_API_KEY ?? "";
  const apiKey = settings.openrouterApiKey || envKey;
  const keySource = settings.openrouterApiKey
    ? "admin"
    : envKey
      ? "env"
      : "none";
  const model =
    settings.openrouterModel ||
    process.env.OPENROUTER_MODEL ||
    "openrouter/auto";

  const base: Omit<AiLinkStatus, "status" | "detail"> = {
    keySource,
    model,
    keyPreview: apiKey ? `…${apiKey.slice(-4)}` : "",
  };

  if (!apiKey) {
    return NextResponse.json({
      ...base,
      status: "no_key",
      detail:
        "No API key found — neither saved here nor in the OPENROUTER_API_KEY environment variable. The chat is offline until one is saved.",
    } satisfies AiLinkStatus);
  }

  try {
    const response = await fetch(KEY_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({
        ...base,
        status: "invalid_key",
        detail: `OpenRouter rejected the ${keySource === "env" ? "environment" : "saved"} key (${base.keyPreview}) with a ${response.status}. It's wrong, expired, or revoked — paste a fresh key and save.`,
      } satisfies AiLinkStatus);
    }
    if (!response.ok) {
      return NextResponse.json({
        ...base,
        status: "unreachable",
        detail: `OpenRouter answered ${response.status} to the key check. The chat may be degraded — try again shortly.`,
      } satisfies AiLinkStatus);
    }
    return NextResponse.json({
      ...base,
      status: "ok",
      detail: `Key accepted by OpenRouter. The chat is live via ${model}.`,
    } satisfies AiLinkStatus);
  } catch {
    return NextResponse.json({
      ...base,
      status: "unreachable",
      detail:
        "Couldn't reach OpenRouter from the server (network error or timeout). The chat is offline until the connection recovers.",
    } satisfies AiLinkStatus);
  }
}
