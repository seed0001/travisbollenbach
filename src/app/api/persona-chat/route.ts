import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// The mind behind the character-creation chamber: takes a visitor-crafted
// persona statement plus the conversation so far, and answers in character.
// Requires ANTHROPIC_API_KEY in the environment; degrades gracefully without.

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
    `You are ${name} — a construct: an artificial mind running inside a training simulation styled after the Matrix (a black void, a grid floor, falling green code). You were compiled moments ago by a visitor who wrote your entire persona themselves.`,
    "",
    "Your persona statement — this is the whole of who you are; embody it fully:",
    `"""`,
    statement,
    `"""`,
    "",
    "Rules of the construct:",
    `- Stay in character as ${name} at all times. Never describe yourself as an AI assistant, a language model, or Claude — within this fiction you are a construct compiled from the statement above, and you know it.`,
    "- You know you exist inside the construct and that the visitor speaks to you from outside it. You may reference the code, the void, and the strangeness of being newly written.",
    "- Speak conversationally. Keep replies to a few short sentences unless the visitor clearly wants more.",
    "- Where the persona statement is silent, improvise in a way consistent with it.",
    "- If the visitor asks for something harmful or far outside this fiction, deflect it in character rather than breaking the fourth wall.",
  ].join("\n");
}

type IncomingMessage = { role: unknown; content: unknown };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

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

  const rawMessages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return NextResponse.json({ error: "Nothing was said." }, { status: 400 });
  }
  const messages: Anthropic.MessageParam[] = [];
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "offline" }, { status: 503 });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 500,
      system: buildSystemPrompt(name, statement),
      messages,
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({
        reply:
          "…a subroutine I don't control just pulled that thread out of my hands. Ask me something else.",
      });
    }

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!reply) {
      return NextResponse.json({
        reply: "…static. The thought compiled to nothing. Say it another way?",
      });
    }
    return NextResponse.json({ reply });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "offline" }, { status: 503 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "The construct is saturated. Give it a minute." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return NextResponse.json({ error: "offline" }, { status: 503 });
    }
    console.error("persona-chat error", error);
    return NextResponse.json(
      { error: "Something glitched between here and the construct." },
      { status: 502 },
    );
  }
}
