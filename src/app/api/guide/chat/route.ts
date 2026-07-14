import { NextRequest, NextResponse } from "next/server";
import { chatCompletion, type ChatMessage } from "@/lib/openrouter";
import { buildGuideSystemPrompt, GUIDE_LIMITS } from "@/lib/siteGuide";

// The dog: the site's guide. POST { messages } (the recent user/assistant turns)
// and get back the dog's reply. Uses OpenRouter (OPENROUTER_API_KEY). Point just
// the dog at a specific model with GUIDE_MODEL (e.g. an OpenRouter slug like
// "anthropic/claude-fable-5" or "openai/gpt-5.6"); otherwise it uses
// OPENROUTER_MODEL / the site default.

export const dynamic = "force-dynamic";

const RATE_LIMIT = 40; // messages per window per IP
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

function asMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  const cleaned: ChatMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string")
      continue;
    const text = content.trim().slice(0, GUIDE_LIMITS.message);
    if (text) cleaned.push({ role, content: text });
  }
  return cleaned.slice(-GUIDE_LIMITS.history);
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "You're chatting fast — give the dog a moment." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const history = asMessages((body as { messages?: unknown } | null)?.messages);
  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "Say something to the dog first." },
      { status: 400 },
    );
  }

  const messages: ChatMessage[] = [
    { role: "system", content: buildGuideSystemPrompt() },
    ...history,
  ];

  const result = await chatCompletion(messages, {
    model: process.env.GUIDE_MODEL?.trim() || undefined,
    temperature: 0.7,
    maxTokens: 400,
  });

  if (!result.ok) {
    // Surface a friendly line; 200 so the UI can show it in the chat bubble.
    return NextResponse.json({ reply: dogFallback(result.reason), degraded: true });
  }
  return NextResponse.json({ reply: result.content });
}

// When the backend isn't set up or is failing, the dog still says something.
function dogFallback(reason: string): string {
  if (reason === "not_configured") {
    return "Woof — my brain isn't hooked up yet. Travis still needs to connect me. Try me again soon!";
  }
  if (reason === "no_credits") {
    return "I'm all out of treats to think with right now. Check back later!";
  }
  return "Hmm, I lost my train of thought there. Ask me again in a sec?";
}
