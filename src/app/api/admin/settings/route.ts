import { NextRequest, NextResponse } from "next/server";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import {
  SETTING_KEYS,
  normalize,
  readSettings,
  updateSettings,
  type SiteSettings,
} from "@/lib/settings";

const OPENROUTER_KEY_URL =
  process.env.OPENROUTER_KEY_URL ?? "https://openrouter.ai/api/v1/key";

// Operator-only management of integration credentials (OpenRouter, Discord).
// Secrets are write-only through this API: reads return set/unset status and
// a last-4 preview, never the full value.

const SECRET_KEYS: (keyof SiteSettings)[] = [
  "openrouterApiKey",
  "fishAudioApiKey",
  "discordBotToken",
  "discordClientSecret",
];

type FieldView =
  | { secret: true; set: boolean; preview: string }
  | { secret: false; value: string };

function toView(settings: SiteSettings): Record<string, FieldView> {
  const view: Record<string, FieldView> = {};
  for (const key of SETTING_KEYS) {
    const value = settings[key];
    if (SECRET_KEYS.includes(key)) {
      view[key] = {
        secret: true,
        set: value.length > 0,
        preview: value.length > 0 ? `…${value.slice(-4)}` : "",
      };
    } else {
      view[key] = { secret: false, value };
    }
  }
  return view;
}

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  const user = await getUserBySession(token);
  return user && user.role === "admin" ? user : null;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }
  return NextResponse.json({ fields: toView(await readSettings()) });
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const patch: Partial<SiteSettings> = {};
  for (const key of SETTING_KEYS) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string") {
      patch[key] = value; // empty string clears the value
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  // A bad OpenRouter key silently overrides a good env key and takes the
  // whole AI offline (a browser once autofilled this field with a password).
  // So: verify against OpenRouter BEFORE persisting; a rejected key is never
  // saved. If OpenRouter itself is unreachable we save on good faith.
  const candidateKey = normalize(patch.openrouterApiKey);
  if (candidateKey) {
    try {
      const check = await fetch(OPENROUTER_KEY_URL, {
        headers: { Authorization: `Bearer ${candidateKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (check.status === 401 || check.status === 403) {
        return NextResponse.json(
          {
            error:
              "OpenRouter rejected that API key, so it was NOT saved — your working key is untouched. Check for a truncated paste or a browser autofill in the key field.",
          },
          { status: 400 },
        );
      }
    } catch {
      // network trouble — don't block the save on it
    }
  }

  const next = await updateSettings(patch);
  return NextResponse.json({ fields: toView(next) });
}
