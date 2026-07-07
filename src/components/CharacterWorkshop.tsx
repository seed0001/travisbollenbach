"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import MatrixRain from "@/components/MatrixRain";
import Reveal from "@/components/Reveal";
import { archetypes, characterWorkshop } from "@/lib/content";
import {
  GLYPHS,
  createGlyphMaterial,
  makeGlyphAtlas,
  updateGlyphScale,
} from "@/lib/glyphs";

const STORAGE_KEY = "tb_characters";
const SWARM_COUNT = 420;
const MAX_STATEMENT = 2000;

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

// localStorage-backed store for compiled characters (useSyncExternalStore)
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

// --- The chamber: a 3D room where the compiled character manifests ----------

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
    { role: "system", text: `${character.name} compiled. ${characterWorkshop.chamber.hint}.` },
  ]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const voiceRef = useRef(false);

  const setMood = (mood: EntityMood) => {
    moodRef.current = mood;
  };

  // keep the log pinned to the latest message
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
      utterance.pitch = 0.8;
      utterance.rate = 0.95;
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
        setEntries((current) => [
          ...current,
          { role: "system", text: characterWorkshop.chamber.offline },
        ]);
        setMood("idle");
      } else {
        setEntries((current) => [
          ...current,
          {
            role: "system",
            text: data?.error ?? "Signal lost. Try again.",
          },
        ]);
        setMood("idle");
      }
    } catch {
      setEntries((current) => [
        ...current,
        { role: "system", text: "Signal lost. Try again." },
      ]);
      setMood("idle");
    } finally {
      setWaiting(false);
    }
  };

  // --- Scene -----------------------------------------------------------------
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 10, 60);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );
    camera.position.set(0, 2.0, 7.5);
    camera.lookAt(0, 2.2, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

    const disposables: { dispose(): void }[] = [];

    // floor grid, same dialect as the construct
    const grid = new THREE.GridHelper(120, 60, 0x00ff66, 0x043017);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.45;
    scene.add(grid);
    disposables.push(grid.geometry, grid.material as THREE.Material);

    // --- the entity ----------------------------------------------------------
    const entity = new THREE.Group();
    entity.position.set(0, 2.2, 0);
    scene.add(entity);

    const shellGeometry = new THREE.IcosahedronGeometry(1, 1);
    const shellMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
    const shell = new THREE.Mesh(shellGeometry, shellMaterial);
    entity.add(shell);
    disposables.push(shellGeometry, shellMaterial);

    const coreGeometry = new THREE.IcosahedronGeometry(0.5, 2);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      transparent: true,
      opacity: 0.22,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    entity.add(core);
    disposables.push(coreGeometry, coreMaterial);

    // soft halo behind the core — cheap glow without postprocessing
    const haloCanvas = document.createElement("canvas");
    haloCanvas.width = haloCanvas.height = 128;
    const haloCtx = haloCanvas.getContext("2d");
    if (haloCtx) {
      const gradient = haloCtx.createRadialGradient(64, 64, 4, 64, 64, 64);
      gradient.addColorStop(0, "rgba(0,255,102,0.55)");
      gradient.addColorStop(0.5, "rgba(0,255,102,0.12)");
      gradient.addColorStop(1, "rgba(0,255,102,0)");
      haloCtx.fillStyle = gradient;
      haloCtx.fillRect(0, 0, 128, 128);
    }
    const haloTexture = new THREE.CanvasTexture(haloCanvas);
    const haloMaterial = new THREE.SpriteMaterial({
      map: haloTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Sprite(haloMaterial);
    halo.scale.set(6, 6, 1);
    entity.add(halo);
    disposables.push(haloTexture, haloMaterial);

    // orbiting glyph swarm — the character's "thoughts"
    const swarmGeometry = new THREE.BufferGeometry();
    const swarmPositions = new Float32Array(SWARM_COUNT * 3);
    const swarmGlyphs = new Float32Array(SWARM_COUNT);
    const swarmSeeds = new Float32Array(SWARM_COUNT);
    const orbits = new Array(SWARM_COUNT).fill(0).map(() => ({
      theta: Math.random() * Math.PI * 2,
      phi: Math.acos(2 * Math.random() - 1),
      radius: 1.7 + Math.random() * 1.1,
      speed: 0.25 + Math.random() * 0.6,
      wobble: Math.random() * Math.PI * 2,
    }));
    for (let i = 0; i < SWARM_COUNT; i += 1) {
      swarmGlyphs[i] = Math.floor(Math.random() * GLYPHS.length);
      swarmSeeds[i] = Math.random();
    }
    swarmGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(swarmPositions, 3),
    );
    swarmGeometry.setAttribute(
      "glyph",
      new THREE.BufferAttribute(swarmGlyphs, 1),
    );
    swarmGeometry.setAttribute(
      "seed",
      new THREE.BufferAttribute(swarmSeeds, 1),
    );

    const atlas = makeGlyphAtlas();
    const swarmMaterial = createGlyphMaterial({
      atlas,
      size: 0.16,
      sizeJitter: 0.12,
      fadeNear: 40,
      fadeFar: 120,
      alpha: 1,
    });
    const swarm = new THREE.Points(swarmGeometry, swarmMaterial);
    entity.add(swarm);
    disposables.push(swarmGeometry, swarmMaterial, atlas);
    updateGlyphScale(swarmMaterial, renderer);

    // sparse ambient rain far behind the entity, for depth
    const rainGeometry = new THREE.BufferGeometry();
    const RAIN = 500;
    const rainPositions = new Float32Array(RAIN * 3);
    const rainGlyphs = new Float32Array(RAIN);
    const rainSeeds = new Float32Array(RAIN);
    const rainSpeeds = new Float32Array(RAIN);
    for (let i = 0; i < RAIN; i += 1) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 90;
      rainPositions[i * 3 + 1] = Math.random() * 30;
      rainPositions[i * 3 + 2] = -15 - Math.random() * 40;
      rainGlyphs[i] = Math.floor(Math.random() * GLYPHS.length);
      rainSeeds[i] = Math.random();
      rainSpeeds[i] = 1.5 + Math.random() * 4;
    }
    rainGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(rainPositions, 3),
    );
    rainGeometry.setAttribute("glyph", new THREE.BufferAttribute(rainGlyphs, 1));
    rainGeometry.setAttribute("seed", new THREE.BufferAttribute(rainSeeds, 1));
    const rainMaterial = createGlyphMaterial({
      atlas,
      size: 0.35,
      sizeJitter: 0.25,
      fadeNear: 12,
      fadeFar: 60,
      alpha: 0.6,
    });
    const rain = new THREE.Points(rainGeometry, rainMaterial);
    scene.add(rain);
    disposables.push(rainGeometry, rainMaterial);
    updateGlyphScale(rainMaterial, renderer);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      updateGlyphScale(swarmMaterial, renderer);
      updateGlyphScale(rainMaterial, renderer);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let animationFrame = 0;
    // smoothed mood parameters so state changes glide instead of snapping
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

      const targetRadius = mood === "thinking" ? 0.62 : mood === "speaking" ? 1.15 : 1;
      const targetSpin = mood === "thinking" ? 4.5 : mood === "speaking" ? 1.8 : 1;
      radiusScale += (targetRadius - radiusScale) * Math.min(1, delta * 4);
      spin += (targetSpin - spin) * Math.min(1, delta * 4);

      // core breath / speech pulse
      const pulse =
        mood === "speaking"
          ? 1 + Math.sin(elapsed * 14) * 0.1 + Math.sin(elapsed * 31) * 0.05
          : 1 + Math.sin(elapsed * 1.7) * 0.04;
      shell.scale.setScalar(pulse);
      core.scale.setScalar(pulse * (mood === "thinking" ? 0.8 : 1));
      halo.scale.setScalar(6 * pulse * (mood === "speaking" ? 1.15 : 1));
      shell.rotation.y += delta * 0.3 * spin;
      shell.rotation.x += delta * 0.11 * spin;
      core.rotation.y -= delta * 0.5 * spin;

      // orbit the glyph swarm
      const positions = swarmGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < SWARM_COUNT; i += 1) {
        const orbit = orbits[i];
        orbit.theta += delta * orbit.speed * spin;
        const wobble = Math.sin(elapsed * 0.8 + orbit.wobble) * 0.18;
        const radius = (orbit.radius + wobble) * radiusScale;
        positions[i * 3] = radius * Math.sin(orbit.phi) * Math.cos(orbit.theta);
        positions[i * 3 + 1] = radius * Math.cos(orbit.phi) * 0.82;
        positions[i * 3 + 2] = radius * Math.sin(orbit.phi) * Math.sin(orbit.theta);
      }
      swarmGeometry.attributes.position.needsUpdate = true;
      swarmMaterial.uniforms.uTime.value = elapsed;

      // ambient rain
      const rainArr = rainGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < RAIN; i += 1) {
        rainArr[i * 3 + 1] -= rainSpeeds[i] * delta;
        if (rainArr[i * 3 + 1] < 0) rainArr[i * 3 + 1] = 30;
      }
      rainGeometry.attributes.position.needsUpdate = true;
      rainMaterial.uniforms.uTime.value = elapsed;

      // slow camera drift, like the room itself is breathing
      camera.position.x = Math.sin(elapsed * 0.12) * 0.6;
      camera.position.y = 2.0 + Math.sin(elapsed * 0.4) * 0.08;
      camera.lookAt(0, 2.2, 0);

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

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div ref={hostRef} className="stage-fixed" />

      {/* HUD */}
      <div className="absolute inset-0 z-10 flex flex-col">
        {/* top bar */}
        <div className="flex items-center justify-between p-4">
          <p className="glow-green text-xs uppercase tracking-[0.3em] text-matrix">
            {character.name}
          </p>
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
              className="rounded-full border border-matrix-dim px-4 py-2 text-xs uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
            >
              {voiceOn ? "voice on" : "voice off"}
            </button>
            <button
              type="button"
              onClick={onRecompile}
              className="rounded-full border border-matrix-dim px-4 py-2 text-xs uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
            >
              recompile
            </button>
            <Link
              href="/rabbit-hole"
              className="rounded-full border border-matrix-dim px-4 py-2 text-xs uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
            >
              jack out
            </Link>
          </div>
        </div>

        <div className="flex-1" />

        {/* conversation */}
        <div className="mx-auto w-full max-w-2xl px-4 pb-4">
          <div
            ref={logRef}
            className="max-h-[38svh] space-y-3 overflow-y-auto rounded-2xl border border-line bg-black/70 p-4 backdrop-blur-sm"
          >
            {entries.map((entry, i) => (
              <div key={`${i}-${entry.text.slice(0, 16)}`}>
                {entry.role === "system" ? (
                  <p className="text-xs italic leading-relaxed text-ink-dim">
                    {entry.text}
                  </p>
                ) : (
                  <p className="text-sm leading-relaxed">
                    <span
                      className={
                        entry.role === "assistant"
                          ? "glow-green font-bold text-matrix"
                          : "font-bold text-ink-soft"
                      }
                    >
                      {entry.role === "assistant" ? character.name : "you"}
                      {": "}
                    </span>
                    <span
                      className={
                        entry.role === "assistant"
                          ? "text-ink"
                          : "text-ink-soft"
                      }
                    >
                      {entry.text}
                    </span>
                  </p>
                )}
              </div>
            ))}
            {waiting && (
              <p className="glow-green animate-pulse text-sm text-matrix">
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
              className="min-w-0 flex-1 rounded-full border border-matrix-dim bg-black/80 px-5 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-matrix"
            />
            <button
              type="submit"
              disabled={waiting || !draft.trim()}
              className="rounded-full border border-matrix px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-matrix transition-colors enabled:hover:bg-matrix enabled:hover:text-black disabled:opacity-40"
            >
              send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- The forge: craft the persona -------------------------------------------

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

  const loadIntoForge = (character: SavedCharacter) => {
    setName(character.name);
    setArchetypeId(character.archetypeId);
    setStatement(character.statement);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (active) {
    return <Chamber character={active} onRecompile={() => setActive(null)} />;
  }

  return (
    <main className="scanlines relative min-h-svh text-ink">
      <MatrixRain intensity={0.3} />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-void/80" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 pb-28">
        <header className="flex items-center justify-between py-6">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-ink transition-colors hover:text-matrix"
          >
            Travis<span className="text-matrix">.</span>Bollenbach
          </Link>
          <Link
            href="/rabbit-hole"
            className="text-xs uppercase tracking-[0.25em] text-ink-dim transition-colors hover:text-matrix"
          >
            ← back to the rabbit hole
          </Link>
        </header>

        {/* Hero */}
        <section className="pb-12 pt-12 md:pt-20">
          <Reveal>
            <p className="glow-green mb-4 text-xs uppercase tracking-[0.35em] text-matrix">
              {characterWorkshop.eyebrow}
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Write a mind
              <span className="glow-green block text-matrix">into being.</span>
            </h1>
            <p className="mt-6 max-w-2xl leading-relaxed text-ink-soft">
              {characterWorkshop.intro}
            </p>
          </Reveal>
        </section>

        {/* Forge */}
        <section>
          <Reveal>
            <div className="rounded-3xl border border-line bg-surface/70 p-8 backdrop-blur-sm md:p-10">
              {/* designation */}
              <label
                htmlFor="designation"
                className="block text-xs uppercase tracking-[0.3em] text-ink-dim"
              >
                {characterWorkshop.forge.nameLabel}
              </label>
              <input
                id="designation"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={60}
                placeholder={characterWorkshop.forge.namePlaceholder}
                className="mt-3 w-full rounded-xl border border-line bg-black/60 px-4 py-3 text-lg text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-matrix"
              />

              {/* archetype */}
              <p className="mt-8 text-xs uppercase tracking-[0.3em] text-ink-dim">
                {characterWorkshop.forge.archetypeLabel}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {archetypes.map((archetype) => (
                  <button
                    key={archetype.id}
                    type="button"
                    onClick={() => pickArchetype(archetype.id)}
                    className={`rounded-2xl border p-4 text-left transition-colors ${
                      archetypeId === archetype.id
                        ? "border-matrix bg-matrix-dark/50"
                        : "border-line bg-black/40 hover:border-matrix-dim"
                    }`}
                  >
                    <p
                      className={`font-bold ${
                        archetypeId === archetype.id
                          ? "glow-green text-matrix"
                          : "text-ink"
                      }`}
                    >
                      {archetype.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-dim">
                      {archetype.tagline}
                    </p>
                  </button>
                ))}
              </div>

              {/* persona statement */}
              <div className="mt-8 flex items-baseline justify-between gap-4">
                <label
                  htmlFor="statement"
                  className="block text-xs uppercase tracking-[0.3em] text-ink-dim"
                >
                  {characterWorkshop.forge.statementLabel}
                </label>
                <span className="text-xs text-ink-dim">
                  {statement.length}/{MAX_STATEMENT}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-dim">
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
                className="mt-3 w-full resize-y rounded-xl border border-line bg-black/60 px-4 py-3 text-sm leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-matrix"
              />

              <button
                type="button"
                onClick={compile}
                disabled={!canCompile}
                className="mt-6 w-full rounded-full border border-matrix px-8 py-4 font-bold uppercase tracking-widest text-matrix transition-all enabled:hover:bg-matrix enabled:hover:text-void disabled:opacity-40 md:w-auto"
              >
                {characterWorkshop.forge.compile} →
              </button>
              {!canCompile && (
                <p className="mt-3 text-xs text-ink-dim">
                  A designation and a persona statement of at least 40
                  characters are required.
                </p>
              )}
            </div>
          </Reveal>
        </section>

        {/* Saved characters */}
        <section className="pt-12">
          <Reveal>
            <h2 className="text-xs uppercase tracking-[0.3em] text-ink-dim">
              {characterWorkshop.forge.savedTitle}
            </h2>
            {saved.length === 0 ? (
              <p className="mt-4 text-sm leading-relaxed text-ink-dim">
                {characterWorkshop.forge.savedEmpty}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {[...saved].reverse().map((character) => (
                  <li
                    key={character.id}
                    className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/70 p-5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="glow-green font-bold text-matrix">
                        {character.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-ink-dim">
                        {character.statement}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => setActive(character)}
                        className="rounded-full border border-matrix px-4 py-2 text-xs uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-void"
                      >
                        enter chamber
                      </button>
                      <button
                        type="button"
                        onClick={() => loadIntoForge(character)}
                        className="rounded-full border border-line px-4 py-2 text-xs uppercase tracking-[0.2em] text-ink-soft transition-colors hover:border-matrix-dim hover:text-matrix"
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(character.id)}
                        className="rounded-full border border-line px-4 py-2 text-xs uppercase tracking-[0.2em] text-ink-dim transition-colors hover:border-pill-red hover:text-pill-red"
                      >
                        delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        </section>
      </div>
    </main>
  );
}
