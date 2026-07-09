import { NextRequest, NextResponse } from "next/server";
import { getStudio } from "@/lib/studios";
import { chatCompletion, type ChatMessage } from "@/lib/openrouter";
import { ASSISTANT_LIMITS, buildAssistantPrompt } from "@/lib/assistant";
import { clientIp, rateLimited } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Chat spends the store owner's OpenRouter credits, so cap it per visitor IP.
const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function asMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const cleaned: ChatMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string")
      continue;
    const text = content.trim().slice(0, ASSISTANT_LIMITS.message);
    if (text) cleaned.push({ role, content: text });
  }
  return cleaned.slice(-ASSISTANT_LIMITS.history);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const unit = (body as { unit?: unknown })?.unit;
  if (typeof unit !== "string") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const studio = await getStudio(unit);
  if (!studio) {
    return NextResponse.json({ error: "Unknown unit." }, { status: 404 });
  }
  if (!studio.aiEnabled || !studio.openRouterKey.trim()) {
    return NextResponse.json(
      { error: "This shop's host isn't available.", reason: "not_configured" },
      { status: 503 },
    );
  }

  const history = asMessages((body as { messages?: unknown }).messages);
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Say something first." },
      { status: 400 },
    );
  }

  if (rateLimited("assistant", clientIp(request), RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json(
      { error: "You've hit the hourly limit for this host. Try again later." },
      { status: 429 },
    );
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildAssistantPrompt(
        studio.studioName,
        studio.aiName,
        studio.aiPersona,
      ),
    },
    ...history,
  ];

  const result = await chatCompletion(messages, {
    apiKey: studio.openRouterKey,
    model: studio.openRouterModel.trim() || undefined,
    temperature: 0.7,
    maxTokens: 400,
  });

  if (!result.ok) {
    const status = result.reason === "not_configured" ? 503 : 502;
    return NextResponse.json(
      { error: result.message, reason: result.reason },
      { status },
    );
  }

  return NextResponse.json({ reply: result.content });
}
