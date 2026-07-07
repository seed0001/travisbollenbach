import { promises as fs } from "fs";
import path from "path";

// Operator-managed site settings (API keys, integration tokens), stored in the
// same data volume as accounts and comments. Values set here take precedence
// over environment variables so everything is manageable from /admin.

const DATA_DIR =
  process.env.DATA_DIR ??
  process.env.COMMENTS_DIR ??
  path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export type SiteSettings = {
  openrouterApiKey: string;
  openrouterModel: string;
  // The Descent — per-depth model overrides; blank falls back to openrouterModel
  descentModel1: string;
  descentModel2: string;
  descentModel3: string;
  discordBotToken: string;
  discordClientId: string;
  discordClientSecret: string;
};

export const SETTINGS_DEFAULTS: SiteSettings = {
  openrouterApiKey: "",
  openrouterModel: "openrouter/auto",
  descentModel1: "",
  descentModel2: "",
  descentModel3: "",
  discordBotToken: "",
  discordClientId: "",
  discordClientSecret: "",
};

export const SETTING_KEYS = Object.keys(
  SETTINGS_DEFAULTS,
) as (keyof SiteSettings)[];

// Serialize read-modify-write cycles within this instance, same as auth.ts
let writeLock: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = writeLock.then(task, task);
  writeLock = run.catch(() => undefined);
  return run;
}

export async function readSettings(): Promise<SiteSettings> {
  try {
    const parsed = JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8"));
    return { ...SETTINGS_DEFAULTS, ...parsed };
  } catch {
    return { ...SETTINGS_DEFAULTS };
  }
}

export async function updateSettings(
  patch: Partial<SiteSettings>,
): Promise<SiteSettings> {
  return withLock(async () => {
    const current = await readSettings();
    const next = { ...current };
    for (const key of SETTING_KEYS) {
      const value = patch[key];
      if (typeof value === "string") {
        next[key] = value.trim().slice(0, 500);
      }
    }
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
}

/** Strip whitespace and stray wrapping quotes that sneak in when a value is
 * pasted into a dashboard — a key sent with either is silently rejected. */
export function normalize(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
}

/** OpenRouter credentials: admin-set value first, env var as fallback. */
export async function getOpenRouter(): Promise<{
  apiKey: string;
  model: string;
}> {
  const settings = await readSettings();
  return {
    apiKey:
      normalize(settings.openrouterApiKey) ||
      normalize(process.env.OPENROUTER_API_KEY),
    model:
      normalize(settings.openrouterModel) ||
      normalize(process.env.OPENROUTER_MODEL) ||
      SETTINGS_DEFAULTS.openrouterModel,
  };
}
