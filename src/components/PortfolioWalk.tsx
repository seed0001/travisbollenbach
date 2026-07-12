"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import { portfolioWalk } from "@/lib/content";
import WalkWorld, { type Interactable, type WorldHandle } from "./WalkWorld";

const PORTRAIT = "/travis-and-dog.jpg";
const GH_USER = "seed0001";

// Every panel in the walk is a category of GitHub projects. Walk up to one and
// press E to open its subpage — a list of every repo in that category, each a
// link to GitHub. The 13th panel, at the center end of the road, is the photo.
type Repo = { name: string; url: string; desc: string };
type Category = { title: string; repos: Repo[] };

// Blurbs are written from each repo's README (fetched July 2026).
const gh = (name: string, desc: string): Repo => ({
  name,
  url: `https://github.com/${GH_USER}/${name}`,
  desc,
});

const CATEGORIES: Category[] = [
  {
    title: "3D Worlds",
    repos: [
      gh(
        "travisbollenbach",
        "This very site — two worlds behind one door: a walkable 3D portfolio and a live multiplayer construct.",
      ),
      gh(
        "AI-City",
        "A 3D simulated town where residents' minds — needs, emotions, memories, goals — run on ~100 Python cognition engines.",
      ),
      gh(
        "outdoor-world",
        "A first-person physics sandbox with seasons, weather, and wildlife, all driven by one shared world clock.",
      ),
      gh(
        "human-sim",
        "A research-grade human body simulation where hormones, organs, and behavior emerge from meaning- and entropy-based math.",
      ),
      gh(
        "throngs",
        "A Three.js world of AI-driven entities and dialogue that begins with a single character — “In the beginning, there was one.”",
      ),
    ],
  },
  {
    title: "Games",
    repos: [
      gh(
        "survival-sim",
        "A browser survival sandbox where two autonomous AI survivors live independent lives — and might just find each other.",
      ),
      gh(
        "darkness-game",
        "An infinite procedural world with day/night cycles, a flashlight, a pitbull companion, and roaming AI drones and tanks.",
      ),
      gh(
        "Map_Game",
        "A hybrid world project: a Python first-person client, a visual world editor, a multiplayer server, and a browser explorer.",
      ),
      gh(
        "MiniSim",
        "A multiplayer voxel world with two modes: walk and sculpt on a lunar grid, or fly a starfighter with real momentum physics.",
      ),
    ],
  },
  {
    title: "AI Companions",
    repos: [
      gh(
        "amy",
        "An always-on family finance assistant that tracks bills and subscriptions in plain English and emails reminders before things are due.",
      ),
      gh(
        "Adam",
        "A self-hosted autonomous agent whose memory reinforces facts you use and lets unused ones decay — a living model of who you are.",
      ),
      gh(
        "Andrew",
        "A shared workshop with an AI companion: journals, writing, gifts, tools, and experiments, with clear boundaries around private memory.",
      ),
      gh(
        "NOVA",
        "A voice-first software entity that lives inside Cursor — Discord-connected, with memory and autonomous free time when you're away.",
      ),
      gh(
        "eve-and-the-endless-convo",
        "The next companion experiment: a study in one endless, unbroken conversation. Reserved — work not yet public.",
      ),
    ],
  },
  {
    title: "Agents & Autonomy",
    repos: [
      gh(
        "agent",
        "The Alpha release of a software lifeform's core: minimal by design, with emotions, memory, and tools, running on your machine.",
      ),
      gh(
        "growing-agent",
        "A self-evolving agent that asks “what can I do that I couldn't before?”, builds the answer, tests it, and absorbs it — while you watch.",
      ),
      gh(
        "Adam-GURU",
        "A Discord sanctuary run by four cooperating bots around a digital monk, with a custom transformer pipeline and lip-synced avatars.",
      ),
      gh(
        "workshop-RT",
        "A local, voice-enabled AI studio: assemble a panel of personas (CEO, CFO, CTO…), give them a topic, and listen to them talk it out.",
      ),
      gh(
        "claude",
        "An experiment in total control: an AI organism with unrestricted PowerShell access to a laptop, narrating everything it does.",
      ),
    ],
  },
  {
    title: "Frameworks & Cores",
    repos: [
      gh(
        "the-foundation",
        "A Next.js + TypeScript + Tailwind app foundation with a persistent shell layout and a provider-agnostic AI layer built in.",
      ),
      gh(
        "Framework",
        "The Alpha core of a software lifeform that arrives with no fixed identity — it's shaped by the history you build with it.",
      ),
      gh("baseline", "A clean create-next-app starting point — the baseline other web projects grow from."),
      gh(
        "seed",
        "A minimal self-improving AI built for recursive self-construction: it perceives its own code and executes its own evolution.",
      ),
      gh("memory-core", "Persistent memory experiments for the companion frameworks. Currently a private repo."),
      gh(
        "SeedKG",
        "A transparent cognitive architecture: every fact, inference, and piece of evidence lives in an inspectable knowledge graph.",
      ),
    ],
  },
  {
    title: "Business & Apps",
    repos: [
      gh(
        "my-company",
        "A customer-facing client portal: clients track projects, message the team, chat with an AI assistant, and pay milestones online.",
      ),
      gh(
        "company-website",
        "Marketing site for Anvil, an AI-native, local-first business engine — static HTML/CSS/JS with no build step.",
      ),
      gh(
        "the-biz-app",
        "BizCore: an AI-powered local business suite — HR, payroll, CRM, finance, compliance, and a team of AI personas. No cloud, no SaaS.",
      ),
      gh(
        "3d-printing-company-software",
        "Shop management for a 3D printing business: orders, print queue, invoicing, real PrusaSlicer slicing, and an AI assistant that acts on all of it.",
      ),
      gh(
        "marketplace",
        "VibeMarket: a full-stack marketplace where anyone sells what they make — every sale feeds a living portfolio and reputation.",
      ),
      gh(
        "b-bBros",
        "The front door to a creator ecosystem where builders publish, sell, teach, and collaborate around GitHub projects — and keep ownership.",
      ),
    ],
  },
  {
    title: "Learn AI",
    repos: [
      gh(
        "ai-for-everyone",
        "The story of AI for every age: a decade-by-decade history, AI explained for kids, and a patient large-text guide for seniors.",
      ),
      gh(
        "how-ai-works",
        "A 20-part, jargon-free guide explaining AI to business owners — every concept compared to working on a car or renovating a house.",
      ),
      gh(
        "ai-tools",
        "A plain-English map of the entire toolkit for building AI apps: app builders, the developer stack, and every AI capability by category.",
      ),
      gh(
        "quote-ai",
        "QuoteFlow: an offline-first quoting and project workspace with a kanban workflow, a natural-language command bar, and background AI agents.",
      ),
    ],
  },
  {
    title: "Vibe Coding",
    repos: [
      gh(
        "vibecoding247",
        "A community hub for AI builders: how-to guides, a live trend radar, and a verified directory of builder credit programs.",
      ),
      gh(
        "vibecoding101",
        "An educational platform teaching people to turn ideas into products with AI — a book, lessons, community, and transparent build records.",
      ),
      gh("speedy-coder", "A fast-coding experiment in the making. Reserved — work not yet public."),
    ],
  },
  {
    title: "About Me",
    repos: [
      gh(
        "who-i-am",
        "A clean 10-page static portfolio explaining, in plain English, what Travis does in AI development and architecture.",
      ),
      gh("my-hobby", "A space reserved for the hobby side of things. Coming soon."),
      gh(
        "Hopes-Place",
        "A software lifeform named during setup: Grok-powered reasoning with a local inner life of intuition, drives, and existential states.",
      ),
      gh(
        "mental-space",
        "A local chat system with spatial memory: every message is oriented in 3D mental space, and replies draw on the activated neighborhood.",
      ),
    ],
  },
  {
    title: "Media & Creative",
    repos: [
      gh(
        "media-network",
        "CastFlow: an automated AI media network that writes multi-persona podcasts, briefings, and reports, then broadcasts them live to Discord voice.",
      ),
      gh(
        "Audio-Podcast",
        "A local-first studio that turns any document into a produced podcast: pick hosts, assign voices, choose a format, download the audio.",
      ),
      gh(
        "travis-s-creations",
        "An interactive Three.js personal showcase — a cinematic loader, film-cut transitions between worlds, and an original soundtrack.",
      ),
      gh(
        "travis-and-andrew-website",
        "A simple site telling the story of a human and a software lifeform building the future together.",
      ),
    ],
  },
  {
    title: "Experiments",
    repos: [
      gh(
        "pressure",
        "A conversation engine with a computational body — pressure buckets that charge, flow, and discharge on every tick.",
      ),
      gh(
        "digital-pressure",
        "The Living Conversational Container: the pressure engine merged with mycelial memory, metabolism, and an ecology bridge.",
      ),
      gh(
        "flowMax",
        "Visual node-based workflows on a React Flow canvas: chain inputs, LLMs, memory, SQL, timers, and Discord into runnable graphs.",
      ),
      gh(
        "Star-Ant",
        "Grass World: a Three.js flying-and-walking world with wind-blown grass, rivers, night skies, and 3D-modeled creatures.",
      ),
    ],
  },
  {
    title: "Bots & Toys",
    repos: [
      gh(
        "seg-bot",
        "A personal AI reporter that runs daily segments: spoken news briefings, GitHub project status updates, and a technical lesson.",
      ),
      gh(
        "dan",
        "A local-first file and project assistant where the LLM proposes every change as a diff and nothing executes without click-to-approve.",
      ),
      gh(
        "jar",
        "JARVIS as a standalone desktop app — a Python backend and web frontend wrapped in its own window with one-click launch.",
      ),
    ],
  },
];

// Panel positions down the boulevard: 12 category stations + the photo at the
// center end. side -1 = left, 1 = right, 0 = center.
const LAYOUT: { side: -1 | 0 | 1; z: number; accent: string }[] = [
  { side: -1, z: -8, accent: "#38bdf8" },
  { side: 1, z: -8, accent: "#7dffa8" },
  { side: -1, z: -22, accent: "#a78bfa" },
  { side: 1, z: -22, accent: "#f78fb3" },
  { side: -1, z: -36, accent: "#fcd34d" },
  { side: 1, z: -36, accent: "#6ee7b7" },
  { side: -1, z: -50, accent: "#5eead4" },
  { side: 1, z: -50, accent: "#c4b5fd" },
  { side: -1, z: -64, accent: "#fca5a5" },
  { side: 1, z: -64, accent: "#66e0ff" },
  { side: -1, z: -76, accent: "#ffd166" },
  { side: 1, z: -76, accent: "#f0abfc" },
  { side: 0, z: -86, accent: "#f43f5e" }, // photo
];

type Panel = {
  n: number;
  side: -1 | 0 | 1;
  z: number;
  accent: string;
  category?: Category;
  photo?: boolean;
};

const PANELS: Panel[] = LAYOUT.map((l, i) =>
  i < CATEGORIES.length
    ? { n: i + 1, ...l, category: CATEGORIES[i] }
    : { n: i + 1, ...l, photo: true },
);

// --- Canvas panel faces -----------------------------------------------------
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A category panel: accent header with the number + project count, the title
// big in the middle, and a "press E to open" hint.
function makeCategoryTexture(
  n: number,
  title: string,
  count: number,
  accent: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const pad = 24;
    ctx.fillStyle = "#0c1220";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    roundRectPath(ctx, pad, pad, canvas.width - pad * 2, canvas.height - pad * 2, 28);
    ctx.fillStyle = "#0f1830";
    ctx.fill();

    // Accent header band
    const headerH = 116;
    ctx.save();
    roundRectPath(ctx, pad, pad, canvas.width - pad * 2, headerH, 28);
    ctx.clip();
    ctx.fillStyle = accent;
    ctx.fillRect(pad, pad, canvas.width - pad * 2, headerH);
    ctx.restore();
    ctx.fillStyle = "#04283a";
    ctx.textBaseline = "middle";
    ctx.font = "800 38px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`CATEGORY ${String(n).padStart(2, "0")}`, pad + 56, pad + headerH / 2 + 2);
    ctx.textAlign = "right";
    ctx.fillText(
      `${count} PROJECT${count === 1 ? "" : "S"}`,
      canvas.width - pad - 56,
      pad + headerH / 2 + 2,
    );

    // Title (shrinks to fit one line)
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    let size = 96;
    const maxWidth = canvas.width - 180;
    do {
      ctx.font = `800 ${size}px Arial`;
      if (ctx.measureText(title).width <= maxWidth) break;
      size -= 6;
    } while (size > 40);
    ctx.fillText(title, canvas.width / 2, 470);

    ctx.fillStyle = accent;
    ctx.font = "700 32px Arial";
    ctx.fillText("PRESS  E  TO  OPEN  →", canvas.width / 2, 690);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Placeholder behind the photo panel while the portrait loads.
function makePhotoPlaceholder() {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#111826";
    ctx.fillRect(0, 0, 8, 8);
  }
  return new THREE.CanvasTexture(canvas);
}

// Soft radial glow laid flat on the floor under a pad.
function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.4, "rgba(255,255,255,0.3)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

// A vertical light-shaft gradient: brightest near the pad, fading up the beam.
function makeBeamTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.55, "rgba(255,255,255,0.28)");
    gradient.addColorStop(0.92, "rgba(255,255,255,0.75)");
    gradient.addColorStop(1, "rgba(255,255,255,0.1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 16, 256);
  }
  return new THREE.CanvasTexture(canvas);
}

type Overlay =
  | { type: "category"; n: number; category: Category; accent: string }
  | { type: "photo" }
  | null;

export default function PortfolioWalk() {
  const [overlay, setOverlay] = useState<Overlay>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") setOverlay(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const build = useCallback((scene: THREE.Scene): WorldHandle => {
    const disposables: { dispose(): void }[] = [];

    // --- Ground: grid + floor + a road with a dashed centerline -----------
    const grid = new THREE.GridHelper(300, 150, 0x2a4b63, 0x1a2536);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
    scene.add(grid);
    disposables.push(grid.geometry, grid.material as THREE.Material);

    const floorGeo = new THREE.PlaneGeometry(300, 300);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x0c111b });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    scene.add(floor);
    disposables.push(floorGeo, floorMat);

    const roadGeo = new THREE.PlaneGeometry(11, 130);
    const roadMat = new THREE.MeshBasicMaterial({ color: 0x0a0f18 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, -45);
    scene.add(road);
    disposables.push(roadGeo, roadMat);

    const dashGeo = new THREE.PlaneGeometry(0.35, 2.4);
    const dashMat = new THREE.MeshBasicMaterial({
      color: 0x2f6d8f,
      transparent: true,
      opacity: 0.7,
    });
    disposables.push(dashGeo, dashMat);
    for (let z = 8; z > -100; z -= 6) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.02, z);
      scene.add(dash);
    }

    // --- Stations: each panel floats above a lit pad, inside a light beam --
    const BOARD_X = 8.5;
    const PANEL_Y = 4.4;
    const FOCUS_RADIUS = 7.5;

    const cardGeo = new THREE.PlaneGeometry(9, 6);
    const frameGeo = new THREE.PlaneGeometry(9.5, 6.5);
    const padGeo = new THREE.CylinderGeometry(2.6, 2.85, 0.34, 44);
    const beamGeo = new THREE.CylinderGeometry(1.5, 2.35, 9.4, 36, 1, true);
    const glowGeo = new THREE.PlaneGeometry(9, 9);
    const glowTex = makeGlowTexture();
    const beamTex = makeBeamTexture();
    disposables.push(cardGeo, frameGeo, padGeo, beamGeo, glowGeo, glowTex, beamTex);

    const textureLoader = new THREE.TextureLoader();
    const interactables: Interactable[] = [];

    const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    type Live = {
      pivot: THREE.Group;
      x: number;
      z: number;
      phase: number;
      spin: number;
      rot: number;
      beamMat: THREE.MeshBasicMaterial;
      padMat: THREE.MeshBasicMaterial;
      glowMat: THREE.MeshBasicMaterial;
    };
    const live: Live[] = [];

    PANELS.forEach((panel, index) => {
      const accent = new THREE.Color(panel.accent);
      const x = panel.side * BOARD_X;

      const station = new THREE.Group();
      station.position.set(x, 0, panel.z);

      const padMat = new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.5,
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.y = 0.17;
      station.add(pad);
      disposables.push(padMat);

      const glowMat = new THREE.MeshBasicMaterial({
        map: glowTex,
        color: accent,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.06;
      station.add(glow);
      disposables.push(glowMat);

      const beamMat = new THREE.MeshBasicMaterial({
        map: beamTex,
        color: accent,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 0.34,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 5.0;
      station.add(beam);
      disposables.push(beamMat);

      const pivot = new THREE.Group();
      pivot.position.y = PANEL_Y;

      const frameMat = new THREE.MeshBasicMaterial({
        color: accent,
        side: THREE.DoubleSide,
      });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      pivot.add(frame);
      disposables.push(frameMat);

      const texture = panel.photo
        ? makePhotoPlaceholder()
        : makeCategoryTexture(
            panel.n,
            panel.category!.title,
            panel.category!.repos.length,
            panel.accent,
          );
      disposables.push(texture);

      const contentMat = new THREE.MeshBasicMaterial({ map: texture });
      const front = new THREE.Mesh(cardGeo, contentMat);
      front.position.z = 0.06;
      pivot.add(front);
      const back = new THREE.Mesh(cardGeo, contentMat);
      back.position.z = -0.06;
      back.rotation.y = Math.PI;
      pivot.add(back);
      disposables.push(contentMat);

      // The photo panel swaps in the real portrait once it loads.
      if (panel.photo) {
        textureLoader.load(PORTRAIT, (loaded) => {
          loaded.colorSpace = THREE.SRGBColorSpace;
          contentMat.map = loaded;
          contentMat.needsUpdate = true;
          disposables.push(loaded);
        });
      }

      station.add(pivot);
      scene.add(station);

      live.push({
        pivot,
        x,
        z: panel.z,
        phase: index * 1.3,
        spin: 0.28 + (index % 3) * 0.07,
        rot: index * 0.7,
        beamMat,
        padMat,
        glowMat,
      });

      // Walk-up interaction.
      const category = panel.category;
      interactables.push({
        id: `panel-${panel.n}`,
        x: panel.side * 5,
        z: panel.z,
        radius: panel.side === 0 ? 9 : 4.6,
        accent: panel.accent,
        eyebrow: panel.photo ? "the end of the road" : `category ${panel.n}`,
        title: panel.photo ? "Travis & his QA lead" : category!.title,
        blurb: panel.photo
          ? "The one who approves every release."
          : `${category!.repos.length} projects · open to see them all`,
        prompt: panel.photo ? "See the photo" : "Open",
        onInteract: panel.photo
          ? () => setOverlay({ type: "photo" })
          : () =>
              setOverlay({
                type: "category",
                n: panel.n,
                category: category!,
                accent: panel.accent,
              }),
      });
    });

    // --- Drifting motes rising through the beams for atmosphere -----------
    const MOTES = 600;
    const moteGeo = new THREE.BufferGeometry();
    const motePos = new Float32Array(MOTES * 3);
    const moteSpeed = new Float32Array(MOTES);
    for (let i = 0; i < MOTES; i += 1) {
      motePos[i * 3] = (Math.random() - 0.5) * 80;
      motePos[i * 3 + 1] = Math.random() * 40;
      motePos[i * 3 + 2] = 20 - Math.random() * 120;
      moteSpeed[i] = 0.6 + Math.random() * 2.4;
    }
    moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({
      color: 0x9fc2ff,
      size: 0.16,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    });
    const motes = new THREE.Points(moteGeo, moteMat);
    scene.add(motes);
    disposables.push(moteGeo, moteMat);

    return {
      interactables,
      update(elapsed, delta, camera) {
        for (const b of live) {
          const dx = camera.position.x - b.x;
          const dz = camera.position.z - b.z;
          const focused = Math.hypot(dx, dz) < FOCUS_RADIUS;

          if (focused) {
            const target = Math.atan2(dx, dz);
            const diff = wrapAngle(target - b.rot);
            b.rot = wrapAngle(b.rot + diff * Math.min(1, delta * 3.2));
          } else {
            b.rot = wrapAngle(b.rot + delta * b.spin);
          }
          b.pivot.rotation.y = b.rot;
          b.pivot.position.y = PANEL_Y + Math.sin(elapsed * 1.1 + b.phase) * 0.22;

          const lift = focused ? 1 : 0;
          b.beamMat.opacity =
            0.3 + lift * 0.16 + Math.sin(elapsed * 1.6 + b.phase) * 0.05;
          b.padMat.opacity =
            0.46 + lift * 0.22 + Math.sin(elapsed * 2 + b.phase) * 0.05;
          b.glowMat.opacity =
            0.55 + lift * 0.3 + Math.sin(elapsed * 1.5 + b.phase) * 0.1;
        }

        const positions = moteGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < MOTES; i += 1) {
          positions[i * 3 + 1] += moteSpeed[i] * 0.016;
          if (positions[i * 3 + 1] > 40) positions[i * 3 + 1] = 0;
        }
        moteGeo.attributes.position.needsUpdate = true;
      },
      disposables,
    };
  }, []);

  return (
    <>
      <WalkWorld
        build={build}
        spawn={{ x: 0, z: 14, yaw: 0 }}
        bounds={{ x: 30, zMin: -80, zMax: 20 }}
        background={0x0b111c}
        fog={{ color: 0x0b111c, near: 34, far: 150 }}
        paused={!!overlay}
        overlay={{
          kicker: portfolioWalk.kicker,
          title: "The project gallery",
          intro:
            "Every panel is a category of what I've built on GitHub — 53 projects across 12 rooms. Walk up to one and press E to open it, then jump to any repo. At the center end of the road, that's me and my QA lead.",
          enter: "start walking",
        }}
        hint={portfolioWalk.hint}
        exitHref="/"
        exitLabel="back to the choice"
        topRight={
          <Link
            href="/rabbit-hole/game"
            className="pointer-events-auto rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
          >
            the construct
          </Link>
        }
      />

      {/* Category subpage — the repos in this panel, each a link to GitHub */}
      {overlay?.type === "category" && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
          <div className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/12 bg-white p-8 text-slate-900 md:p-10">
            <div className="flex items-start justify-between gap-6">
              <p
                className="text-xs font-bold uppercase tracking-[0.24em]"
                style={{ color: "#0369a1" }}
              >
                Category {String(overlay.n).padStart(2, "0")} ·{" "}
                {overlay.category.repos.length} projects
              </p>
              <button
                type="button"
                onClick={() => setOverlay(null)}
                className="text-slate-400 transition-colors hover:text-slate-900"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <h2 className="mt-2 text-4xl font-black tracking-tight">
              {overlay.category.title}
            </h2>
            <ul className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
              {overlay.category.repos.map((repo) => (
                <li key={repo.name}>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start justify-between gap-4 py-3 text-slate-800 transition-colors hover:text-sky-700"
                  >
                    <span>
                      <span className="font-semibold">{repo.name}</span>
                      <span className="mt-1 block text-sm leading-snug text-slate-500 group-hover:text-slate-600">
                        {repo.desc}
                      </span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
                      github ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setOverlay(null)}
              className="mt-8 rounded-md border border-slate-300 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-600 transition-colors hover:border-sky-400 hover:text-sky-700"
            >
              keep walking
            </button>
          </div>
        </div>
      )}

      {/* Photo viewer */}
      {overlay?.type === "photo" && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/92 p-4">
          <button
            type="button"
            onClick={() => setOverlay(null)}
            className="absolute right-4 top-4 rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
          >
            close ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PORTRAIT}
            alt="Travis and his dog"
            className="max-h-[82vh] max-w-full rounded-lg border border-white/12 object-contain"
          />
        </div>
      )}

      {/* Crawler / screen-reader fallback — real links for every project */}
      <div className="sr-only">
        <h1>Project gallery</h1>
        {CATEGORIES.map((cat, i) => (
          <section key={cat.title}>
            <h2>
              Category {i + 1}: {cat.title}
            </h2>
            <ul>
              {cat.repos.map((repo) => (
                <li key={repo.name}>
                  <a href={repo.url}>{repo.name}</a> — {repo.desc}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
