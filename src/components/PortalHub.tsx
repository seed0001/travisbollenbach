"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { hub } from "@/lib/content";
import WalkWorld, { type WorldHandle } from "./WalkWorld";

type HubStats = {
  onlineNow: number;
  hostOnline: boolean;
  members: number;
  visitorsToday: number;
  visitsToday: number;
  recentVisits: number;
};

const STATS_REFRESH_MS = 30000;
const statFormat = new Intl.NumberFormat("en-US");

// The giant scoreboard at the back of the hub: live site stats drawn onto a
// canvas texture, jumbotron-style. Returns the texture plus a redraw function
// so fresh numbers can be painted in without rebuilding the scene.
function makeScoreboardTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const draw = (stats: HubStats | null) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const num = (v: number | undefined) =>
      v === undefined ? "—" : statFormat.format(v);

    ctx.fillStyle = "#050810";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(143,179,255,0.045)";
    for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
    ctx.strokeStyle = "#8fb3ff";
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.strokeStyle = "rgba(143,179,255,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, W - 52, H - 52);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.shadowColor = "#8fb3ff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#8fb3ff";
    ctx.font = "900 40px Arial";
    ctx.fillText("L I V E   S I T E   T E L E M E T R Y", W / 2, 84);

    ctx.shadowColor = "#7dffa8";
    ctx.shadowBlur = 34;
    ctx.fillStyle = "#7dffa8";
    ctx.font = "900 170px Arial";
    ctx.fillText(num(stats?.onlineNow), W / 2, 240);
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#dbe5ff";
    ctx.font = "700 30px Arial";
    ctx.fillText("IN THE CONSTRUCT RIGHT NOW", W / 2, 352);

    const hostLabel =
      stats === null
        ? "CHECKING THE CONSTRUCT…"
        : stats.hostOnline
          ? "● TRAVIS IS IN THE CONSTRUCT"
          : "○ TRAVIS IS NOT INSIDE AT THE MOMENT";
    ctx.shadowColor = stats?.hostOnline ? "#7dffa8" : "#8fb3ff";
    ctx.shadowBlur = stats?.hostOnline ? 22 : 6;
    ctx.fillStyle = stats?.hostOnline ? "#7dffa8" : "rgba(219,229,255,0.55)";
    ctx.font = "800 30px Arial";
    ctx.fillText(hostLabel, W / 2, 418);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(143,179,255,0.4)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(70, 468);
    ctx.lineTo(W - 70, 468);
    ctx.stroke();

    const cells = [
      { label: "VISITORS TODAY", value: num(stats?.visitorsToday) },
      { label: "VISITS TODAY", value: num(stats?.visitsToday) },
      { label: "MEMBERS", value: num(stats?.members) },
      { label: "RECENT VISITS", value: num(stats?.recentVisits) },
    ];
    const cellWidth = (W - 140) / cells.length;
    cells.forEach((cell, i) => {
      const cx = 70 + cellWidth * i + cellWidth / 2;
      ctx.shadowColor = "#8fb3ff";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#dbe5ff";
      ctx.font = "900 72px Arial";
      ctx.fillText(cell.value, cx, 556);
      ctx.shadowBlur = 4;
      ctx.fillStyle = "rgba(143,179,255,0.8)";
      ctx.font = "700 22px Arial";
      ctx.fillText(cell.label, cx, 634);
    });

    texture.needsUpdate = true;
  };

  return { texture, draw };
}

// The lit sign that floats over each pill: its name + a one-line subtitle.
function makeSignTexture(title: string, subtitle: string, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 288;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 30;
    ctx.fillStyle = accent;
    ctx.font = "900 116px Arial";
    ctx.fillText(title.toUpperCase(), canvas.width / 2, 118, canvas.width - 60);

    ctx.shadowBlur = 10;
    ctx.fillStyle = "#dbe5ff";
    ctx.font = "600 44px Arial";
    ctx.fillText(subtitle, canvas.width / 2, 214, canvas.width - 70);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Soft radial glow behind each pill.
function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,0.85)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.28)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

type PillSpec = {
  label: string;
  subtitle: string;
  prompt: string;
  href: string;
  accent: string;
  side: -1 | 1; // -1 left (blue), +1 right (red)
};

export default function PortalHub() {
  const router = useRouter();

  // Live stats feed for the scoreboard. The scene assigns its redraw function
  // into redrawRef when it builds; the fetch loop paints fresh numbers in.
  const statsRef = useRef<HubStats | null>(null);
  const redrawRef = useRef<((stats: HubStats | null) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/stats", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as HubStats;
        if (cancelled) return;
        statsRef.current = data;
        redrawRef.current?.(data);
      } catch {
        // stats are decorative — stay quiet on failure
      }
    };

    load();
    const timer = setInterval(load, STATS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const build = useCallback(
    (scene: THREE.Scene): WorldHandle => {
      const disposables: { dispose(): void }[] = [];

      // --- Ground: grid + dark floor + a central runway --------------------
      const grid = new THREE.GridHelper(300, 150, 0x8fb3ff, 0x26324a);
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.5;
      scene.add(grid);
      disposables.push(grid.geometry, grid.material as THREE.Material);

      const floorGeo = new THREE.PlaneGeometry(300, 300);
      const floorMat = new THREE.MeshBasicMaterial({
        color: 0x10141d,
        transparent: true,
        opacity: 0.92,
      });
      const floor = new THREE.Mesh(floorGeo, floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.02;
      scene.add(floor);
      disposables.push(floorGeo, floorMat);

      const runwayGeo = new THREE.PlaneGeometry(7, 44);
      const runwayMat = new THREE.MeshBasicMaterial({
        color: 0x0b0e15,
        transparent: true,
        opacity: 0.9,
      });
      const runway = new THREE.Mesh(runwayGeo, runwayMat);
      runway.rotation.x = -Math.PI / 2;
      runway.position.set(0, 0.005, -6);
      scene.add(runway);
      disposables.push(runwayGeo, runwayMat);

      // --- The two pills ----------------------------------------------------
      const specs: PillSpec[] = [
        { ...hub.pills.blue, side: -1 },
        { ...hub.pills.red, side: 1 },
      ];

      const PILL_X = 11;
      const PILL_Z = -15;
      const PILL_Y = 3.2; // hover height of the pill's center

      // A glossy solid capsule, lit like a studio product shot (matches Pill3D).
      const capsuleGeo = new THREE.CapsuleGeometry(1.05, 2.5, 16, 32);
      const padGeo = new THREE.CylinderGeometry(3.4, 3.6, 0.4, 40);
      const glowTex = makeGlowTexture();
      const signGeo = new THREE.PlaneGeometry(7.4, 2.08);
      disposables.push(capsuleGeo, padGeo, glowTex, signGeo);

      const spinners: THREE.Group[] = [];
      const pillGroups: THREE.Group[] = [];
      const glowMats: { material: THREE.SpriteMaterial; phase: number }[] = [];
      const interactables: WorldHandle["interactables"] = [];

      for (const spec of specs) {
        const accent = new THREE.Color(spec.accent);
        const px = spec.side * PILL_X;
        const isBlue = spec.side < 0;
        const bodyColor = isBlue ? 0x0284c7 : 0xe11d48;
        const rimColor = isBlue ? 0x4dc3ff : 0xff4d6d;

        const anchor = new THREE.Group();
        anchor.position.set(px, 0, PILL_Z);
        anchor.rotation.y = spec.side * -0.2; // angle toward center

        // Glowing pedestal pad.
        const padMat = new THREE.MeshBasicMaterial({
          color: accent,
          transparent: true,
          opacity: 0.5,
        });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(0, 0.2, 0);
        anchor.add(pad);
        disposables.push(padMat);

        // The pill: a glossy clear-coated capsule, held at a slight angle,
        // idling in a slow spin and float.
        const bodyMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(bodyColor),
          roughness: 0.2,
          metalness: 0.05,
          clearcoat: 1,
          clearcoatRoughness: 0.12,
        });
        disposables.push(bodyMat);

        const pillGroup = new THREE.Group();
        pillGroup.position.set(0, PILL_Y, 0);
        pillGroup.rotation.z = -0.28; // held at a slight angle, like an open palm

        const spinner = new THREE.Group();
        const body = new THREE.Mesh(capsuleGeo, bodyMat);
        body.rotation.z = Math.PI / 2; // capsule lies horizontal
        spinner.add(body);
        pillGroup.add(spinner);
        anchor.add(pillGroup);
        spinners.push(spinner);
        pillGroups.push(pillGroup);

        // Accent rim light + a subtle matrix-green fill, straight from Pill3D.
        const rim = new THREE.PointLight(rimColor, 22, 18);
        rim.position.set(px - spec.side * 2.5, PILL_Y - 1, PILL_Z - 2.5);
        scene.add(rim);
        const fill = new THREE.PointLight(0x00ff66, 2.6, 10);
        fill.position.set(px, PILL_Y - 2.4, PILL_Z + 2);
        scene.add(fill);

        // Soft glow sprite behind the pill.
        const glowMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: accent,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.9,
        });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(9, 9, 1);
        glow.position.set(0, PILL_Y, -0.4);
        anchor.add(glow);
        disposables.push(glowMat);
        glowMats.push({ material: glowMat, phase: spec.side > 0 ? Math.PI : 0 });

        // Floating sign above the pill.
        const signTex = makeSignTexture(spec.label, spec.subtitle, spec.accent);
        const signMat = new THREE.MeshBasicMaterial({
          map: signTex,
          transparent: true,
        });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(0, PILL_Y + 4.2, 0);
        anchor.add(sign);
        disposables.push(signTex, signMat);

        scene.add(anchor);

        interactables.push({
          id: spec.href,
          x: px,
          z: PILL_Z + 3, // trigger a few metres in front of the pill
          radius: 7.5,
          accent: spec.accent,
          eyebrow: "the choice",
          title: spec.label,
          blurb: spec.subtitle,
          prompt: spec.prompt,
          onInteract: () => router.push(spec.href),
        });
      }

      // --- The scoreboard: live site stats, way at the back -----------------
      // Sits beyond the walkable bounds so it reads as a glowing backdrop.
      // Its materials ignore fog so it stays highlighted through the haze.
      const BOARD_Z = -56;
      const BOARD_Y = 11;
      const BOARD_W = 26;
      const BOARD_H = BOARD_W * (720 / 1280);

      const scoreboard = makeScoreboardTexture();
      scoreboard.draw(statsRef.current);
      redrawRef.current = scoreboard.draw;
      disposables.push(scoreboard.texture);

      const boardGroup = new THREE.Group();
      boardGroup.position.set(0, 0, BOARD_Z);

      const frameGeo = new THREE.BoxGeometry(BOARD_W + 1.6, BOARD_H + 1.8, 1.2);
      const frameMat = new THREE.MeshBasicMaterial({ color: 0x0b1020 });
      const frame = new THREE.Mesh(frameGeo, frameMat);
      frame.position.set(0, BOARD_Y, -0.7);
      boardGroup.add(frame);
      disposables.push(frameGeo, frameMat);

      const faceGeo = new THREE.PlaneGeometry(BOARD_W, BOARD_H);
      const faceMat = new THREE.MeshBasicMaterial({
        map: scoreboard.texture,
        fog: false,
        toneMapped: false,
      });
      const face = new THREE.Mesh(faceGeo, faceMat);
      face.position.set(0, BOARD_Y, 0);
      boardGroup.add(face);
      disposables.push(faceGeo, faceMat);

      const legGeo = new THREE.BoxGeometry(1.3, BOARD_Y - BOARD_H / 2 + 0.2, 1.3);
      const legMat = new THREE.MeshBasicMaterial({ color: 0x131a2b });
      for (const legX of [-9, 9]) {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(legX, (BOARD_Y - BOARD_H / 2) / 2, -0.7);
        boardGroup.add(leg);
      }
      disposables.push(legGeo, legMat);

      // Halo behind the board — the frame occludes its center, leaving a rim.
      const boardGlowMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: 0x8fb3ff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.55,
        fog: false,
      });
      const boardGlow = new THREE.Sprite(boardGlowMat);
      boardGlow.scale.set(46, 30, 1);
      boardGlow.position.set(0, BOARD_Y, -1.6);
      boardGroup.add(boardGlow);
      disposables.push(boardGlowMat);

      const boardLight = new THREE.PointLight(0x8fb3ff, 30, 40);
      boardLight.position.set(0, BOARD_Y - 2, BOARD_Z + 6);
      scene.add(boardLight);

      scene.add(boardGroup);

      // --- Drifting motes for depth ----------------------------------------
      const MOTES = 900;
      const moteGeo = new THREE.BufferGeometry();
      const motePos = new Float32Array(MOTES * 3);
      const moteSpeed = new Float32Array(MOTES);
      for (let i = 0; i < MOTES; i += 1) {
        motePos[i * 3] = (Math.random() - 0.5) * 220;
        motePos[i * 3 + 1] = Math.random() * 46;
        motePos[i * 3 + 2] = -60 + Math.random() * 120;
        moteSpeed[i] = 1 + Math.random() * 4;
      }
      moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
      const moteMat = new THREE.PointsMaterial({
        color: 0x8fb3ff,
        size: 0.18,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
      });
      const motes = new THREE.Points(moteGeo, moteMat);
      scene.add(motes);
      disposables.push(moteGeo, moteMat);

      return {
        interactables,
        update(elapsed, delta) {
          for (let i = 0; i < spinners.length; i += 1) {
            spinners[i].rotation.y += delta * 0.55;
            pillGroups[i].position.y =
              PILL_Y + Math.sin(elapsed * 1.3 + i * Math.PI) * 0.18;
          }
          for (const g of glowMats) {
            g.material.opacity = 0.72 + Math.sin(elapsed * 1.6 + g.phase) * 0.18;
          }
          boardGlowMat.opacity = 0.45 + Math.sin(elapsed * 0.9) * 0.12;
          const positions = moteGeo.attributes.position.array as Float32Array;
          for (let i = 0; i < MOTES; i += 1) {
            positions[i * 3 + 1] -= moteSpeed[i] * 0.016;
            if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 46;
          }
          moteGeo.attributes.position.needsUpdate = true;
        },
        disposables,
        dispose() {
          if (redrawRef.current === scoreboard.draw) redrawRef.current = null;
        },
      };
    },
    [router],
  );

  return (
    <WalkWorld
      build={build}
      spawn={{ x: 0, z: 13, yaw: 0 }}
      bounds={{ x: 60, zMin: -28, zMax: 22 }}
      background={0x090b10}
      fog={{ color: 0x090b10, near: 30, far: 130 }}
      toneMapping
      overlay={{
        kicker: hub.kicker,
        title: hub.title,
        intro: hub.intro,
        enter: "Enter",
      }}
      hint={hub.hint}
      exitHref="/account"
      exitLabel="sign in"
      topRight={
        <Link
          href="/storefront"
          className="pointer-events-auto rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
        >
          portfolio
        </Link>
      }
      bottomRight={
        <a
          href="https://www.veruthia.com/"
          target="_blank"
          rel="noopener noreferrer"
          title="Site security audited by Kruthia"
          className="pointer-events-auto block overflow-hidden rounded-md border border-white/12 opacity-80 transition-opacity hover:opacity-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/kruthia-badge.png"
            alt="Kruthia — Secure. Protect. Empower. Guarding what matters."
            className="h-auto w-40"
          />
        </a>
      }
    />
  );
}
