import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const PROJECT_ROOT = process.cwd();
const CACHE_ROOT = join(PROJECT_ROOT, ".cache", "luna-stems");
const PYTHON_SCRIPT = join(PROJECT_ROOT, "server", "split_stems.py");
const MAX_UPLOAD_BYTES = 80 * 1024 * 1024;
const JOB_ID_RE = /^[0-9a-f-]{36}$/i;

type SplitJob = {
  vocalsPath: string;
  instrumentalPath: string;
};

const jobs = new Map<string, SplitJob>();

function execCheck(
  cmd: string,
  args: string[],
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    const proc = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => {
      resolvePromise({ ok: code === 0, stdout, stderr });
    });
    proc.on("error", () => {
      resolvePromise({ ok: false, stdout, stderr });
    });
  });
}

type PythonRunner = {
  cmd: string;
  argsPrefix: string[];
};

type StemDeviceInfo = {
  device: string;
  cuda_available: boolean;
  mps_available: boolean;
  gpu_name: string | null;
};

export async function findPythonWithDemucs(): Promise<PythonRunner> {
  const candidates: PythonRunner[] =
    process.platform === "win32"
      ? [
          { cmd: "py", argsPrefix: ["-3"] },
          { cmd: "python", argsPrefix: [] },
          { cmd: "python3", argsPrefix: [] },
        ]
      : [
          { cmd: "python3", argsPrefix: [] },
          { cmd: "python", argsPrefix: [] },
        ];

  for (const candidate of candidates) {
    const check = await execCheck(candidate.cmd, [
      ...candidate.argsPrefix,
      "-c",
      "import demucs; print('ok')",
    ]);
    if (check.ok && check.stdout.includes("ok")) {
      return candidate;
    }
  }

  throw new Error(
    "Demucs not found. Install with: pip install -r requirements-server.txt",
  );
}

async function queryStemDeviceInfo(
  runner: PythonRunner,
): Promise<StemDeviceInfo | null> {
  const check = await execCheck(runner.cmd, [
    ...runner.argsPrefix,
    PYTHON_SCRIPT,
    "--device-info",
  ]);
  if (!check.ok) return null;
  try {
    const parsed = JSON.parse(check.stdout.trim()) as StemDeviceInfo;
    if (parsed.device) return parsed;
  } catch {
    // Fall back to CPU-only reporting.
  }
  return null;
}

function formatStemDevice(info: StemDeviceInfo | null): string {
  if (!info) return "CPU";
  if (info.device === "cuda" && info.gpu_name) {
    return `GPU (${info.gpu_name})`;
  }
  if (info.device === "mps") return "GPU (Apple Silicon)";
  if (info.device === "cuda") return "GPU (CUDA)";
  return "CPU";
}

async function discoverStemOutputs(
  workDir: string,
): Promise<{ vocals: string; instrumental: string }> {
  const manifestPath = join(workDir, "manifest.json");
  try {
    const raw = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(raw) as { vocals?: string; instrumental?: string };
    if (manifest.vocals && manifest.instrumental) {
      await stat(manifest.vocals);
      await stat(manifest.instrumental);
      return { vocals: manifest.vocals, instrumental: manifest.instrumental };
    }
  } catch {
    // Fall back to scanning Demucs output folders.
  }

  const htdemucsRoot = join(workDir, "separated", "htdemucs");
  const entries = await readdir(htdemucsRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const vocals = join(htdemucsRoot, entry.name, "vocals.wav");
    const instrumental = join(htdemucsRoot, entry.name, "no_vocals.wav");
    try {
      await stat(vocals);
      await stat(instrumental);
      return { vocals, instrumental };
    } catch {
      // Try next Demucs output folder.
    }
  }

  throw new Error("Demucs finished but separated stem files were not found");
}

function spawnPythonSplit(
  runner: PythonRunner,
  inputPath: string,
  workDir: string,
): Promise<{ vocals: string; instrumental: string }> {
  const args = [...runner.argsPrefix, PYTHON_SCRIPT, inputPath, workDir];

  return new Promise((resolvePromise, reject) => {
    const proc = spawn(runner.cmd, args, {
      cwd: PROJECT_ROOT,
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";

    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });

    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Demucs exited with code ${code}`));
        return;
      }

      void discoverStemOutputs(workDir)
        .then(resolvePromise)
        .catch((err) => {
          reject(err instanceof Error ? err : new Error(String(err)));
        });
    });
  });
}

function safeFilename(name: string): string {
  const base = name.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 120);
  return base || "song";
}

export async function checkStemSplitterReady(): Promise<{
  ready: boolean;
  python?: string;
  device?: string;
  deviceLabel?: string;
  cudaAvailable?: boolean;
  mpsAvailable?: boolean;
  gpuName?: string | null;
  error?: string;
}> {
  try {
    const runner = await findPythonWithDemucs();
    const deviceInfo = await queryStemDeviceInfo(runner);
    return {
      ready: true,
      python: `${runner.cmd} ${runner.argsPrefix.join(" ")}`.trim(),
      device: deviceInfo?.device ?? "cpu",
      cudaAvailable: deviceInfo?.cuda_available ?? false,
      mpsAvailable: deviceInfo?.mps_available ?? false,
      gpuName: deviceInfo?.gpu_name ?? null,
      deviceLabel: formatStemDevice(deviceInfo),
    };
  } catch (err) {
    return {
      ready: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function splitUploadedSong(
  body: Buffer,
  filename: string,
): Promise<{
  jobId: string;
  vocalsUrl: string;
  instrumentalUrl: string;
  originalName: string;
}> {
  const jobId = randomUUID();
  const workDir = join(CACHE_ROOT, jobId);
  await mkdir(workDir, { recursive: true });

  if (body.length === 0) {
    throw new Error("Empty upload");
  }
  if (body.length > MAX_UPLOAD_BYTES) {
    throw new Error(`File too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB)`);
  }

  const ext = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")) : ".wav";
  const inputPath = join(workDir, `input${ext}`);
  await writeFile(inputPath, body);

  try {
    const python = await findPythonWithDemucs();
    const outputs = await spawnPythonSplit(python, inputPath, workDir);

    const vocalsPath = join(workDir, "vocals.wav");
    const instrumentalPath = join(workDir, "instrumental.wav");
    await copyFile(outputs.vocals, vocalsPath);
    await copyFile(outputs.instrumental, instrumentalPath);

    jobs.set(jobId, { vocalsPath, instrumentalPath });

    return {
      jobId,
      vocalsUrl: `/api/stems/cache/${jobId}/vocals.wav`,
      instrumentalUrl: `/api/stems/cache/${jobId}/instrumental.wav`,
      originalName: filename,
    };
  } catch (err) {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    throw err;
  }
}

export function getCachedStemPath(
  jobId: string,
  kind: "vocals" | "instrumental",
): string | null {
  if (!JOB_ID_RE.test(jobId)) return null;
  const job = jobs.get(jobId);
  if (!job) return null;
  return kind === "vocals" ? job.vocalsPath : job.instrumentalPath;
}

export async function initStemCache(): Promise<void> {
  await mkdir(CACHE_ROOT, { recursive: true });
}
