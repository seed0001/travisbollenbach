"use client";

import { useCallback, useEffect, useState } from "react";
import * as THREE from "three";
import { veruthia, type VeruthiaStation } from "@/lib/content";
import WalkWorld, { type Interactable, type WorldHandle } from "./WalkWorld";

// The Ops Floor — a showcase room for Veruthia Consulting, the firm that
// audited this site. Six service modules line the floor, the case file about
// this site stands at the center end, and the big board at the back opens
// veruthia.com. Layout and station styling follow PortfolioWalk.

// Per-station accents: a cool ops-room family, with the security module in
// green and the case file in gold so they read as the special ones.
const STATION_ACCENTS = [
  "#22d3ee",
  "#38bdf8",
  "#7dd3fc",
  "#67e8f9",
  "#a5b4fc",
  "#7dffa8",
];
const CASE_ACCENT = "#ffd166";

const LAYOUT: { side: -1 | 1; z: number }[] = [
  { side: -1, z: -10 },
  { side: 1, z: -10 },
  { side: -1, z: -22 },
  { side: 1, z: -22 },
  { side: -1, z: -34 },
  { side: 1, z: -34 },
];

// --- Canvas textures --------------------------------------------------------
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

// A module panel: accent header with its number, the title big in the middle,
// the tagline under it, and a "press E" hint.
function makeStationTexture(
  header: string,
  title: string,
  tagline: string,
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
    ctx.fillText(header, pad + 56, pad + headerH / 2 + 2);
    ctx.textAlign = "right";
    ctx.fillText("VERUTHIA", canvas.width - pad - 56, pad + headerH / 2 + 2);

    // Title (shrinks to fit one line)
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    let size = 88;
    const maxWidth = canvas.width - 180;
    do {
      ctx.font = `800 ${size}px Arial`;
      if (ctx.measureText(title).width <= maxWidth) break;
      size -= 6;
    } while (size > 40);
    ctx.fillText(title, canvas.width / 2, 430);

    ctx.fillStyle = "#9fb6d8";
    let tagSize = 40;
    do {
      ctx.font = `600 ${tagSize}px Arial`;
      if (ctx.measureText(tagline).width <= maxWidth) break;
      tagSize -= 3;
    } while (tagSize > 24);
    ctx.fillText(tagline, canvas.width / 2, 530);

    ctx.fillStyle = accent;
    ctx.font = "700 32px Arial";
    ctx.fillText("PRESS  E  TO  OPEN  →", canvas.width / 2, 690);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The big board at the back shows the Veruthia Consulting logo image
// (public/veruthia-logo.png, 1969x799 — its aspect sets the board's shape).
const BOARD_IMAGE = "/veruthia-logo.png";
const BOARD_IMAGE_RATIO = 799 / 1969;

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

type Overlay = {
  station: VeruthiaStation;
  header: string;
  accent: string;
} | null;

export default function VeruthiaRoom() {
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

    // --- Ground: grid + floor + a center aisle -----------------------------
    const grid = new THREE.GridHelper(300, 150, 0x1d5d6b, 0x14202e);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
    scene.add(grid);
    disposables.push(grid.geometry, grid.material as THREE.Material);

    const floorGeo = new THREE.PlaneGeometry(300, 300);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x0b111b });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    scene.add(floor);
    disposables.push(floorGeo, floorMat);

    const aisleGeo = new THREE.PlaneGeometry(11, 80);
    const aisleMat = new THREE.MeshBasicMaterial({ color: 0x0a0f18 });
    const aisle = new THREE.Mesh(aisleGeo, aisleMat);
    aisle.rotation.x = -Math.PI / 2;
    aisle.position.set(0, 0.01, -22);
    scene.add(aisle);
    disposables.push(aisleGeo, aisleMat);

    const dashGeo = new THREE.PlaneGeometry(0.35, 2.4);
    const dashMat = new THREE.MeshBasicMaterial({
      color: 0x1d7f96,
      transparent: true,
      opacity: 0.7,
    });
    disposables.push(dashGeo, dashMat);
    for (let z = 8; z > -56; z -= 6) {
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

    type PanelSpec = {
      station: VeruthiaStation;
      header: string;
      accent: string;
      x: number;
      z: number;
      radius: number;
      eyebrow: string;
    };

    const panels: PanelSpec[] = veruthia.stations.map((station, i) => ({
      station,
      header: `MODULE ${String(i + 1).padStart(2, "0")}`,
      accent: STATION_ACCENTS[i % STATION_ACCENTS.length],
      x: LAYOUT[i].side * BOARD_X,
      z: LAYOUT[i].z,
      radius: 4.6,
      eyebrow: `module ${String(i + 1).padStart(2, "0")}`,
    }));
    panels.push({
      station: veruthia.caseFile,
      header: "CASE FILE",
      accent: CASE_ACCENT,
      x: 0,
      z: -46,
      radius: 7,
      eyebrow: "the audit",
    });

    panels.forEach((panel, index) => {
      const accent = new THREE.Color(panel.accent);

      const station = new THREE.Group();
      station.position.set(panel.x, 0, panel.z);

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

      const texture = makeStationTexture(
        panel.header,
        panel.station.title,
        panel.station.tagline,
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

      station.add(pivot);
      scene.add(station);

      live.push({
        pivot,
        x: panel.x,
        z: panel.z,
        phase: index * 1.3,
        spin: 0.28 + (index % 3) * 0.07,
        rot: index * 0.7,
        beamMat,
        padMat,
        glowMat,
      });

      interactables.push({
        id: panel.station.id,
        x: panel.x === 0 ? 0 : Math.sign(panel.x) * 5,
        z: panel.z,
        radius: panel.radius,
        accent: panel.accent,
        eyebrow: panel.eyebrow,
        title: panel.station.title,
        blurb: panel.station.tagline,
        prompt: "Open",
        onInteract: () =>
          setOverlay({
            station: panel.station,
            header: panel.header,
            accent: panel.accent,
          }),
      });
    });

    // --- The board at the back: walk up to open veruthia.com ---------------
    const BOARD_Z = -58;
    const BOARD_Y = 9;
    const BOARD_W = 24;
    const BOARD_H = BOARD_W * BOARD_IMAGE_RATIO;

    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, 0, BOARD_Z);

    const boardFrameGeo = new THREE.BoxGeometry(BOARD_W + 1.6, BOARD_H + 1.8, 1.2);
    const boardFrameMat = new THREE.MeshBasicMaterial({ color: 0x0b1020 });
    const boardFrame = new THREE.Mesh(boardFrameGeo, boardFrameMat);
    boardFrame.position.set(0, BOARD_Y, -0.7);
    boardGroup.add(boardFrame);
    disposables.push(boardFrameGeo, boardFrameMat);

    // Dark face until the logo loads, then the image swaps in.
    const boardFaceGeo = new THREE.PlaneGeometry(BOARD_W, BOARD_H);
    const boardFaceMat = new THREE.MeshBasicMaterial({
      color: 0x0a0f1c,
      fog: false,
      toneMapped: false,
    });
    new THREE.TextureLoader().load(BOARD_IMAGE, (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      boardFaceMat.map = loaded;
      boardFaceMat.color.set(0xffffff);
      boardFaceMat.needsUpdate = true;
      disposables.push(loaded);
    });
    const boardFace = new THREE.Mesh(boardFaceGeo, boardFaceMat);
    boardFace.position.set(0, BOARD_Y, 0);
    boardGroup.add(boardFace);
    disposables.push(boardFaceGeo, boardFaceMat);

    const legGeo = new THREE.BoxGeometry(1.3, BOARD_Y - BOARD_H / 2 + 0.2, 1.3);
    const legMat = new THREE.MeshBasicMaterial({ color: 0x121a2a });
    for (const legX of [-8, 8]) {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(legX, (BOARD_Y - BOARD_H / 2) / 2, -0.7);
      boardGroup.add(leg);
    }
    disposables.push(legGeo, legMat);

    const boardGlowMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x22d3ee,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.5,
      fog: false,
    });
    const boardGlow = new THREE.Sprite(boardGlowMat);
    boardGlow.scale.set(42, 26, 1);
    boardGlow.position.set(0, BOARD_Y, -1.6);
    boardGroup.add(boardGlow);
    disposables.push(boardGlowMat);

    scene.add(boardGroup);

    interactables.push({
      id: "veruthia-site",
      x: 0,
      z: BOARD_Z + 6,
      radius: 6.5,
      accent: veruthia.accent,
      eyebrow: veruthia.board.placard.eyebrow,
      title: veruthia.board.placard.title,
      blurb: veruthia.board.placard.blurb,
      prompt: veruthia.board.placard.prompt,
      onInteract: () => window.open(veruthia.url, "_blank", "noopener"),
    });

    // --- Drifting motes rising through the beams for atmosphere -----------
    const MOTES = 500;
    const moteGeo = new THREE.BufferGeometry();
    const motePos = new Float32Array(MOTES * 3);
    const moteSpeed = new Float32Array(MOTES);
    for (let i = 0; i < MOTES; i += 1) {
      motePos[i * 3] = (Math.random() - 0.5) * 70;
      motePos[i * 3 + 1] = Math.random() * 36;
      motePos[i * 3 + 2] = 16 - Math.random() * 80;
      moteSpeed[i] = 0.6 + Math.random() * 2.4;
    }
    moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
    const moteMat = new THREE.PointsMaterial({
      color: 0x67e8f9,
      size: 0.16,
      transparent: true,
      opacity: 0.5,
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

        boardGlowMat.opacity = 0.42 + Math.sin(elapsed * 0.9) * 0.12;

        const positions = moteGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < MOTES; i += 1) {
          positions[i * 3 + 1] += moteSpeed[i] * 0.016;
          if (positions[i * 3 + 1] > 36) positions[i * 3 + 1] = 0;
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
        spawn={{ x: 0, z: 12, yaw: 0 }}
        bounds={{ x: 28, zMin: -52, zMax: 16 }}
        background={0x080e16}
        fog={{ color: 0x080e16, near: 30, far: 140 }}
        paused={!!overlay}
        overlay={{
          kicker: veruthia.kicker,
          title: veruthia.overlay.title,
          intro: veruthia.overlay.intro,
          enter: veruthia.overlay.enter,
        }}
        hint={veruthia.hint}
        exitHref="/"
        exitLabel="back to the gateway"
        topRight={
          <a
            href={veruthia.url}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
          >
            veruthia.com ↗
          </a>
        }
      />

      {/* Module reader — the station's full copy, dark ops-room card */}
      {overlay && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
          <div
            className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-[#0b1020]/97 p-8 backdrop-blur-sm md:p-10"
            style={{ borderColor: `${overlay.accent}55` }}
          >
            <div className="flex items-start justify-between gap-6">
              <p
                className="text-xs font-bold uppercase tracking-[0.24em]"
                style={{ color: overlay.accent }}
              >
                {overlay.header} · {veruthia.firm}
              </p>
              <button
                type="button"
                onClick={() => setOverlay(null)}
                className="text-ink-dim transition-colors hover:text-[#dbe5ff]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-[#dbe5ff] md:text-4xl">
              {overlay.station.title}
            </h2>
            <div className="mt-5 space-y-4">
              {overlay.station.body.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed text-ink-soft">
                  {paragraph}
                </p>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={veruthia.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
                style={{ borderColor: `${overlay.accent}99`, color: "#dbe5ff" }}
              >
                veruthia.com ↗
              </a>
              <a
                href={`mailto:${veruthia.email}`}
                className="rounded-md border border-white/15 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-white/40 hover:text-[#dbe5ff]"
              >
                {veruthia.email}
              </a>
              <button
                type="button"
                onClick={() => setOverlay(null)}
                className="ml-auto rounded-md border border-white/15 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft transition-colors hover:border-white/40 hover:text-[#dbe5ff]"
              >
                keep walking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crawler / screen-reader fallback */}
      <div className="sr-only">
        <h1>
          {veruthia.firm} — {veruthia.board.subtitle.toLowerCase()}
        </h1>
        <p>{veruthia.overlay.intro}</p>
        {[...veruthia.stations, veruthia.caseFile].map((station) => (
          <section key={station.id}>
            <h2>{station.title}</h2>
            <p>{station.tagline}</p>
            {station.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
        <p>
          <a href={veruthia.url}>veruthia.com</a> ·{" "}
          <a href={`mailto:${veruthia.email}`}>{veruthia.email}</a>
        </p>
      </div>
    </>
  );
}
