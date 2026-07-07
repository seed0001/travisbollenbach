"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { archetypes, characterWorkshop } from "@/lib/content";

// The Studio — character creation. Deliberately its own world: light, warm,
// serif display type, one iris accent. No terminal green in sight.

const STORAGE_KEY = "tb_characters"; // unchanged so existing characters survive
const MOTE_COUNT = 320;
const MAX_STATEMENT = 2000;

// pastel motes orbiting the character: iris, sky, peach, lilac
const MOTE_COLORS = [0x5b54d9, 0x74a8e0, 0xe88d67, 0xb08ae0];

export type SavedCharacter = {
  id: string;
  name: string;
  archetypeId: string | null;
  statement: string;
  createdAt: string;
};

type ChatEntry = {
  role: "user" | "assistant" | "system";
  text: string;
};

type EntityMood = "idle" | "thinking" | "speaking";

// localStorage-backed store for characters (useSyncExternalStore)
const EMPTY_CHARACTERS: SavedCharacter[] = [];
let characterCache: SavedCharacter[] | null = null;
const characterListeners = new Set<() => void>();

function subscribeToCharacters(callback: () => void) {
  characterListeners.add(callback);
  return () => characterListeners.delete(callback);
}

function getCharacters(): SavedCharacter[] {
  if (characterCache === null) {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
      characterCache = Array.isArray(parsed) ? parsed : [];
    } catch {
      characterCache = [];
    }
  }
  return characterCache;
}

function setCharacters(next: SavedCharacter[]) {
  characterCache = next.slice(-24);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(characterCache));
  } catch {
    // storage full or blocked — the session still works, it just won't persist
  }
  characterListeners.forEach((listener) => listener());
}

function archetypeTitle(id: string | null): string | null {
  return archetypes.find((a) => a.id === id)?.title ?? null;
}

// --- The chamber: a bright room where the character takes shape --------------

function Chamber({
  character,
  onRecompile,
}: {
  character: SavedCharacter;
  onRecompile: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const moodRef = useRef<EntityMood>("idle");
  const speakingUntilRef = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  const [entries, setEntries] = useState<ChatEntry[]>([
    {
      role: "system",
      text: `${character.name} is awake. ${characterWorkshop.chamber.hint}.`,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const voiceRef = useRef(false);

  const setMood = (mood: EntityMood) => {
    moodRef.current = mood;
  };

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [entries]);

  const speak = (text: string) => {
    const durationMs = Math.min(1200 + text.length * 45, 9000);
    speakingUntilRef.current = performance.now() + durationMs;
    setMood("speaking");
    if (voiceRef.current && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.pitch = 1.0;
      utterance.rate = 0.97;
      utterance.onend = () => {
        speakingUntilRef.current = 0;
        setMood("idle");
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || waiting) return;
    setDraft("");
    setWaiting(true);
    setMood("thinking");

    const nextEntries: ChatEntry[] = [...entries, { role: "user", text }];
    setEntries(nextEntries);

    const history = nextEntries
      .filter((entry) => entry.role !== "system")
      .map((entry) => ({ role: entry.role, content: entry.text }));

    try {
      const response = await fetch("/api/persona-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: { name: character.name, statement: character.statement },
          messages: history,
        }),
      });
      const data = await response.json().catch(() => null);

      if (response.ok && data?.reply) {
        setEntries((current) => [
          ...current,
          { role: "assistant", text: data.reply },
        ]);
        speak(data.reply);
      } else if (response.status === 503) {
        const chamber = characterWorkshop.chamber;
        const text =
          data?.reason === "bad_key"
            ? chamber.badKey
            : data?.reason === "no_credits"
              ? chamber.noCredits
              : data?.reason === "unreachable"
                ? chamber.unreachable
                : chamber.offline;
        setEntries((current) => [...current, { role: "system", text }]);
        setMood("idle");
      } else {
        setEntries((current) => [
          ...current,
          { role: "system", text: data?.error ?? "Connection lost. Try again." },
        ]);
        setMood("idle");
      }
    } catch {
      setEntries((current) => [
        ...current,
        { role: "system", text: "Connection lost. Try again." },
      ]);
      setMood("idle");
    } finally {
      setWaiting(false);
    }
  };

  // --- Scene: bright, soft, alive --------------------------------------------
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const BG = 0xf2f0fa;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.Fog(BG, 10, 42);

    const camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.set(0, 1.9, 7.2);
    camera.lookAt(0, 2.1, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

    const disposables: { dispose(): void }[] = [];

    // soft ground shadow so the figure sits in the room instead of floating
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 256;
    const shadowCtx = shadowCanvas.getContext("2d");
    if (shadowCtx) {
      const g = shadowCtx.createRadialGradient(128, 128, 8, 128, 128, 128);
      g.addColorStop(0, "rgba(42, 39, 51, 0.28)");
      g.addColorStop(1, "rgba(42, 39, 51, 0)");
      shadowCtx.fillStyle = g;
      shadowCtx.fillRect(0, 0, 256, 256);
    }
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      depthWrite: false,
    });
    const shadowGeometry = new THREE.PlaneGeometry(7, 7);
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    scene.add(shadow);
    disposables.push(shadowGeometry, shadowMaterial, shadowTexture);

    // --- the character ---------------------------------------------------------
    const entity = new THREE.Group();
    entity.position.set(0, 2.1, 0);
    scene.add(entity);

    const shellGeometry = new THREE.IcosahedronGeometry(1, 1);
    const shellMaterial = new THREE.MeshBasicMaterial({
      color: 0x5b54d9,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    const shell = new THREE.Mesh(shellGeometry, shellMaterial);
    entity.add(shell);
    disposables.push(shellGeometry, shellMaterial);

    const coreGeometry = new THREE.IcosahedronGeometry(0.52, 2);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0x8f86ef,
      transparent: true,
      opacity: 0.35,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    entity.add(core);
    disposables.push(coreGeometry, coreMaterial);

    // gentle lavender aura
    const auraCanvas = document.createElement("canvas");
    auraCanvas.width = auraCanvas.height = 128;
    const auraCtx = auraCanvas.getContext("2d");
    if (auraCtx) {
      const g = auraCtx.createRadialGradient(64, 64, 6, 64, 64, 64);
      g.addColorStop(0, "rgba(122, 112, 233, 0.35)");
      g.addColorStop(0.6, "rgba(122, 112, 233, 0.1)");
      g.addColorStop(1, "rgba(122, 112, 233, 0)");
      auraCtx.fillStyle = g;
      auraCtx.fillRect(0, 0, 128, 128);
    }
    const auraTexture = new THREE.CanvasTexture(auraCanvas);
    const auraMaterial = new THREE.SpriteMaterial({
      map: auraTexture,
      transparent: true,
      depthWrite: false,
    });
    const aura = new THREE.Sprite(auraMaterial);
    aura.scale.set(5.5, 5.5, 1);
    entity.add(aura);
    disposables.push(auraTexture, auraMaterial);

    // orbiting pastel motes — the character's thoughts as soft points of color
    const moteCanvas = document.createElement("canvas");
    moteCanvas.width = moteCanvas.height = 64;
    const moteCtx = moteCanvas.getContext("2d");
    if (moteCtx) {
      const g = moteCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.4, "rgba(255,255,255,0.7)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      moteCtx.fillStyle = g;
      moteCtx.fillRect(0, 0, 64, 64);
    }
    const moteTexture = new THREE.CanvasTexture(moteCanvas);

    const moteGeometry = new THREE.BufferGeometry();
    const motePositions = new Float32Array(MOTE_COUNT * 3);
    const moteColors = new Float32Array(MOTE_COUNT * 3);
    const orbits = new Array(MOTE_COUNT).fill(0).map(() => ({
      theta: Math.random() * Math.PI * 2,
      phi: Math.acos(2 * Math.random() - 1),
      radius: 1.6 + Math.random() * 1.2,
      speed: 0.2 + Math.random() * 0.55,
      wobble: Math.random() * Math.PI * 2,
    }));
    const colorScratch = new THREE.Color();
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      colorScratch.setHex(
        MOTE_COLORS[Math.floor(Math.random() * MOTE_COLORS.length)],
      );
      moteColors[i * 3] = colorScratch.r;
      moteColors[i * 3 + 1] = colorScratch.g;
      moteColors[i * 3 + 2] = colorScratch.b;
    }
    moteGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(motePositions, 3),
    );
    moteGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(moteColors, 3),
    );
    const moteMaterial = new THREE.PointsMaterial({
      size: 0.085,
      map: moteTexture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      vertexColors: true,
      sizeAttenuation: true,
    });
    const motes = new THREE.Points(moteGeometry, moteMaterial);
    entity.add(motes);
    disposables.push(moteGeometry, moteMaterial, moteTexture);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let animationFrame = 0;
    let radiusScale = 1;
    let spin = 1;

    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      if (
        moodRef.current === "speaking" &&
        speakingUntilRef.current > 0 &&
        performance.now() > speakingUntilRef.current
      ) {
        moodRef.current = "idle";
      }
      const mood = moodRef.current;

      const targetRadius =
        mood === "thinking" ? 0.62 : mood === "speaking" ? 1.12 : 1;
      const targetSpin = mood === "thinking" ? 4 : mood === "speaking" ? 1.7 : 1;
      radiusScale += (targetRadius - radiusScale) * Math.min(1, delta * 4);
      spin += (targetSpin - spin) * Math.min(1, delta * 4);

      const pulse =
        mood === "speaking"
          ? 1 + Math.sin(elapsed * 14) * 0.09 + Math.sin(elapsed * 31) * 0.04
          : 1 + Math.sin(elapsed * 1.6) * 0.04;
      shell.scale.setScalar(pulse);
      core.scale.setScalar(pulse * (mood === "thinking" ? 0.82 : 1));
      aura.scale.setScalar(5.5 * pulse * (mood === "speaking" ? 1.12 : 1));
      shell.rotation.y += delta * 0.28 * spin;
      shell.rotation.x += delta * 0.1 * spin;
      core.rotation.y -= delta * 0.45 * spin;

      const positions = moteGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < MOTE_COUNT; i += 1) {
        const orbit = orbits[i];
        orbit.theta += delta * orbit.speed * spin;
        const wobble = Math.sin(elapsed * 0.8 + orbit.wobble) * 0.16;
        const radius = (orbit.radius + wobble) * radiusScale;
        positions[i * 3] = radius * Math.sin(orbit.phi) * Math.cos(orbit.theta);
        positions[i * 3 + 1] = radius * Math.cos(orbit.phi) * 0.82;
        positions[i * 3 + 2] =
          radius * Math.sin(orbit.phi) * Math.sin(orbit.theta);
      }
      moteGeometry.attributes.position.needsUpdate = true;

      // slow, calm camera drift
      camera.position.x = Math.sin(elapsed * 0.1) * 0.5;
      camera.position.y = 1.9 + Math.sin(elapsed * 0.35) * 0.07;
      camera.lookAt(0, 2.1, 0);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", onResize);
      disposables.forEach((resource) => resource.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const archetype = archetypeTitle(character.archetypeId);

  return (
    <div className="studio fixed inset-0 overflow-hidden bg-studio-bg text-studio-ink">
      <div ref={hostRef} className="stage-fixed" />

      {/* HUD */}
      <div className="absolute inset-0 z-10 flex flex-col">
        {/* top bar */}
        <div className="flex items-center justify-between gap-3 p-4 sm:p-5">
          <div className="flex items-center gap-3 rounded-full border border-studio-line bg-white/80 py-2 pl-3 pr-5 shadow-sm backdrop-blur-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-studio-iris to-studio-peach text-sm font-bold text-white">
              {character.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <span className="studio-display block text-sm font-bold leading-tight">
                {character.name}
              </span>
              {archetype && (
                <span className="block text-[11px] leading-tight text-studio-muted">
                  {archetype}
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !voiceRef.current;
                voiceRef.current = next;
                setVoiceOn(next);
                if (!next && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
              }}
              className={`rounded-full border px-4 py-2 text-xs font-semibold shadow-sm backdrop-blur-sm transition-colors ${
                voiceOn
                  ? "border-studio-iris bg-studio-iris-soft text-studio-iris"
                  : "border-studio-line bg-white/80 text-studio-muted hover:text-studio-ink"
              }`}
            >
              {voiceOn ? "voice on" : "voice off"}
            </button>
            <button
              type="button"
              onClick={onRecompile}
              className="rounded-full border border-studio-line bg-white/80 px-4 py-2 text-xs font-semibold text-studio-muted shadow-sm backdrop-blur-sm transition-colors hover:text-studio-ink"
            >
              back to the studio
            </button>
          </div>
        </div>

        <div className="flex-1" />

        {/* conversation */}
        <div className="mx-auto w-full max-w-2xl px-4 pb-5">
          <div
            ref={logRef}
            className="max-h-[36svh] space-y-3 overflow-y-auto rounded-2xl border border-studio-line bg-white/85 p-5 shadow-lg backdrop-blur-sm"
          >
            {entries.map((entry, i) => (
              <div key={`${i}-${entry.text.slice(0, 16)}`}>
                {entry.role === "system" ? (
                  <p className="text-xs italic leading-relaxed text-studio-muted">
                    {entry.text}
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed">
                    <span
                      className={
                        entry.role === "assistant"
                          ? "font-bold text-studio-iris"
                          : "font-bold text-studio-muted"
                      }
                    >
                      {entry.role === "assistant" ? character.name : "you"}
                      {": "}
                    </span>
                    <span className="text-studio-ink">{entry.text}</span>
                  </p>
                )}
              </div>
            ))}
            {waiting && (
              <p className="animate-pulse text-sm text-studio-iris">
                {character.name} is thinking…
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
              placeholder={characterWorkshop.chamber.hint}
              maxLength={600}
              className="min-w-0 flex-1 rounded-full border border-studio-line bg-white px-5 py-3 text-sm text-studio-ink shadow-sm outline-none transition-colors placeholder:text-studio-muted focus:border-studio-iris"
            />
            <button
              type="submit"
              disabled={waiting || !draft.trim()}
              className="rounded-full bg-studio-iris px-6 py-3 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition-all enabled:hover:brightness-110 disabled:opacity-40"
            >
              send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- The studio: craft the persona --------------------------------------------

export default function CharacterWorkshop() {
  const [name, setName] = useState("");
  const [archetypeId, setArchetypeId] = useState<string | null>(null);
  const [statement, setStatement] = useState("");
  const [active, setActive] = useState<SavedCharacter | null>(null);
  const saved = useSyncExternalStore(
    subscribeToCharacters,
    getCharacters,
    () => EMPTY_CHARACTERS,
  );

  const pickArchetype = (id: string) => {
    setArchetypeId(id);
    const archetype = archetypes.find((a) => a.id === id);
    if (archetype && statement.trim().length === 0) {
      setStatement(archetype.seed);
    }
  };

  const canCompile = name.trim().length > 0 && statement.trim().length >= 40;

  const compile = () => {
    if (!canCompile) return;
    const character: SavedCharacter = {
      id: crypto.randomUUID(),
      name: name.trim(),
      archetypeId,
      statement: statement.trim(),
      createdAt: new Date().toISOString(),
    };
    setCharacters([...saved, character]);
    setActive(character);
  };

  const remove = (id: string) => {
    setCharacters(saved.filter((c) => c.id !== id));
  };

  const loadIntoStudio = (character: SavedCharacter) => {
    setName(character.name);
    setArchetypeId(character.archetypeId);
    setStatement(character.statement);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (active) {
    return <Chamber character={active} onRecompile={() => setActive(null)} />;
  }

  return (
    <main className="studio studio-wash relative min-h-svh text-studio-ink">
      <div className="mx-auto max-w-5xl px-6 pb-24">
        {/* header */}
        <header className="flex items-center justify-between py-6">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-studio-ink transition-colors hover:text-studio-iris"
          >
            Travis Bollenbach
          </Link>
          <Link
            href="/rabbit-hole"
            className="text-xs font-semibold text-studio-muted transition-colors hover:text-studio-iris"
          >
            ← back to the rabbit hole
          </Link>
        </header>

        {/* hero */}
        <section className="pb-14 pt-10 md:pt-16">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.25em] text-studio-iris">
            {characterWorkshop.eyebrow}
          </p>
          <h1 className="studio-display max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight md:text-6xl">
            Write a mind{" "}
            <em className="text-studio-iris">into being.</em>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-studio-muted md:text-lg">
            {characterWorkshop.intro}
          </p>
        </section>

        {/* the studio: form + live preview */}
        <section className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            {/* 01 — identity */}
            <div className="rounded-3xl border border-studio-line bg-studio-card p-7 shadow-sm md:p-9">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-studio-muted">
                <span className="text-studio-iris">01</span> · identity
              </p>
              <label
                htmlFor="name"
                className="mt-6 block text-sm font-semibold"
              >
                {characterWorkshop.forge.nameLabel}
              </label>
              <input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                placeholder={characterWorkshop.forge.namePlaceholder}
                className="mt-2 w-full rounded-xl border border-studio-line bg-white px-4 py-3 text-lg text-studio-ink outline-none transition-colors placeholder:text-studio-muted/70 focus:border-studio-iris"
              />
            </div>

            {/* 02 — personality */}
            <div className="rounded-3xl border border-studio-line bg-studio-card p-7 shadow-sm md:p-9">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-studio-muted">
                <span className="text-studio-iris">02</span> · personality
              </p>

              <p className="mt-6 text-sm font-semibold">
                {characterWorkshop.forge.archetypeLabel}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {archetypes.map((archetype) => (
                  <button
                    key={archetype.id}
                    type="button"
                    onClick={() => pickArchetype(archetype.id)}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      archetypeId === archetype.id
                        ? "border-studio-iris bg-studio-iris-soft shadow-sm"
                        : "border-studio-line bg-white hover:border-studio-iris/40"
                    }`}
                  >
                    <p
                      className={`studio-display font-bold ${
                        archetypeId === archetype.id
                          ? "text-studio-iris"
                          : "text-studio-ink"
                      }`}
                    >
                      {archetype.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-studio-muted">
                      {archetype.tagline}
                    </p>
                  </button>
                ))}
              </div>

              <div className="mt-8 flex items-baseline justify-between gap-4">
                <label htmlFor="statement" className="text-sm font-semibold">
                  {characterWorkshop.forge.statementLabel}
                </label>
                <span className="text-xs text-studio-muted">
                  {statement.length}/{MAX_STATEMENT}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-studio-muted">
                {characterWorkshop.forge.statementHelp}
              </p>
              <textarea
                id="statement"
                value={statement}
                onChange={(event) =>
                  setStatement(event.target.value.slice(0, MAX_STATEMENT))
                }
                rows={8}
                placeholder={characterWorkshop.forge.statementPlaceholder}
                className="mt-3 w-full resize-y rounded-xl border border-studio-line bg-white px-4 py-3 text-sm leading-relaxed text-studio-ink outline-none transition-colors placeholder:text-studio-muted/70 focus:border-studio-iris"
              />
            </div>
          </div>

          {/* 03 — the character card, always in view */}
          <aside className="rounded-3xl border border-studio-line bg-studio-card p-7 shadow-lg lg:sticky lg:top-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-studio-muted">
              <span className="text-studio-iris">03</span> · meet them
            </p>
            <div className="mt-6 flex flex-col items-center text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-studio-iris to-studio-peach text-3xl font-bold text-white shadow-md">
                {(name.trim() || "?").slice(0, 1).toUpperCase()}
              </span>
              <p className="studio-display mt-4 min-h-[1.6em] text-2xl font-bold">
                {name.trim() || "Unnamed"}
              </p>
              {archetypeId && (
                <span className="mt-1 rounded-full bg-studio-iris-soft px-3 py-1 text-xs font-semibold text-studio-iris">
                  {archetypeTitle(archetypeId)}
                </span>
              )}
              <p className="mt-4 line-clamp-5 min-h-[3em] text-sm leading-relaxed text-studio-muted">
                {statement.trim() ||
                  "Their personality will appear here as you write it."}
              </p>
            </div>
            <button
              type="button"
              onClick={compile}
              disabled={!canCompile}
              className="mt-6 w-full rounded-full bg-studio-iris px-6 py-4 text-sm font-bold text-white shadow-md transition-all enabled:hover:-translate-y-0.5 enabled:hover:shadow-lg disabled:opacity-40"
            >
              {characterWorkshop.forge.compile} →
            </button>
            {!canCompile && (
              <p className="mt-3 text-center text-xs text-studio-muted">
                Add a name and at least 40 characters of personality.
              </p>
            )}
          </aside>
        </section>

        {/* saved characters */}
        <section className="pt-14">
          <h2 className="studio-display text-2xl font-bold">
            {characterWorkshop.forge.savedTitle}
          </h2>
          {saved.length === 0 ? (
            <p className="mt-3 text-sm leading-relaxed text-studio-muted">
              {characterWorkshop.forge.savedEmpty}
            </p>
          ) : (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {[...saved].reverse().map((character) => (
                <li
                  key={character.id}
                  className="flex flex-col rounded-3xl border border-studio-line bg-studio-card p-6 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-studio-iris to-studio-peach text-base font-bold text-white">
                      {character.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="studio-display truncate font-bold">
                        {character.name}
                      </p>
                      {archetypeTitle(character.archetypeId) && (
                        <p className="text-xs text-studio-muted">
                          {archetypeTitle(character.archetypeId)}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-2 flex-1 text-xs leading-relaxed text-studio-muted">
                    {character.statement}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setActive(character)}
                      className="rounded-full bg-studio-iris px-4 py-2 text-xs font-bold text-white transition-all hover:brightness-110"
                    >
                      talk to them
                    </button>
                    <button
                      type="button"
                      onClick={() => loadIntoStudio(character)}
                      className="rounded-full border border-studio-line px-4 py-2 text-xs font-semibold text-studio-muted transition-colors hover:border-studio-iris hover:text-studio-iris"
                    >
                      edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(character.id)}
                      className="rounded-full border border-studio-line px-4 py-2 text-xs font-semibold text-studio-muted transition-colors hover:border-red-300 hover:text-red-400"
                    >
                      delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
