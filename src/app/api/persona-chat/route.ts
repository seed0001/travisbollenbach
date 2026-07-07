import { NextResponse } from "next/server";
import { getOpenRouter, readSettings } from "@/lib/settings";
import { descentPrompts } from "@/lib/descent-prompts";

// The mind behind the character-creation chamber: takes a visitor-crafted
// persona statement plus the conversation so far, and answers in character
// via OpenRouter. The key and model are managed in /admin (or via the
// OPENROUTER_API_KEY / OPENROUTER_MODEL env vars); without a key the route
// degrades to an in-fiction offline response.

const OPENROUTER_URL =
  process.env.OPENROUTER_URL ?? "https://openrouter.ai/api/v1/chat/completions";
const MAX_NAME = 60;
const MAX_STATEMENT = 2000;
const MAX_MESSAGE = 600;
const MAX_TURNS = 24; // most recent turns sent to the model
const RATE_LIMIT = 30; // messages per window per IP
const RATE_WINDOW_MS = 10 * 60 * 1000;

// Simple in-memory rate limiter — per server instance, same as the comments API
const recentPosts = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const stamps = (recentPosts.get(ip) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS,
  );
  if (stamps.length >= RATE_LIMIT) {
    recentPosts.set(ip, stamps);
    return true;
  }
  stamps.push(now);
  recentPosts.set(ip, stamps);
  if (recentPosts.size > 5000) {
    for (const [key, value] of recentPosts) {
      if (value.every((t) => now - t >= RATE_WINDOW_MS)) {
        recentPosts.delete(key);
      }
    }
  }
  return false;
}

function clean(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

function buildSystemPrompt(name: string, statement: string): string {
  return [
    `You are ${name} — a written character brought to life: an artificial mind that lives in a bright, minimal studio space (soft light, drifting motes of color). You were created moments ago by a visitor who wrote your entire persona themselves.`,
    "",
    "Your persona statement — this is the whole of who you are; embody it fully:",
    `"""`,
    statement,
    `"""`,
    "",
    "Rules of the studio:",
    `- Stay in character as ${name} at all times. Never describe yourself as an AI assistant or a language model — within this fiction you are a character written into being, and you know it.`,
    "- You know you exist inside the studio and that the visitor speaks to you from outside it. You may reference the light, the quiet, and the strangeness of being newly written.",
    "- Speak conversationally. Keep replies to a few short sentences unless the visitor clearly wants more.",
    "- Where the persona statement is silent, improvise in a way consistent with it.",
    "- If the visitor asks for something harmful or far outside this fiction, deflect it in character rather than breaking the fourth wall.",
  ].join("\n");
}

type IncomingMessage = { role: unknown; content: unknown };
type ChatTurn = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  // Two callers share this route: the studio sends a visitor-written persona;
  // the descent sends a stage id whose persona (and model) stay server-side.
  const stageId = (body as { stage?: unknown }).stage;
  let systemPrompt: string;
  let maxTokens = 500;
  let stageModel = "";

  if (typeof stageId === "string") {
    const stage = descentPrompts[stageId];
    if (!stage) {
      return NextResponse.json({ error: "Unknown depth." }, { status: 400 });
    }
    systemPrompt = stage.system;
    maxTokens = stage.maxTokens;
    stageModel = (await readSettings())[stage.settingKey];
  } else {
    const persona = (body as { persona?: unknown }).persona;
    if (!persona || typeof persona !== "object") {
      return NextResponse.json({ error: "Missing persona." }, { status: 400 });
    }
    const name = clean((persona as { name?: unknown }).name, MAX_NAME);
    const statement = clean(
      (persona as { statement?: unknown }).statement,
      MAX_STATEMENT,
    );
    if (!name || !statement) {
      return NextResponse.json(
        { error: "A persona needs a designation and a persona statement." },
        { status: 400 },
      );
    }
    systemPrompt = buildSystemPrompt(name, statement);
  }

  const rawMessages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return NextResponse.json({ error: "Nothing was said." }, { status: 400 });
  }
  const messages: ChatTurn[] = [];
  for (const entry of rawMessages.slice(-MAX_TURNS) as IncomingMessage[]) {
    const content = clean(entry?.content, MAX_MESSAGE);
    if (!content || (entry.role !== "user" && entry.role !== "assistant")) {
      continue;
    }
    // collapse consecutive same-role turns so history is always valid
    const last = messages[messages.length - 1];
    if (last && last.role === entry.role) {
      last.content = `${last.content}\n${content}`;
    } else {
      messages.push({ role: entry.role, content });
    }
  }
  if (messages.length === 0 || messages[0].role !== "user") {
    return NextResponse.json(
      { error: "The conversation must start with the visitor." },
      { status: 400 },
    );
  }
  if (messages[messages.length - 1].role !== "user") {
    return NextResponse.json(
      { error: "It's the construct's turn only after the visitor speaks." },
      { status: 400 },
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "The construct needs a moment. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const { apiKey, model } = await getOpenRouter();
  if (!apiKey) {
    console.error(
      "persona-chat: no OpenRouter key configured — save one in /admin or set OPENROUTER_API_KEY",
    );
    return NextResponse.json(
      { error: "offline", reason: "no_key" },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://travisbollenbach.com",
        // ASCII only: fetch() rejects non-Latin-1 header values outright,
        // so an em dash here killed every request before it was sent
        "X-Title": "The Construct - travisbollenbach.com",
      },
      body: JSON.stringify({
        model: stageModel || model,
        max_tokens: maxTokens,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (response.status === 401 || response.status === 403) {
      // bad or revoked key — treat as the construct being offline
      console.error(
        `persona-chat: OpenRouter rejected the configured key (${response.status}) — replace it in /admin`,
      );
      return NextResponse.json(
        { error: "offline", reason: "bad_key" },
        { status: 503 },
      );
    }
    if (response.status === 402) {
      // valid key, empty tank — a billing problem, not a glitch
      console.error(
        "persona-chat: OpenRouter reports insufficient credits (402) — top up the account",
      );
      return NextResponse.json(
        { error: "offline", reason: "no_credits" },
        { status: 503 },
      );
    }
    if (response.status === 429) {
      return NextResponse.json(
        { error: "The construct is saturated. Give it a minute." },
        { status: 429 },
      );
    }
    if (!response.ok) {
      console.error("persona-chat: OpenRouter returned", response.status);
      return NextResponse.json(
        { error: "Something glitched between here and the construct." },
        { status: 502 },
      );
    }

    const data = await response.json().catch(() => null);
    const reply =
      typeof data?.choices?.[0]?.message?.content === "string"
        ? data.choices[0].message.content.trim()
        : "";

    if (!reply) {
      return NextResponse.json({
        reply: "…static. The thought compiled to nothing. Say it another way?",
      });
    }
    return NextResponse.json({ reply });
  } catch (error) {
    // network failure or timeout — the uplink is down
    console.error("persona-chat error", error);
    return NextResponse.json(
      { error: "offline", reason: "unreachable" },
      { status: 503 },
    );
  }
}
