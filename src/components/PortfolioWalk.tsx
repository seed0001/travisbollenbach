"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import { portfolioWalk } from "@/lib/content";
import WalkWorld, { type Interactable, type WorldHandle } from "./WalkWorld";

// Every panel is now an empty, numbered placeholder. Walk up to one to read
// its number, then it gets filled with real content later. Positions and
// accent colors are kept so the layout is ready — only the content is stripped.
type Panel = { n: number; side: -1 | 0 | 1; z: number; accent: string };

const PANELS: Panel[] = [
  { n: 1, side: -1, z: -8, accent: "#38bdf8" },
  { n: 2, side: 1, z: -8, accent: "#7dffa8" },
  { n: 3, side: -1, z: -22, accent: "#a78bfa" },
  { n: 4, side: 1, z: -22, accent: "#f78fb3" },
  { n: 5, side: -1, z: -36, accent: "#fcd34d" },
  { n: 6, side: 1, z: -36, accent: "#6ee7b7" },
  { n: 7, side: -1, z: -50, accent: "#5eead4" },
  { n: 8, side: 1, z: -50, accent: "#c4b5fd" },
  { n: 9, side: -1, z: -64, accent: "#fca5a5" },
  { n: 10, side: 1, z: -64, accent: "#66e0ff" },
  { n: 11, side: -1, z: -76, accent: "#ffd166" },
  { n: 12, side: 1, z: -76, accent: "#f0abfc" },
  { n: 13, side: 0, z: -86, accent: "#f43f5e" },
];

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

// A blank placeholder panel stamped with its big number and a dashed accent
// border, so you can walk up and say "fill panel 5".
function makeLabelTexture(n: number, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const pad = 24;
    ctx.fillStyle = "#0c1220";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dark panel
    roundRectPath(ctx, pad, pad, canvas.width - pad * 2, canvas.height - pad * 2, 28);
    ctx.fillStyle = "#0f1830";
    ctx.fill();

    // Dashed accent border → reads clearly as an empty slot.
    ctx.strokeStyle = accent;
    ctx.lineWidth = 6;
    ctx.setLineDash([20, 15]);
    roundRectPath(
      ctx,
      pad + 22,
      pad + 22,
      canvas.width - (pad + 22) * 2,
      canvas.height - (pad + 22) * 2,
      20,
    );
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = "center";
    ctx.fillStyle = accent;
    ctx.font = "800 40px Arial";
    ctx.fillText("PORTFOLIO PANEL", canvas.width / 2, 250);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 300px Arial";
    ctx.fillText(String(n).padStart(2, "0"), canvas.width / 2, 560);

    ctx.fillStyle = "#7f8ba6";
    ctx.font = "600 32px Arial";
    ctx.fillText("empty · ready for content", canvas.width / 2, 660);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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

type Overlay = { n: number; accent: string } | null;

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

    PANELS.forEach((panel, index) => {
      const accent = new THREE.Color(panel.accent);
      const x = panel.side * BOARD_X;

      const station = new THREE.Group();
      station.position.set(x, 0, panel.z);

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

      const texture = makeLabelTexture(panel.n, panel.accent);
      disposables.push(texture);

      // Two back-to-back faces so the number reads from either side as it turns.
      const contentMat = new THREE.MeshBasicMaterial({ map: texture });
      const front = new THREE.Mesh(cardGeo, contentMat);
      front.position.z = 0.06;
      pivot.add(front);
      const back = new THREE.Mesh(cardGeo, contentMat);
      back.position.z = -0.06;
      back.rotation.y = Math.PI;
      pivot.add(back);
      disposables.push(contentMat);

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

      // Walk-up interaction: names the panel by number so it's easy to point at.
      interactables.push({
        id: `panel-${panel.n}`,
        x: panel.side * 5,
        z: panel.z,
        radius: panel.side === 0 ? 9 : 4.6,
        accent: panel.accent,
        eyebrow: "portfolio panel",
        title: `Panel ${panel.n}`,
        blurb: "Empty — ready for content.",
        prompt: "Inspect",
        onInteract: () => setOverlay({ n: panel.n, accent: panel.accent }),
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
          positions[i * 3 + 1] += moteSpeed[i] * 0.016; // drift upward
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
          title: "Numbered panels",
          intro:
            "Every panel here is empty and numbered. Walk up to any one to read its number, then say which panel to fill and what goes on it.",
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

      {/* Inspect overlay — confirms which numbered panel you're at */}
      {overlay && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/12 bg-white p-8 text-center text-slate-900 md:p-10">
            <p
              className="text-xs font-bold uppercase tracking-[0.24em]"
              style={{ color: overlay.accent }}
            >
              portfolio panel
            </p>
            <h2 className="mt-2 text-6xl font-black tracking-tight">
              Panel {overlay.n}
            </h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              This panel is empty and ready for content. Tell me what to put on
              Panel {overlay.n} — text, an image, a link — and I&apos;ll build
              it.
            </p>
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

      {/* Crawler / screen-reader fallback */}
      <div className="sr-only">
        <h1>Portfolio panels</h1>
        {PANELS.map((p) => (
          <p key={p.n}>Panel {p.n} — empty, ready for content.</p>
        ))}
      </div>
    </>
  );
}
