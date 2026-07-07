import { promises as fs } from "fs";
import path from "path";

// Diagnostics for the data volume. Accounts, sessions, comments, and settings
// all live in one directory: DATA_DIR, else COMMENTS_DIR, else ./data — the
// fallback is inside the container and is WIPED on every deploy, so the admin
// console surfaces which one is actually in use.

export type StorageInfo = {
  dir: string;
  source: "DATA_DIR" | "COMMENTS_DIR" | "fallback";
  writable: boolean;
  users: number;
  comments: number;
  settingsPresent: boolean;
};

async function countJsonArray(file: string): Promise<number> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const fromDataDir = process.env.DATA_DIR;
  const fromCommentsDir = process.env.COMMENTS_DIR;
  const dir =
    fromDataDir ?? fromCommentsDir ?? path.join(process.cwd(), "data");
  const source = fromDataDir
    ? "DATA_DIR"
    : fromCommentsDir
      ? "COMMENTS_DIR"
      : "fallback";

  let writable = false;
  try {
    await fs.mkdir(dir, { recursive: true });
    const probe = path.join(dir, ".write-probe");
    await fs.writeFile(probe, String(Date.now()), "utf8");
    await fs.unlink(probe);
    writable = true;
  } catch {
    writable = false;
  }

  const [users, comments, settingsPresent] = await Promise.all([
    countJsonArray(path.join(dir, "users.json")),
    countJsonArray(path.join(dir, "comments.json")),
    fs.access(path.join(dir, "settings.json")).then(
      () => true,
      () => false,
    ),
  ]);

  return { dir, source, writable, users, comments, settingsPresent };
}
