// Minimal OpenRouter client. The key and default model come from the
// environment for now (set OPENROUTER_API_KEY, optionally OPENROUTER_MODEL in
// Railway). When the operator dashboard lands it can supply the model per
// feature via the `model` option without touching callers.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

// A safe, widely-available default. Override per-environment with
// OPENROUTER_MODEL, or per-call once the dashboard can pass one in.
const FALLBACK_MODEL = "openai/gpt-4o-mini";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatResult =
  | { ok: true; content: string; model: string }
  | { ok: false; reason: ChatFailure; message: string };

// Reason codes so the UI can say something specific instead of "error".
export type ChatFailure =
  | "not_configured"
  | "no_credits"
  | "bad_key"
  | "rate_limited"
  | "upstream"
  | "network"
  | "empty";

// Keys pasted through a dashboard or env often arrive with stray whitespace or
// wrapping quotes; normalize before use.
function readKey(): string | null {
  const raw = process.env.OPENROUTER_API_KEY;
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^["']|["']$/g, "").trim();
  return cleaned || null;
}

export function defaultModel(): string {
  const raw = process.env.OPENROUTER_MODEL?.trim();
  return raw && raw.length > 0 ? raw : FALLBACK_MODEL;
}

export function openRouterConfigured(): boolean {
  return readKey() !== null;
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    // A per-call key (e.g. a store owner's BYO key). Falls back to the env key.
    apiKey?: string;
  } = {},
): Promise<ChatResult> {
  const key = opts.apiKey?.trim() || readKey();
  if (!key) {
    return {
      ok: false,
      reason: "not_configured",
      message: "The AI backend isn't connected yet.",
    };
  }

  const model = opts.model ?? defaultModel();

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // These must stay ASCII-only — a stray em dash in X-Title once killed
        // every call. Keep it plain.
        "HTTP-Referer":
          process.env.SITE_URL?.trim() || "https://travisbollenbach.com",
        "X-Title": "Character Workshop",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.8,
        max_tokens: opts.maxTokens ?? 700,
      }),
    });
  } catch {
    return {
      ok: false,
      reason: "network",
      message: "Could not reach the AI backend.",
    };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { ok: false, ...diagnose(response.status, detail) };
  }

  const data = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return {
      ok: false,
      reason: "empty",
      message: "The model returned nothing. Try again.",
    };
  }

  return { ok: true, content, model };
}

function diagnose(
  status: number,
  detail: string,
): { reason: ChatFailure; message: string } {
  const text = detail.toLowerCase();
  if (status === 401 || status === 403) {
    return {
      reason: "bad_key",
      message: "The OpenRouter key was rejected. Check the key in the operator settings.",
    };
  }
  if (status === 402 || text.includes("credit") || text.includes("quota")) {
    return {
      reason: "no_credits",
      message: "The OpenRouter account is out of credits.",
    };
  }
  if (status === 429) {
    return {
      reason: "rate_limited",
      message: "The AI backend is rate limited right now. Give it a moment.",
    };
  }
  return {
    reason: "upstream",
    message: "The AI backend returned an error. Try again shortly.",
  };
}

// --- Model catalog ----------------------------------------------------------
// OpenRouter's model list is a public endpoint (no key needed), so store owners
// can browse it to pick a model. Cache it briefly to avoid hammering.

export type OpenRouterModel = { id: string; name: string };
export type ModelsResult =
  | { ok: true; models: OpenRouterModel[] }
  | { ok: false; message: string };

const MODELS_TTL_MS = 10 * 60 * 1000;
let modelsCache: { at: number; models: OpenRouterModel[] } | null = null;

export async function listOpenRouterModels(): Promise<ModelsResult> {
  if (modelsCache && Date.now() - modelsCache.at < MODELS_TTL_MS) {
    return { ok: true, models: modelsCache.models };
  }
  let response: Response;
  try {
    response = await fetch(OPENROUTER_MODELS_URL, {
      headers: { Accept: "application/json" },
    });
  } catch {
    return { ok: false, message: "Could not reach OpenRouter." };
  }
  if (!response.ok) {
    return { ok: false, message: "OpenRouter's model list is unavailable." };
  }
  const data = (await response.json().catch(() => null)) as {
    data?: { id?: unknown; name?: unknown }[];
  } | null;
  const models = (data?.data ?? [])
    .filter((m) => typeof m?.id === "string")
    .map((m) => ({
      id: m.id as string,
      name: typeof m.name === "string" && m.name ? m.name : (m.id as string),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  modelsCache = { at: Date.now(), models };
  return { ok: true, models };
}
