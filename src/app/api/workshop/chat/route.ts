import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, type ChatMessage } from "@/lib/openrouter";
import {
  buildSystemPrompt,
  PERSONA_LIMITS,
  type PersonaDraft,
  type PersonaMode,
} from "@/lib/persona";

export const dynamic = "force-dynamic";

// Every message spends the operator's OpenRouter credits, so cap usage per IP.
const RATE_LIMIT = 30; // messages per window per IP
const RATE_WINDOW_MS = 60 * 60 * 1000;

const recent = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const stamps = (recent.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (stamps.length >= RATE_LIMIT) {
    recent.set(ip, stamps);
    return true;
  }
  stamps.push(now);
  recent.set(ip, stamps);
  return false;
}

function asMode(value: unknown): PersonaMode {
  return value === "tool" ? "tool" : "character";
}

function asMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const cleaned: ChatMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string")
      continue;
    const text = content.trim().slice(0, PERSONA_LIMITS.message);
    if (text) cleaned.push({ role, content: text });
  }
  // Keep only the most recent turns so the prompt can't grow without bound.
  return cleaned.slice(-PERSONA_LIMITS.history);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const persona: PersonaDraft = {
    mode: asMode((body as { mode?: unknown }).mode),
    name:
      typeof (body as { name?: unknown }).name === "string"
        ? (body as { name: string }).name.slice(0, PERSONA_LIMITS.name)
        : "",
    statement:
      typeof (body as { statement?: unknown }).statement === "string"
        ? (body as { statement: string }).statement.slice(
            0,
            PERSONA_LIMITS.statement,
          )
        : "",
  };

  if (!persona.statement.trim()) {
    return NextResponse.json(
      { error: "Write a persona statement first." },
      { status: 400 },
    );
  }

  const history = asMessages((body as { messages?: unknown }).messages);
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Say something to your persona first." },
      { status: 400 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "You've hit the hourly limit for the workshop. Try again later." },
      { status: 429 },
    );
  }

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(persona) },
    ...history,
  ];

  const result = await chatCompletion(messages, {
    // Characters run warmer; tools run cooler and more deterministic.
    temperature: persona.mode === "character" ? 0.9 : 0.4,
    maxTokens: 700,
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
