// Minimal Fish Audio TTS client. Store owners bring their own key (BYO), so
// unlike OpenRouter there's no environment fallback — the key is always passed
// in. Returns raw audio bytes the caller streams back to the browser to play.
//
// Docs: https://docs.fish.audio — POST https://api.fish.audio/v1/tts with a
// Bearer key, a `model` header selecting the TTS backbone, and a JSON body
// carrying the text, an optional `reference_id` (the voice), and the format.

const FISH_URL = "https://api.fish.audio/v1/tts";
// Fish Audio's S2.1 Pro, offered free to developers — passed via the `model`
// header. https://fish.audio/blog/s2-1-pro-free-api/
const DEFAULT_MODEL = "s2.1-pro-free";
export const FISH_TEXT_LIMIT = 1500;

export type FishFailure =
  | "not_configured"
  | "bad_key"
  | "no_credits"
  | "rate_limited"
  | "upstream"
  | "network"
  | "empty";

export type FishResult =
  | { ok: true; audio: ArrayBuffer; contentType: string }
  | { ok: false; reason: FishFailure; message: string };

export async function fishTts(
  apiKey: string,
  text: string,
  opts: { voiceId?: string; model?: string } = {},
): Promise<FishResult> {
  const key = apiKey.trim().replace(/^["']|["']$/g, "").trim();
  if (!key) {
    return { ok: false, reason: "not_configured", message: "No Fish Audio key set." };
  }
  const body = text.trim().slice(0, FISH_TEXT_LIMIT);
  if (!body) {
    return { ok: false, reason: "empty", message: "Nothing to say." };
  }

  let response: Response;
  try {
    response = await fetch(FISH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        model: opts.model?.trim() || DEFAULT_MODEL,
      },
      body: JSON.stringify({
        text: body,
        reference_id: opts.voiceId?.trim() || null,
        format: "mp3",
        normalize: true,
        latency: "normal",
      }),
    });
  } catch {
    return { ok: false, reason: "network", message: "Could not reach Fish Audio." };
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).toLowerCase();
    return { ok: false, ...diagnose(response.status, detail) };
  }

  const audio = await response.arrayBuffer();
  if (!audio.byteLength) {
    return { ok: false, reason: "empty", message: "Fish Audio returned no audio." };
  }
  const contentType = response.headers.get("content-type") || "audio/mpeg";
  return { ok: true, audio, contentType };
}

function diagnose(
  status: number,
  detail: string,
): { reason: FishFailure; message: string } {
  if (status === 401 || status === 403) {
    return { reason: "bad_key", message: "The Fish Audio key was rejected." };
  }
  if (status === 402 || detail.includes("credit") || detail.includes("balance")) {
    return { reason: "no_credits", message: "The Fish Audio account is out of credits." };
  }
  if (status === 429) {
    return { reason: "rate_limited", message: "Fish Audio is rate limited right now." };
  }
  return { reason: "upstream", message: "Fish Audio returned an error." };
}
