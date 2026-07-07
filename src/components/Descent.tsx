"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import {
  descentEnding,
  descentIntro,
  descentStages,
  type DescentStageMeta,
} from "@/lib/descent";

// The Descent — three depths, three entities, three minds of increasing size.
// Each depth is its own room; the chat is shared plumbing. Persona statements
// and per-depth models are resolved server-side by /api/persona-chat.

const PROGRESS_KEY = "tb_descent_depth"; // deepest depth reached: 1..3, 4 = finished

type Phase = "intro" | "stage" | "ending";

type ChatEntry = {
  role: "user" | "assistant" | "system";
  text: string;
};

type EntityMood = "idle" | "thinking" | "speaking";

// localStorage-backed progress store (useSyncExternalStore)
let progressCache: number | null = null;
const progressListeners = new Set<() => void>();

function subscribeToProgress(callback: () => void) {
  progressListeners.add(callback);
  return () => progressListeners.delete(callback);
}

function readProgress(): number {
  if (progressCache === null) {
    try {
      const value = parseInt(localStorage.getItem(PROGRESS_KEY) ?? "1", 10);
      progressCache = Number.isFinite(value)
        ? Math.min(Math.max(value, 1), 4)
        : 1;
    } catch {
      progressCache = 1;
    }
  }
  return progressCache;
}

function writeProgress(depth: number) {
  if (depth <= readProgress()) return;
  progressCache = depth;
  try {
    localStorage.setItem(PROGRESS_KEY, String(depth));
  } catch {
    // storage blocked — progress just won't persist
  }
  progressListeners.forEach((listener) => listener());
}

// --- scene builders ----------------------------------------------------------

type SceneHandles = {
  cleanup: () => void;
};

function buildScene(
  stage: DescentStageMeta,
  host: HTMLDivElement,
  moodRef: { current: EntityMood },
): SceneHandles {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    400,
  );

  const disposables: { dispose(): void }[] = [];
  const pointer = { x: 0, y: 0 };
  const onPointerMove = (event: PointerEvent) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener("pointermove", onPointerMove);

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", onResize);

  const clock = new THREE.Clock();
  let animationFrame = 0;
  let tick: (delta: number, elapsed: number) => void = () => {};

  // --- depth 1: a wall of jittering static that leans toward your cursor ------
  if (stage.id === "echo") {
    scene.background = new THREE.Color(0x0a0a0c);
    scene.fog = new THREE.Fog(0x0a0a0c, 6, 26);
    camera.position.set(0, 0, 9);

    const COLS = 90;
    const ROWS = 60;
    const COUNT = COLS * ROWS;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    const base = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    let i = 0;
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        base[i * 3] = (c / (COLS - 1) - 0.5) * 22;
        base[i * 3 + 1] = (r / (ROWS - 1) - 0.5) * 13;
        base[i * 3 + 2] = 0;
        seeds[i] = Math.random() * Math.PI * 2;
        i += 1;
      }
    }
    positions.set(base);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xd4d4d8,
      size: 0.05,
      transparent: true,
      opacity: 0.75,
      sizeAttenuation: true,
    });
    const wall = new THREE.Points(geometry, material);
    scene.add(wall);
    disposables.push(geometry, material);

    tick = (delta, elapsed) => {
      const mood = moodRef.current;
      const agitation =
        mood === "thinking" ? 3.2 : mood === "speaking" ? 1.9 : 1;
      const array = geometry.attributes.position.array as Float32Array;
      for (let p = 0; p < COUNT; p += 1) {
        const seed = seeds[p];
        const bx = base[p * 3];
        const by = base[p * 3 + 1];
        // the wall shivers, and bulges gently toward the pointer
        const dx = bx / 11 - pointer.x;
        const dy = -by / 6.5 - pointer.y;
        const near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
        array[p * 3] = bx + Math.sin(elapsed * 9 + seed) * 0.03 * agitation;
        array[p * 3 + 1] = by + Math.cos(elapsed * 8 + seed * 2) * 0.03 * agitation;
        array[p * 3 + 2] =
          Math.sin(elapsed * 2 + seed) * 0.12 * agitation + near * 1.6;
      }
      geometry.attributes.position.needsUpdate = true;
      camera.position.x += (pointer.x * 0.7 - camera.position.x) * delta * 2;
      camera.position.y += (-pointer.y * 0.5 - camera.position.y) * delta * 2;
      camera.lookAt(0, 0, 0);
    };
  }

  // --- depth 2: a melting dream-blob in hue-cycling fog ------------------------
  if (stage.id === "dream") {
    const bg = new THREE.Color();
    scene.background = bg;
    scene.fog = new THREE.Fog(0x000000, 8, 34);
    camera.position.set(0, 1.4, 8.5);

    const blobGeometry = new THREE.IcosahedronGeometry(2.1, 4);
    const basePositions = (
      blobGeometry.attributes.position.array as Float32Array
    ).slice();
    const blobMaterial = new THREE.MeshBasicMaterial({
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    const blob = new THREE.Mesh(blobGeometry, blobMaterial);
    blob.position.y = 1.6;
    scene.add(blob);
    disposables.push(blobGeometry, blobMaterial);

    // drifting motes in complementary hues
    const MOTES = 260;
    const moteGeometry = new THREE.BufferGeometry();
    const motePositions = new Float32Array(MOTES * 3);
    const moteSeeds = new Float32Array(MOTES);
    for (let m = 0; m < MOTES; m += 1) {
      motePositions[m * 3] = (Math.random() - 0.5) * 26;
      motePositions[m * 3 + 1] = Math.random() * 10 - 2;
      motePositions[m * 3 + 2] = (Math.random() - 0.5) * 26;
      moteSeeds[m] = Math.random() * Math.PI * 2;
    }
    moteGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(motePositions, 3),
    );
    const moteMaterial = new THREE.PointsMaterial({
      size: 0.09,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });
    const motes = new THREE.Points(moteGeometry, moteMaterial);
    scene.add(motes);
    disposables.push(moteGeometry, moteMaterial);

    const blobColor = new THREE.Color();
    const moteColor = new THREE.Color();

    tick = (delta, elapsed) => {
      const mood = moodRef.current;
      const churn = mood === "thinking" ? 2.4 : mood === "speaking" ? 1.5 : 1;
      const hue = (elapsed * 0.012) % 1;
      bg.setHSL(hue, 0.32, 0.14);
      scene.fog?.color.setHSL(hue, 0.32, 0.14);
      blobColor.setHSL((hue + 0.5) % 1, 0.75, 0.62);
      blobMaterial.color = blobColor;
      moteColor.setHSL((hue + 0.28) % 1, 0.8, 0.7);
      moteMaterial.color = moteColor;

      // melt the blob: displace each vertex along its base direction
      const array = blobGeometry.attributes.position.array as Float32Array;
      for (let v = 0; v < array.length; v += 3) {
        const bx = basePositions[v];
        const by = basePositions[v + 1];
        const bz = basePositions[v + 2];
        const swell =
          1 +
          0.22 *
            Math.sin(elapsed * 1.1 * churn + bx * 1.7 + by * 2.3) *
            Math.cos(elapsed * 0.7 * churn + bz * 2.1);
        array[v] = bx * swell;
        array[v + 1] = by * swell;
        array[v + 2] = bz * swell;
      }
      blobGeometry.attributes.position.needsUpdate = true;
      blob.rotation.y += delta * 0.12 * churn;

      const moteArray = moteGeometry.attributes.position.array as Float32Array;
      for (let m = 0; m < MOTES; m += 1) {
        moteArray[m * 3 + 1] +=
          Math.sin(elapsed * 0.4 + moteSeeds[m]) * delta * 0.4;
      }
      moteGeometry.attributes.position.needsUpdate = true;

      camera.position.x = Math.sin(elapsed * 0.09) * 1.4 + pointer.x * 0.6;
      camera.position.y = 1.4 + Math.sin(elapsed * 0.23) * 0.35;
      camera.lookAt(0, 1.6, 0);
    };
  }

  // --- depth 3: a vast slow ring over a black sea; one small bright presence ---
  if (stage.id === "deep") {
    scene.background = new THREE.Color(0x04050f);
    scene.fog = new THREE.Fog(0x04050f, 10, 90);
    camera.position.set(0, 1.6, 10);

    // starfield
    const STARS = 1400;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(STARS * 3);
    for (let s = 0; s < STARS; s += 1) {
      starPositions[s * 3] = (Math.random() - 0.5) * 160;
      starPositions[s * 3 + 1] = Math.random() * 70 - 10;
      starPositions[s * 3 + 2] = (Math.random() - 0.5) * 160;
    }
    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    const starMaterial = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.12,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
    disposables.push(starGeometry, starMaterial);

    // the colossal ring overhead — scale is the point
    const ringGeometry = new THREE.TorusGeometry(26, 6, 20, 160);
    const ringPoints = new THREE.Points(
      ringGeometry,
      new THREE.PointsMaterial({
        color: 0x7dd3fc,
        size: 0.16,
        transparent: true,
        opacity: 0.5,
        sizeAttenuation: true,
      }),
    );
    ringPoints.position.set(0, 26, -30);
    ringPoints.rotation.x = Math.PI / 2.4;
    scene.add(ringPoints);
    disposables.push(ringGeometry, ringPoints.material as THREE.Material);

    // the presence: one small bright sphere at eye level
    const orbGeometry = new THREE.SphereGeometry(0.42, 32, 32);
    const orbMaterial = new THREE.MeshBasicMaterial({ color: 0xdbeafe });
    const orb = new THREE.Mesh(orbGeometry, orbMaterial);
    orb.position.set(0, 1.8, 0);
    scene.add(orb);
    disposables.push(orbGeometry, orbMaterial);

    const auraCanvas = document.createElement("canvas");
    auraCanvas.width = auraCanvas.height = 128;
    const auraCtx = auraCanvas.getContext("2d");
    if (auraCtx) {
      const g = auraCtx.createRadialGradient(64, 64, 4, 64, 64, 64);
      g.addColorStop(0, "rgba(186, 230, 253, 0.8)");
      g.addColorStop(0.4, "rgba(125, 211, 252, 0.25)");
      g.addColorStop(1, "rgba(125, 211, 252, 0)");
      auraCtx.fillStyle = g;
      auraCtx.fillRect(0, 0, 128, 128);
    }
    const auraTexture = new THREE.CanvasTexture(auraCanvas);
    const auraMaterial = new THREE.SpriteMaterial({
      map: auraTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const aura = new THREE.Sprite(auraMaterial);
    aura.position.copy(orb.position);
    aura.scale.set(4, 4, 1);
    scene.add(aura);
    disposables.push(auraTexture, auraMaterial);

    tick = (delta, elapsed) => {
      const mood = moodRef.current;
      ringPoints.rotation.z += delta * 0.012;
      stars.rotation.y += delta * 0.004;

      const pulse =
        mood === "speaking"
          ? 1 + Math.sin(elapsed * 12) * 0.12
          : mood === "thinking"
            ? 1 + Math.sin(elapsed * 5) * 0.06
            : 1 + Math.sin(elapsed * 1.2) * 0.03;
      orb.scale.setScalar(pulse);
      aura.scale.setScalar(4 * pulse * (mood === "speaking" ? 1.3 : 1));

      camera.position.x = Math.sin(elapsed * 0.05) * 1.1 + pointer.x * 0.4;
      camera.position.y = 1.6 + Math.sin(elapsed * 0.2) * 0.12;
      camera.lookAt(0, 2.2, -2);
    };
  }

  const animate = () => {
    animationFrame = window.requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    tick(delta, clock.elapsedTime);
    renderer.render(scene, camera);
  };
  animate();

  return {
    cleanup: () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      disposables.forEach((resource) => resource.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

// --- one depth: scene + entrance + chat ---------------------------------------

function DepthStage({
  stage,
  onDescend,
}: {
  stage: DescentStageMeta;
  onDescend: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const moodRef = useRef<EntityMood>("idle");
  const speakingUntilRef = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  const [entered, setEntered] = useState(false);
  const [entries, setEntries] = useState<ChatEntry[]>([
    { role: "system", text: stage.arrivalNote },
  ]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const replies = entries.filter((entry) => entry.role === "assistant").length;
  const canDescend = replies >= stage.minRepliesToDescend;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [entries]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const handles = buildScene(stage, host, moodRef);
    return handles.cleanup;
    // stage never changes within one mount — each depth remounts by key
  }, [stage]);

  // release the "speaking" mood after the reply has had time to land
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        moodRef.current === "speaking" &&
        performance.now() > speakingUntilRef.current
      ) {
        moodRef.current = "idle";
      }
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const send = async () => {
    const text = draft.trim();
    if (!text || waiting) return;
    setDraft("");
    setWaiting(true);
    moodRef.current = "thinking";

    const nextEntries: ChatEntry[] = [...entries, { role: "user", text }];
    setEntries(nextEntries);
    const history = nextEntries
      .filter((entry) => entry.role !== "system")
      .map((entry) => ({ role: entry.role, content: entry.text }));

    try {
      const response = await fetch("/api/persona-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: stage.id, messages: history }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.reply) {
        setEntries((current) => [
          ...current,
          { role: "assistant", text: data.reply },
        ]);
        speakingUntilRef.current =
          performance.now() + Math.min(1200 + data.reply.length * 40, 9000);
        moodRef.current = "speaking";
      } else if (response.status === 503) {
        setEntries((current) => [
          ...current,
          {
            role: "system",
            text: "…the depth is silent. its mind isn't wired in yet.",
          },
        ]);
        moodRef.current = "idle";
      } else {
        setEntries((current) => [
          ...current,
          { role: "system", text: data?.error ?? "the signal frayed. again?" },
        ]);
        moodRef.current = "idle";
      }
    } catch {
      setEntries((current) => [
        ...current,
        { role: "system", text: "the signal frayed. again?" },
      ]);
      moodRef.current = "idle";
    } finally {
      setWaiting(false);
    }
  };

  const theme = stage.theme;
  const wrapperFx =
    stage.id === "echo"
      ? "echo-flicker"
      : stage.id === "dream"
        ? ""
        : "deep-vignette";

  return (
    <div
      className={`fixed inset-0 overflow-hidden bg-black font-mono ${wrapperFx}`}
      style={{ color: theme.text }}
    >
      <div
        ref={hostRef}
        className={`stage-fixed ${stage.id === "dream" ? "dream-shift" : ""}`}
      />

      {/* entrance veil */}
      {!entered && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/70 px-6 text-center backdrop-blur-sm">
          <p
            className="text-xs uppercase tracking-[0.35em]"
            style={{ color: theme.muted }}
          >
            {stage.title}
          </p>
          <h2
            className="text-3xl font-bold tracking-[0.15em]"
            style={{ color: theme.accent }}
          >
            {stage.entity}
          </h2>
          <div className="max-w-md space-y-2">
            {stage.entrance.map((line) => (
              <p
                key={line.slice(0, 24)}
                className="text-sm leading-relaxed opacity-80"
              >
                {line}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setEntered(true)}
            className="mt-4 rounded-full border px-8 py-3 text-xs font-bold uppercase tracking-[0.25em] transition-colors"
            style={{ borderColor: theme.accent, color: theme.accent }}
          >
            step in
          </button>
        </div>
      )}

      {/* HUD */}
      <div className="absolute inset-0 z-10 flex flex-col">
        <div className="flex items-center justify-between p-4">
          <p
            className="text-xs uppercase tracking-[0.3em]"
            style={{ color: theme.muted }}
          >
            {stage.title} · {stage.entity}
          </p>
          <Link
            href="/rabbit-hole"
            className="rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.2em] opacity-70 transition-opacity hover:opacity-100"
            style={{ borderColor: theme.muted, color: theme.text }}
          >
            bail out
          </Link>
        </div>

        <div className="flex-1" />

        {canDescend && (
          <div className="flex justify-center pb-3">
            <button
              type="button"
              onClick={onDescend}
              className="animate-pulse rounded-full border px-8 py-3 text-xs font-bold uppercase tracking-[0.25em] backdrop-blur-sm transition-all hover:animate-none"
              style={{
                borderColor: theme.accent,
                color: theme.accent,
                background: theme.panelBg,
              }}
            >
              {stage.descendLabel} ↓
            </button>
          </div>
        )}

        <div className="mx-auto w-full max-w-2xl px-4 pb-4">
          <div
            ref={logRef}
            className="max-h-[34svh] space-y-3 overflow-y-auto rounded-2xl border p-4 backdrop-blur-md"
            style={{ borderColor: `${theme.muted}55`, background: theme.panelBg }}
          >
            {entries.map((entry, i) => (
              <p
                key={`${i}-${entry.text.slice(0, 16)}`}
                className={`text-sm leading-relaxed ${
                  entry.role === "system" ? "italic opacity-60" : ""
                }`}
              >
                {entry.role !== "system" && (
                  <span
                    className="font-bold"
                    style={{
                      color:
                        entry.role === "assistant" ? theme.accent : theme.muted,
                    }}
                  >
                    {entry.role === "assistant" ? stage.entity : "you"}
                    {": "}
                  </span>
                )}
                <span
                  className={
                    entry.role === "assistant" && stage.id === "echo"
                      ? "glitch-shiver"
                      : ""
                  }
                >
                  {entry.text}
                </span>
              </p>
            ))}
            {waiting && (
              <p
                className="animate-pulse text-sm"
                style={{ color: theme.accent }}
              >
                …
              </p>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={stage.placeholder}
              maxLength={600}
              className="min-w-0 flex-1 rounded-full border bg-black/60 px-5 py-3 text-sm outline-none backdrop-blur-sm transition-colors placeholder:opacity-50"
              style={{ borderColor: `${theme.muted}88`, color: theme.text }}
            />
            <button
              type="submit"
              disabled={waiting || !draft.trim()}
              className="rounded-full border px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] transition-opacity disabled:opacity-30"
              style={{ borderColor: theme.accent, color: theme.accent }}
            >
              send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- the journey ---------------------------------------------------------------

export default function Descent() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [depth, setDepth] = useState(1);
  const reached = useSyncExternalStore(
    subscribeToProgress,
    readProgress,
    () => 1,
  );

  const stage = descentStages.find((s) => s.depth === depth);

  const descend = () => {
    if (depth >= 3) {
      writeProgress(4);
      setPhase("ending");
      return;
    }
    const next = depth + 1;
    writeProgress(next);
    setDepth(next);
  };

  if (phase === "stage" && stage) {
    return <DepthStage key={stage.id} stage={stage} onDescend={descend} />;
  }

  if (phase === "ending") {
    return (
      <main className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-[#04050f] px-6 text-center font-mono text-sky-100">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
          the descent · complete
        </p>
        <h1 className="max-w-xl text-3xl font-bold leading-snug text-sky-200 md:text-4xl">
          {descentEnding.title}
        </h1>
        <div className="max-w-lg space-y-3">
          {descentEnding.lines.map((line) => (
            <p
              key={line.slice(0, 24)}
              className="text-sm leading-relaxed text-slate-300"
            >
              {line}
            </p>
          ))}
        </div>
        <Link
          href={descentEnding.cta.href}
          className="mt-4 rounded-full border border-sky-300 px-8 py-3 text-xs font-bold uppercase tracking-[0.25em] text-sky-200 transition-colors hover:bg-sky-300 hover:text-slate-950"
        >
          {descentEnding.cta.label}
        </Link>
        <Link
          href={descentEnding.back.href}
          className="text-xs uppercase tracking-[0.25em] text-slate-500 transition-colors hover:text-slate-300"
        >
          {descentEnding.back.label}
        </Link>
      </main>
    );
  }

  // intro
  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-black px-6 text-center font-mono text-zinc-200">
      <p className="text-xs uppercase tracking-[0.35em] text-zinc-600">
        below the construct
      </p>
      <h1 className="text-4xl font-bold tracking-[0.2em] text-zinc-100 md:text-5xl">
        {descentIntro.title}
      </h1>
      <div className="max-w-md space-y-2">
        {descentIntro.lines.map((line) => (
          <p
            key={line.slice(0, 24)}
            className="text-sm leading-relaxed text-zinc-400"
          >
            {line}
          </p>
        ))}
      </div>
      <div className="mt-4 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setDepth(1);
            setPhase("stage");
          }}
          className="rounded-full border border-zinc-300 px-8 py-3 text-xs font-bold uppercase tracking-[0.25em] text-zinc-100 transition-colors hover:bg-zinc-100 hover:text-black"
        >
          {descentIntro.begin} ↓
        </button>
        {reached > 1 && (
          <div className="flex gap-2">
            {descentStages
              .filter((s) => s.depth <= Math.min(reached, 3) && s.depth > 1)
              .map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setDepth(s.depth);
                    setPhase("stage");
                  }}
                  className="rounded-full border border-zinc-700 px-5 py-2 text-[11px] uppercase tracking-[0.2em] text-zinc-400 transition-colors hover:border-zinc-400 hover:text-zinc-200"
                >
                  {descentIntro.resume} {s.depth.toString().padStart(2, "0")}
                </button>
              ))}
          </div>
        )}
      </div>
      <Link
        href="/rabbit-hole"
        className="mt-2 text-xs uppercase tracking-[0.25em] text-zinc-600 transition-colors hover:text-zinc-400"
      >
        ← not yet
      </Link>
    </main>
  );
}
