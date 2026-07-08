"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SHELL_COUNT, generateBeach } from "@/lib/beach";

// ---------------------------------------------------------------------------
// Room 02 — The Shore. A warm cove in the middle of the game's night: rolling
// surf, palms on the dunes, and ten shells lost in the sand. Nothing hunts
// you here. Find the shells if you like, or just listen to the water.
// ---------------------------------------------------------------------------

const EYE_HEIGHT = 1.8;
const MOVE_SPEED = 6;
const RUN_SPEED = 10;
const SKY_COLOR = 0x9fd4f5;
const COLLECT_RADIUS = 2.6;
const WALK_X = 52;
const WALK_Z_MIN = -8;
const WALK_Z_MAX = 34;

// the cove's ground: seabed rising through the surf line up into dunes
export function sandHeightAt(x: number, z: number): number {
  const shore = THREE.MathUtils.lerp(
    -2.6,
    0.25,
    THREE.MathUtils.smoothstep(z, -18, 0),
  );
  const dunes = THREE.MathUtils.smoothstep(z, 3, 32) * 5.5;
  const bumps =
    0.22 * Math.sin(x * 0.13) * Math.cos(z * 0.21) +
    0.12 * Math.sin(x * 0.31 + z * 0.17);
  return shore + dunes + bumps;
}

// --- procedural wave-wash ambience -------------------------------------------

type Ambience = { setMuted(m: boolean): void; dispose(): void };

function createSurfAmbience(startMuted: boolean): Ambience | null {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = startMuted ? 0 : 0.4;
    master.connect(ctx.destination);

    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      // lightly reddened noise — closer to water than to static
      last = last * 0.94 + (Math.random() * 2 - 1) * 0.25;
      data[i] = last;
    }

    // two overlapping swells so the surf never repeats exactly
    [
      { rate: 0.055, base: 0.28, depth: 0.22, cutoff: 520 },
      { rate: 0.087, base: 0.16, depth: 0.14, cutoff: 900 },
    ].forEach((layer) => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = layer.cutoff;
      const gain = ctx.createGain();
      gain.gain.value = layer.base;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = layer.rate;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = layer.depth;
      lfo.connect(lfoDepth);
      lfoDepth.connect(gain.gain);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
      lfo.start();
    });

    return {
      setMuted(m: boolean) {
        master.gain.setTargetAtTime(m ? 0 : 0.4, ctx.currentTime, 0.2);
      },
      dispose() {
        ctx.close().catch(() => {});
      },
    };
  } catch {
    return null;
  }
}

export default function BeachRoom() {
  const hostRef = useRef<HTMLDivElement>(null);
  const collectedRef = useRef<Set<string>>(new Set());
  const ambienceRef = useRef<Ambience | null>(null);
  const mutedRef = useRef(false);
  const flashTimerRef = useRef(0);

  const [entered, setEntered] = useState(false);
  const [locked, setLocked] = useState(false);
  const [everLocked, setEverLocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [xp, setXp] = useState<number | null>(null);
  const [shellsHeld, setShellsHeld] = useState(0);
  const [alreadyCleared, setAlreadyCleared] = useState(false);
  const [clearedNow, setClearedNow] = useState(false);
  const [flashActive, setFlashActive] = useState(false);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.progress) return;
        setXp(d.progress.xp);
        const held: string[] = d.progress.collectibles?.beach ?? [];
        collectedRef.current = new Set(held);
        setShellsHeld(held.length);
        if (d.progress.roomsCleared?.includes("beach")) setAlreadyCleared(true);
      })
      .catch(() => {});
  }, []);

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    ambienceRef.current?.setMuted(next);
  };

  useEffect(() => {
    if (!entered) return;
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    ambienceRef.current = createSurfAmbience(mutedRef.current);

    // --- the cove ---------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY_COLOR);
    scene.fog = new THREE.Fog(SKY_COLOR, 90, 260);

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      500,
    );
    camera.position.set(0, sandHeightAt(0, 14) + EYE_HEIGHT, 14);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

    const disposables: { dispose(): void }[] = [];
    const add = <T extends { dispose(): void }>(d: T): T => {
      disposables.push(d);
      return d;
    };

    const skyLight = add(new THREE.HemisphereLight(0xd4ecff, 0xd8c9a0, 1.05));
    scene.add(skyLight);
    const sun = add(new THREE.DirectionalLight(0xfff2d0, 1.35));
    sun.position.set(-140, 180, -90);
    scene.add(sun);

    // sand, flat-shaded and vertex-colored like the rest of the world
    const sandPlane = new THREE.PlaneGeometry(230, 130, 110, 62);
    sandPlane.rotateX(-Math.PI / 2);
    sandPlane.translate(0, 0, 8); // z -57 .. 73
    {
      const pos = sandPlane.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        pos.setY(i, sandHeightAt(pos.getX(i), pos.getZ(i)));
      }
    }
    const sandGeo = add(sandPlane.toNonIndexed());
    sandPlane.dispose();
    sandGeo.computeVertexNormals();
    {
      const p = sandGeo.attributes.position;
      const colors = new Float32Array(p.count * 3);
      const wet = new THREE.Color(0xb99e72);
      const dry = new THREE.Color(0xe8d5a8);
      const grass = new THREE.Color(0x7da35e);
      const c = new THREE.Color();
      for (let f = 0; f < p.count; f += 3) {
        const y = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
        const x = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3;
        const z = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3;
        c.copy(wet).lerp(dry, THREE.MathUtils.clamp((y - 0.1) / 1.4, 0, 1));
        c.lerp(grass, THREE.MathUtils.smoothstep(y, 3.8, 6.2) * 0.85);
        c.multiplyScalar(1 + 0.05 * Math.sin(x * 0.9 + z * 1.3));
        for (let v = 0; v < 3; v += 1) {
          colors[(f + v) * 3] = c.r;
          colors[(f + v) * 3 + 1] = c.g;
          colors[(f + v) * 3 + 2] = c.b;
        }
      }
      sandGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
    const sandMat = add(new THREE.MeshLambertMaterial({ vertexColors: true }));
    scene.add(new THREE.Mesh(sandGeo, sandMat));

    // the sea — a living plane, waves rolling toward the shore
    const waterGeo = add(new THREE.PlaneGeometry(240, 110, 96, 44));
    waterGeo.rotateX(-Math.PI / 2);
    waterGeo.translate(0, 0, -48); // z -103 .. 7
    const waterMat = add(
      new THREE.MeshLambertMaterial({
        color: 0x2e8fb8,
        transparent: true,
        opacity: 0.82,
        flatShading: true,
      }),
    );
    const water = new THREE.Mesh(waterGeo, waterMat);
    scene.add(water);
    const waterPos = waterGeo.attributes.position;
    const waterBase = new Float32Array(waterPos.count * 2);
    for (let i = 0; i < waterPos.count; i += 1) {
      waterBase[i * 2] = waterPos.getX(i);
      waterBase[i * 2 + 1] = waterPos.getZ(i);
    }

    // drifting clouds
    const cloudTex = (() => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 128;
      const ctx2 = canvas.getContext("2d");
      if (ctx2) {
        for (let i = 0; i < 7; i += 1) {
          const g = ctx2.createRadialGradient(
            40 + Math.random() * 176, 50 + Math.random() * 28, 0,
            40 + Math.random() * 176, 50 + Math.random() * 28, 34 + Math.random() * 22,
          );
          g.addColorStop(0, "rgba(255,255,255,0.85)");
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx2.fillStyle = g;
          ctx2.fillRect(0, 0, 256, 128);
        }
      }
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      return add(t);
    })();
    const clouds: THREE.Sprite[] = [];
    for (let i = 0; i < 6; i += 1) {
      const m = add(
        new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.9, fog: false }),
      );
      const cloud = new THREE.Sprite(m);
      cloud.position.set(-200 + i * 80 + Math.random() * 40, 60 + Math.random() * 30, -120 - Math.random() * 60);
      const s = 60 + Math.random() * 50;
      cloud.scale.set(s, s * 0.45, 1);
      scene.add(cloud);
      clouds.push(cloud);
    }

    // palms on the dunes
    const { shells, palms } = generateBeach();
    const trunkMat = add(new THREE.MeshLambertMaterial({ color: 0x8a6742, flatShading: true }));
    const frondMat = add(new THREE.MeshLambertMaterial({ color: 0x3f8f4a, flatShading: true, side: THREE.DoubleSide }));
    const trunkGeo = add(new THREE.CylinderGeometry(0.16, 0.3, 1.6, 6));
    const frondGeo = add(new THREE.BoxGeometry(3.4, 0.05, 0.75));
    palms.forEach((palm) => {
      const group = new THREE.Group();
      const baseY = sandHeightAt(palm.x, palm.z);
      const segments = 5;
      let px = 0;
      let py = 0;
      for (let s = 0; s < segments; s += 1) {
        const seg = new THREE.Mesh(trunkGeo, trunkMat);
        const t = s / segments;
        px += Math.sin(palm.lean) * (palm.height / segments) * t;
        py += (palm.height / segments) * (1 - t * 0.12);
        seg.position.set(px, py, 0);
        seg.rotation.z = -palm.lean * t * 1.4;
        seg.scale.setScalar(1 - t * 0.35);
        group.add(seg);
      }
      for (let f = 0; f < 7; f += 1) {
        const frond = new THREE.Mesh(frondGeo, frondMat);
        const angle = (f / 7) * Math.PI * 2;
        frond.position.set(px + Math.cos(angle) * 1.5, py + 0.5, Math.sin(angle) * 1.5);
        frond.rotation.y = -angle;
        frond.rotation.z = 0.42 + Math.random() * 0.2; // droop
        group.add(frond);
      }
      group.position.set(palm.x, baseY - 0.1, palm.z);
      group.rotation.y = Math.random() * Math.PI * 2;
      scene.add(group);
    });

    // a couple of umbrellas and loungers — someone relaxes here
    const poleMat = add(new THREE.MeshLambertMaterial({ color: 0xdedede }));
    const canopyMat = add(new THREE.MeshLambertMaterial({ color: 0xe86a5e, flatShading: true, side: THREE.DoubleSide }));
    const loungerMat = add(new THREE.MeshLambertMaterial({ color: 0xf3ede0, flatShading: true }));
    const poleGeo = add(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6));
    const canopyGeo = add(new THREE.ConeGeometry(1.7, 0.7, 8, 1, true));
    const seatGeo = add(new THREE.BoxGeometry(1, 0.14, 2.2));
    const backGeo = add(new THREE.BoxGeometry(1, 0.14, 1.1));
    [
      [-9, 8],
      [12, 10],
    ].forEach(([ux, uz]) => {
      const y = sandHeightAt(ux, uz);
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(ux, y + 1.3, uz);
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.set(ux, y + 2.7, uz);
      scene.add(pole, canopy);
      const seat = new THREE.Mesh(seatGeo, loungerMat);
      seat.position.set(ux + 1.8, y + 0.35, uz + 0.4);
      const back = new THREE.Mesh(backGeo, loungerMat);
      back.position.set(ux + 1.8, y + 0.75, uz - 0.55);
      back.rotation.x = -0.7;
      scene.add(seat, back);
    });
    // a beach ball, of course
    const ballGeo = add(new THREE.IcosahedronGeometry(0.5, 1));
    const ballMat = add(new THREE.MeshLambertMaterial({ color: 0xf2a03d, flatShading: true }));
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set(3, sandHeightAt(3, 6) + 0.5, 6);
    scene.add(ball);

    // the shells
    const shellGeo = add(new THREE.SphereGeometry(0.42, 8, 6));
    const shellMat = add(
      new THREE.MeshLambertMaterial({
        color: 0xf6e3d0,
        emissive: 0xb06a70,
        emissiveIntensity: 0.25,
        flatShading: true,
      }),
    );
    const shellMeshes = new Map<string, THREE.Mesh>();
    shells.forEach((shell) => {
      if (collectedRef.current.has(shell.id)) return;
      const mesh = new THREE.Mesh(shellGeo, shellMat);
      mesh.scale.set(1, 0.45, 1);
      mesh.position.set(shell.x, sandHeightAt(shell.x, shell.z) + 0.18, shell.z);
      mesh.rotation.y = Math.random() * Math.PI;
      scene.add(mesh);
      shellMeshes.set(shell.id, mesh);
    });

    const bank = (shellId: string) => {
      const mesh = shellMeshes.get(shellId);
      if (!mesh) return;
      scene.remove(mesh);
      shellMeshes.delete(shellId);
      collectedRef.current.add(shellId);
      setShellsHeld(collectedRef.current.size);
      setFlashActive(true);
      window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = window.setTimeout(() => setFlashActive(false), 900);
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectItem: { room: "beach", id: shellId } }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.progress) return;
          setXp(d.progress.xp);
          if (d.clearedNow) setClearedNow(true);
        })
        .catch(() => {});
    };

    // --- controls (same contract as the lobby: lock, Esc pauses) ---------------
    const keys = new Set<string>();
    let yaw = 0; // spawn looking out to sea (-z is the water)
    let pitch = 0;

    const onKeyDown = (e: KeyboardEvent) => keys.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const applyLook = (dx: number, dy: number, s: number) => {
      yaw -= dx * s;
      pitch -= dy * s;
      pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      applyLook(e.movementX, e.movementY, 0.0022);
    };
    const onPointerLockChange = () => {
      const isLocked = document.pointerLockElement === renderer.domElement;
      setLocked(isLocked);
      if (isLocked) setEverLocked(true);
    };
    const requestLock = () => {
      if (!window.matchMedia("(pointer: coarse)").matches) {
        const r = renderer.domElement.requestPointerLock() as unknown as
          | Promise<void>
          | undefined;
        r?.catch?.(() => {});
      }
    };

    const touchState = {
      moveId: -1, moveStart: new THREE.Vector2(), moveDelta: new THREE.Vector2(),
      lookId: -1, lookLast: new THREE.Vector2(),
    };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX < window.innerWidth / 2 && touchState.moveId === -1) {
          touchState.moveId = t.identifier;
          touchState.moveStart.set(t.clientX, t.clientY);
          touchState.moveDelta.set(0, 0);
        } else if (touchState.lookId === -1) {
          touchState.lookId = t.identifier;
          touchState.lookLast.set(t.clientX, t.clientY);
        }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchState.moveId) {
          touchState.moveDelta.set(
            (t.clientX - touchState.moveStart.x) / 60,
            (t.clientY - touchState.moveStart.y) / 60,
          );
          touchState.moveDelta.clampScalar(-1, 1);
        } else if (t.identifier === touchState.lookId) {
          applyLook(t.clientX - touchState.lookLast.x, t.clientY - touchState.lookLast.y, 0.0045);
          touchState.lookLast.set(t.clientX, t.clientY);
        }
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchState.moveId) {
          touchState.moveId = -1;
          touchState.moveDelta.set(0, 0);
        } else if (t.identifier === touchState.lookId) {
          touchState.lookId = -1;
        }
      }
    };
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    renderer.domElement.addEventListener("click", requestLock);
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: false });
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });
    renderer.domElement.addEventListener("touchend", onTouchEnd);
    window.addEventListener("resize", onResize);
    requestLock();

    // --- loop --------------------------------------------------------------------
    const clock = new THREE.Clock();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const velocity = new THREE.Vector3();
    let frame = 0;

    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      camera.rotation.set(0, 0, 0);
      camera.rotateY(yaw);
      camera.rotateX(pitch);

      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-4) forward.set(0, 0, -1);
      else forward.normalize();
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

      velocity.set(0, 0, 0);
      if (keys.has("KeyW") || keys.has("ArrowUp")) velocity.add(forward);
      if (keys.has("KeyS") || keys.has("ArrowDown")) velocity.sub(forward);
      if (keys.has("KeyD") || keys.has("ArrowRight")) velocity.add(right);
      if (keys.has("KeyA") || keys.has("ArrowLeft")) velocity.sub(right);
      if (touchState.moveId !== -1) {
        velocity.addScaledVector(forward, -touchState.moveDelta.y);
        velocity.addScaledVector(right, touchState.moveDelta.x);
      }
      if (velocity.lengthSq() > 0) {
        if (velocity.lengthSq() > 1) velocity.normalize();
        const running = keys.has("ShiftLeft") || keys.has("ShiftRight");
        camera.position.addScaledVector(velocity, (running ? RUN_SPEED : MOVE_SPEED) * delta);
      }
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -WALK_X, WALK_X);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, WALK_Z_MIN, WALK_Z_MAX);
      const bob = Math.sin(elapsed * 1.4) * 0.03;
      camera.position.y =
        Math.max(sandHeightAt(camera.position.x, camera.position.z), -0.6) +
        EYE_HEIGHT +
        bob;

      // roll the sea
      for (let i = 0; i < waterPos.count; i += 1) {
        const wx = waterBase[i * 2];
        const wz = waterBase[i * 2 + 1];
        waterPos.setY(
          i,
          0.26 * Math.sin(wx * 0.045 + elapsed * 1.1) +
            0.18 * Math.sin(wx * 0.02 - wz * 0.06 + elapsed * 0.7) +
            0.1 * Math.sin(wz * 0.12 + elapsed * 1.6),
        );
      }
      waterPos.needsUpdate = true;
      waterGeo.computeVertexNormals();

      // clouds drift
      for (const cloud of clouds) {
        cloud.position.x += delta * 1.1;
        if (cloud.position.x > 240) cloud.position.x = -240;
      }

      // shells shimmer; walk close and they're yours
      shellMat.emissiveIntensity = 0.22 + Math.sin(elapsed * 2.2) * 0.12;
      for (const [id, mesh] of shellMeshes) {
        if (
          Math.hypot(
            mesh.position.x - camera.position.x,
            mesh.position.z - camera.position.z,
          ) < COLLECT_RADIUS
        ) {
          bank(id);
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      void disposed;
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      renderer.domElement.removeEventListener("click", requestLock);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", onResize);
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      }
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      ambienceRef.current?.dispose();
      ambienceRef.current = null;
    };
  }, [entered]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div ref={hostRef} className="stage-fixed" />

      {entered && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {/* top bar */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-white drop-shadow">
                room 02 — the shore
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/70 drop-shadow">
                {xp !== null && `${xp} xp · `}
                shells {shellsHeld}/{SHELL_COUNT}
                {alreadyCleared && " · cleared"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="pointer-events-auto rounded-full border border-white/40 bg-black/25 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-black"
              >
                {muted ? "surf off" : "surf on"}
              </button>
              <Link
                href="/lobby"
                className="pointer-events-auto rounded-full border border-white/40 bg-black/25 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-black"
              >
                back to the nexus
              </Link>
            </div>
          </div>

          {/* shell pickup flash */}
          {flashActive && (
            <p className="absolute inset-x-0 top-24 text-center text-sm font-bold uppercase tracking-[0.3em] text-white drop-shadow">
              shell found +5 xp
            </p>
          )}

          {/* paused (desktop) */}
          {!locked && everLocked && !clearedNow && (
            <div className="absolute inset-x-0 top-20 flex justify-center">
              <p className="rounded-full border border-white/30 bg-black/45 px-5 py-2 text-[11px] uppercase tracking-[0.25em] text-white/85 backdrop-blur-sm">
                paused — mouse free · click the sand to keep walking
              </p>
            </div>
          )}

          {/* controls hint */}
          <p className="absolute inset-x-0 bottom-4 px-4 text-center text-[11px] uppercase tracking-[0.25em] text-white/60 drop-shadow">
            wasd: walk — shift: run — mouse: look — esc: free the mouse — ten
            shells wait in the sand
          </p>
        </div>
      )}

      {/* room cleared */}
      {clearedNow && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black/70 px-6 text-center">
          <p className="text-3xl font-bold uppercase tracking-[0.3em] text-white">
            ten shells, one shore
          </p>
          <p className="max-w-md text-sm leading-relaxed text-white/80">
            You combed the whole beach. +100 xp, +50 points — and the waves
            keep rolling whether you stay or go.
          </p>
          <div className="flex gap-3">
            <Link
              href="/lobby"
              className="rounded-full border border-white px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-black"
            >
              return to the nexus →
            </Link>
            <button
              type="button"
              onClick={() => setClearedNow(false)}
              className="rounded-full border border-white/40 px-6 py-3 text-xs uppercase tracking-[0.2em] text-white/70 transition-colors hover:text-white"
            >
              stay a while
            </button>
          </div>
        </div>
      )}

      {/* entry overlay */}
      {!entered && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/85 px-6 text-center">
          <p className="text-2xl font-bold uppercase tracking-[0.3em] text-white">
            room 02 — the shore
          </p>
          <p className="max-w-md text-sm leading-relaxed text-white/80">
            A warm cove on the far side of the gate. Waves, palms, and nothing
            that needs anything from you. Ten shells are scattered in the sand
            — gather them if you feel like it, or just listen to the water.
          </p>
          <p className="text-xs uppercase tracking-[0.25em] text-white/50">
            {alreadyCleared
              ? "you have combed this beach before — welcome back"
              : `${shellsHeld}/${SHELL_COUNT} shells found so far`}
          </p>
          <button
            type="button"
            onClick={() => setEntered(true)}
            className="w-full max-w-xs rounded-full border border-white bg-white/10 px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-black"
          >
            step onto the sand
          </button>
          <Link
            href="/lobby"
            className="text-xs uppercase tracking-[0.25em] text-white/50 underline-offset-4 transition-colors hover:text-white"
          >
            ← back to the nexus
          </Link>
        </div>
      )}
    </div>
  );
}
