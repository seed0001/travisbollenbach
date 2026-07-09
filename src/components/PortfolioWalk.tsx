"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import {
  about,
  portfolioWalk,
  products,
  services,
  site,
  stats,
} from "@/lib/content";
import WalkWorld, { type Interactable, type WorldHandle } from "./WalkWorld";

const PORTRAIT = "/travis-and-dog.jpg";

// The readable payload behind a panel — the same data drives its in-world
// canvas texture and the "read it up close" overlay.
type Reader = {
  eyebrow: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  tags?: string[];
  footer?: string;
};

type Board =
  | {
      kind: "card" | "stats";
      side: -1 | 0 | 1;
      z: number;
      accent: string; // drives this station's pad, beam, frame, and glow
      reader: Reader;
      mailto?: string;
    }
  | {
      kind: "photo";
      side: -1 | 0 | 1;
      z: number;
      accent: string;
      alt: string;
    };

// --- Boards: laid out in stations down the boulevard ------------------------
const heroReader: Reader = {
  eyebrow: portfolioWalk.hero.eyebrow,
  title: portfolioWalk.hero.title,
  paragraphs: [portfolioWalk.hero.body],
};

const statsReader: Reader = {
  eyebrow: portfolioWalk.statsHeading,
  title: "A decade of shipping.",
};

const productReaders: Reader[] = products.map((p) => ({
  eyebrow: `${p.category} · ${p.year}`,
  title: p.title,
  paragraphs: [p.description],
  tags: p.tags,
  footer: `● ${p.status}`,
}));

const serviceReaders: Reader[] = services.map((s, i) => ({
  eyebrow: `${portfolioWalk.servicesHeading} · 0${i + 1}`,
  title: s.title,
  paragraphs: [s.description],
  bullets: s.points,
}));

const aboutReader: Reader = {
  eyebrow: about.storefront.eyebrow,
  title: about.storefront.title,
  paragraphs: about.storefront.paragraphs,
};

const contactReader: Reader = {
  eyebrow: portfolioWalk.contact.eyebrow,
  title: portfolioWalk.contact.title,
  paragraphs: [`${site.tagline} ${portfolioWalk.contact.body}`],
  footer: site.email,
};

const BOARDS: Board[] = [
  { kind: "card", side: -1, z: -8, accent: "#38bdf8", reader: heroReader },
  { kind: "stats", side: 1, z: -8, accent: "#7dffa8", reader: statsReader },
  { kind: "card", side: -1, z: -22, accent: "#a78bfa", reader: productReaders[0] },
  { kind: "card", side: 1, z: -22, accent: "#f78fb3", reader: productReaders[1] },
  { kind: "card", side: -1, z: -36, accent: "#fcd34d", reader: productReaders[2] },
  { kind: "card", side: 1, z: -36, accent: "#6ee7b7", reader: productReaders[3] },
  { kind: "card", side: -1, z: -50, accent: "#5eead4", reader: serviceReaders[0] },
  { kind: "card", side: 1, z: -50, accent: "#c4b5fd", reader: serviceReaders[1] },
  { kind: "card", side: -1, z: -64, accent: "#fca5a5", reader: serviceReaders[2] },
  { kind: "card", side: 1, z: -64, accent: "#66e0ff", reader: aboutReader },
  { kind: "photo", side: -1, z: -76, accent: "#ffd166", alt: about.photoAlt },
  {
    kind: "card",
    side: 1,
    z: -76,
    accent: "#f0abfc",
    reader: {
      eyebrow: "quality assurance",
      title: "He approves every release.",
      paragraphs: [about.storefront.paragraphs[1]],
    },
  },
  {
    kind: "card",
    side: 0,
    z: -86,
    accent: "#f43f5e",
    reader: contactReader,
    mailto: `mailto:${site.email}`,
  },
];

// --- Canvas cards -----------------------------------------------------------
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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  let cursor = y;
  for (const rawLine of text.split("\n")) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cursor);
        line = word;
        cursor += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, cursor);
      cursor += lineHeight;
    }
  }
  return cursor;
}

// A framed white gallery card with an accent header, wrapped body, bullets,
// tags, and a footer — rendered at high resolution so it reads while walking.
function makeCardTexture(reader: Reader, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const pad = 24;
    ctx.fillStyle = "#0c1220";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Card
    roundRectPath(ctx, pad, pad, canvas.width - pad * 2, canvas.height - pad * 2, 28);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    const left = pad + 56;
    const maxWidth = canvas.width - pad * 2 - 112;

    // Accent header band
    const headerH = 104;
    ctx.save();
    roundRectPath(ctx, pad, pad, canvas.width - pad * 2, headerH, 28);
    ctx.clip();
    ctx.fillStyle = accent;
    ctx.fillRect(pad, pad, canvas.width - pad * 2, headerH);
    ctx.restore();
    ctx.fillStyle = "#04283a";
    ctx.font = "800 40px Arial";
    ctx.textBaseline = "middle";
    ctx.fillText(reader.eyebrow.toUpperCase(), left, pad + headerH / 2 + 2);

    // Title
    let y = pad + headerH + 78;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#0b1324";
    ctx.font = "800 66px Arial";
    y = wrapText(ctx, reader.title, left, y, maxWidth, 74) + 22;

    // Body paragraphs
    ctx.fillStyle = "#42506a";
    ctx.font = "400 36px Arial";
    for (const paragraph of reader.paragraphs ?? []) {
      y = wrapText(ctx, paragraph, left, y, maxWidth, 48) + 18;
    }

    // Bullets
    if (reader.bullets?.length) {
      ctx.font = "500 34px Arial";
      for (const bullet of reader.bullets) {
        ctx.fillStyle = accent;
        ctx.fillText("—", left, y);
        ctx.fillStyle = "#42506a";
        y = wrapText(ctx, bullet, left + 44, y, maxWidth - 44, 46) + 8;
      }
    }

    // Tags
    if (reader.tags?.length) {
      let tx = left;
      const ty = canvas.height - pad - 110;
      ctx.font = "600 30px Arial";
      for (const tag of reader.tags) {
        const w = ctx.measureText(tag).width + 44;
        roundRectPath(ctx, tx, ty, w, 52, 26);
        ctx.fillStyle = "#eef4fb";
        ctx.fill();
        ctx.fillStyle = "#37506a";
        ctx.textBaseline = "middle";
        ctx.fillText(tag, tx + 22, ty + 27);
        ctx.textBaseline = "alphabetic";
        tx += w + 16;
      }
    }

    // Footer
    if (reader.footer) {
      ctx.fillStyle = accent;
      ctx.font = "700 34px Arial";
      ctx.fillText(reader.footer, left, canvas.height - pad - 44);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A stats card: four big value/label tiles in a 2×2 grid.
function makeStatsTexture(accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const pad = 24;
    ctx.fillStyle = "#0c1220";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    roundRectPath(ctx, pad, pad, canvas.width - pad * 2, canvas.height - pad * 2, 28);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    const left = pad + 56;
    ctx.fillStyle = "#0b1324";
    ctx.font = "800 52px Arial";
    ctx.fillText(portfolioWalk.statsHeading, left, pad + 110);

    const gridTop = 250;
    const cellW = (canvas.width - pad * 2 - 112) / 2;
    const cellH = 210;
    stats.forEach((stat, i) => {
      const cx = left + (i % 2) * cellW;
      const cy = gridTop + Math.floor(i / 2) * cellH;
      ctx.fillStyle = accent;
      ctx.font = "800 96px Arial";
      ctx.fillText(stat.value, cx, cy);
      ctx.fillStyle = "#42506a";
      ctx.font = "600 32px Arial";
      ctx.fillText(stat.label.toUpperCase(), cx, cy + 52);
    });
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The blank frame shown behind a photo panel while the image loads.
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
    // canvas y=0 is the top of the beam, y=256 the base near the pad
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

type Overlay = { type: "reader"; reader: Reader } | { type: "photo" } | null;

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

    // --- Stations: each board floats above a lit pad, inside a light beam --
    const BOARD_X = 8.5;
    const PANEL_Y = 4.4; // hover height of the panel's center
    const FOCUS_RADIUS = 7.5; // within this, a panel stops spinning and faces you

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

    // A panel's rotation lerps toward facing you when you're near, and free-
    // spins otherwise. wrapAngle keeps the eased turn taking the short way.
    const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    type Live = {
      pivot: THREE.Group;
      x: number;
      z: number;
      phase: number;
      spin: number; // idle spin speed (rad/s)
      rot: number; // current rotation.y
      beamMat: THREE.MeshBasicMaterial;
      padMat: THREE.MeshBasicMaterial;
      glowMat: THREE.MeshBasicMaterial;
    };
    const live: Live[] = [];

    BOARDS.forEach((board, index) => {
      const accent = new THREE.Color(board.accent);
      const x = board.side * BOARD_X;

      const station = new THREE.Group();
      station.position.set(x, 0, board.z);

      // Glowing pedestal pad.
      const padMat = new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.5,
      });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.y = 0.17;
      station.add(pad);
      disposables.push(padMat);

      // Radial glow pooled on the floor under the pad.
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

      // The light beam: a translucent shaft rising from the pad, holding the
      // panel aloft.
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
      beam.position.y = 5.0; // base sits on the pad, top clears the panel
      station.add(beam);
      disposables.push(beamMat);

      // The panel itself — spins and floats on this pivot.
      const pivot = new THREE.Group();
      pivot.position.y = PANEL_Y;

      const frameMat = new THREE.MeshBasicMaterial({
        color: accent,
        side: THREE.DoubleSide,
      });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      pivot.add(frame);
      disposables.push(frameMat);

      let texture: THREE.Texture;
      if (board.kind === "stats") texture = makeStatsTexture(board.accent);
      else if (board.kind === "card")
        texture = makeCardTexture(board.reader, board.accent);
      else texture = makePhotoPlaceholder();
      disposables.push(texture);

      // Two back-to-back faces so the card reads correctly from either side
      // as it turns.
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
      if (board.kind === "photo") {
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
        z: board.z,
        phase: index * 1.3,
        spin: 0.28 + (index % 3) * 0.07,
        rot: index * 0.7,
        beamMat,
        padMat,
        glowMat,
      });

      // Walk-up interaction. The trigger sits out on the road in front of the
      // panel (not at the panel itself), so you activate it by stepping toward
      // that side — and the two panels sharing a station don't both fire.
      const interactable: Interactable = {
        id: `board-${board.z}-${board.side}`,
        x: board.side * 5,
        z: board.z,
        radius: board.side === 0 ? 9 : 4.6,
        accent: board.accent,
        eyebrow:
          board.kind === "photo"
            ? "the human behind the tools"
            : board.reader.eyebrow,
        title: board.kind === "photo" ? "Travis & his QA lead" : board.reader.title,
        blurb:
          board.kind === "photo"
            ? "The person who designs it, builds it, and answers the email."
            : undefined,
        prompt:
          board.kind === "photo"
            ? "See the photo"
            : board.mailto
              ? portfolioWalk.contact.cta
              : "Read it up close",
        onInteract:
          board.kind === "photo"
            ? () => setOverlay({ type: "photo" })
            : board.mailto
              ? () => {
                  window.location.href = board.mailto as string;
                }
              : () => setOverlay({ type: "reader", reader: board.reader }),
      };
      interactables.push(interactable);
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
            // Ease around to face the visitor and hold.
            const target = Math.atan2(dx, dz);
            const diff = wrapAngle(target - b.rot);
            b.rot = wrapAngle(b.rot + diff * Math.min(1, delta * 3.2));
          } else {
            // Idle: keep turning slowly on the beam.
            b.rot = wrapAngle(b.rot + delta * b.spin);
          }
          b.pivot.rotation.y = b.rot;
          b.pivot.position.y = PANEL_Y + Math.sin(elapsed * 1.1 + b.phase) * 0.22;

          // Brighten the pad, glow, and beam when a visitor is present.
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
          positions[i * 3 + 1] += moteSpeed[i] * 0.016; // drift upward, tractor-beam style
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
          title: portfolioWalk.title,
          intro: portfolioWalk.intro,
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

      {/* Read-it-up-close overlay */}
      {overlay?.type === "reader" && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
          <div className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/12 bg-white p-8 text-slate-900 md:p-10">
            <div className="flex items-start justify-between gap-6">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-600">
                {overlay.reader.eyebrow}
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
            <h2 className="mt-3 whitespace-pre-line text-3xl font-black tracking-tight">
              {overlay.reader.title}
            </h2>
            {overlay.reader.paragraphs?.map((paragraph) => (
              <p
                key={paragraph.slice(0, 24)}
                className="mt-4 leading-relaxed text-slate-600"
              >
                {paragraph}
              </p>
            ))}
            {overlay.reader.bullets && (
              <ul className="mt-5 space-y-2 border-t border-slate-200 pt-5">
                {overlay.reader.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-3 text-slate-600">
                    <span className="text-sky-600">—</span>
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
            {overlay.reader.tags && (
              <div className="mt-6 flex flex-wrap gap-2">
                {overlay.reader.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {overlay.reader.footer && (
              <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-sky-600">
                {overlay.reader.footer}
              </p>
            )}
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
            alt={about.photoAlt}
            className="max-h-[82vh] max-w-full rounded-lg border border-white/12 object-contain"
          />
        </div>
      )}

      {/* Crawler / screen-reader fallback — the walk is canvas, so mirror the
          content as real text off-screen. */}
      <div className="sr-only">
        <h1>{portfolioWalk.hero.title}</h1>
        <p>{portfolioWalk.hero.body}</p>
        <h2>{portfolioWalk.productsHeading}</h2>
        {products.map((product) => (
          <section key={product.title}>
            <h3>{product.title}</h3>
            <p>{product.description}</p>
          </section>
        ))}
        <h2>{portfolioWalk.servicesHeading}</h2>
        {services.map((service) => (
          <section key={service.title}>
            <h3>{service.title}</h3>
            <p>{service.description}</p>
            <ul>
              {service.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
        ))}
        <h2>{about.storefront.title}</h2>
        {about.storefront.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
        <h2>{portfolioWalk.contact.title}</h2>
        <p>{portfolioWalk.contact.body}</p>
        <a href={`mailto:${site.email}`}>{site.email}</a>
      </div>
    </>
  );
}
