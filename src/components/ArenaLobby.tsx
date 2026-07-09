"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { arena } from "@/lib/content";
import type { PublicArenaGame } from "@/lib/studios";

// The lobby inside the Superdome: a domed hall ringed with game pods. Walk up
// to a pod and step into the light to drop into that 3D world.

const EYE_HEIGHT = 2.2;
const MOVE_SPEED = 11;
const ROOM_RADIUS = 44; // walkable clamp
const POD_RING = 26; // radius the pods sit on
const DOME_R = 46; // interior dome radius
const POD_NEAR = 7.5; // how close to "select" a pod

type ControlMode = "touch" | "gyro";

function subscribeToPointerType(callback: () => void) {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

// Portrait sign that hangs over each pod: status pill, name, wrapped tagline.
function makePodTexture(game: PublicArenaGame) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#080d18";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = game.accent;
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    // status pill
    const live = game.status === "live";
    const pill = live ? "ENTER" : "COMING SOON";
    ctx.font = "700 34px Arial";
    const pillW = ctx.measureText(pill).width + 56;
    const pillX = (canvas.width - pillW) / 2;
    ctx.fillStyle = live ? game.accent : "rgba(219,229,255,0.12)";
    ctx.beginPath();
    const r = 26;
    ctx.roundRect(pillX, 60, pillW, 52, r);
    ctx.fill();
    ctx.fillStyle = live ? "#08101c" : "#8b93a7";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pill, canvas.width / 2, 87);

    // name
    ctx.shadowColor = game.accent;
    ctx.shadowBlur = 26;
    ctx.fillStyle = game.accent;
    ctx.font = "900 68px Arial";
    ctx.fillText(game.name.toUpperCase(), canvas.width / 2, 220, canvas.width - 60);

    // tagline (word-wrapped)
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#c6d2f2";
    ctx.font = "500 34px Arial";
    const words = game.tagline.split(" ");
    let line = "";
    let y = 320;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > canvas.width - 80 && line) {
        ctx.fillText(line, canvas.width / 2, y);
        line = word;
        y += 46;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, canvas.width / 2, y);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,0.9)");
    gradient.addColorStop(0.4, "rgba(255,255,255,0.25)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

// --- Device-orientation camera quaternion (AR-style look) -------------------

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const ZEE = new THREE.Vector3(0, 0, 1);
const orientEuler = new THREE.Euler();
const qScreen = new THREE.Quaternion();
const Q_FLIP = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

function setQuaternionFromOrientation(
  quaternion: THREE.Quaternion,
  alpha: number,
  beta: number,
  gamma: number,
  screenAngle: number,
) {
  orientEuler.set(beta, alpha, -gamma, "YXZ");
  quaternion.setFromEuler(orientEuler);
  quaternion.multiply(Q_FLIP);
  quaternion.multiply(qScreen.setFromAxisAngle(ZEE, -screenAngle));
}

export default function ArenaLobby({ games }: { games: PublicArenaGame[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const modeRef = useRef<ControlMode>("touch");
  const lockFnRef = useRef<(() => void) | null>(null);
  const overlayOpenRef = useRef(false);
  const gamesRef = useRef(games);

  const [entered, setEntered] = useState(false);
  const [locked, setLocked] = useState(false);
  const [mode, setMode] = useState<ControlMode>("touch");
  const [activeGame, setActiveGame] = useState<number>(-1);
  const [toast, setToast] = useState("");
  const activeGameRef = useRef(-1);
  const isTouch = useSyncExternalStore(
    subscribeToPointerType,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );

  useEffect(() => {
    activeGameRef.current = activeGame;
  }, [activeGame]);

  useEffect(() => {
    gamesRef.current = games;
  }, [games]);

  // Freeze movement until the visitor has actually entered the lobby.
  useEffect(() => {
    overlayOpenRef.current = !entered;
  }, [entered]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Step into the currently selected pod: launch a live game, or note that a
  // pod is still under construction.
  const launchActive = () => {
    const index = activeGameRef.current;
    if (index < 0) return;
    const game = gamesRef.current[index];
    if (!game) return;
    if (game.status === "live" && game.href) {
      if (document.pointerLockElement) document.exitPointerLock();
      // The game lives on the owner's own host, so leave the site for it.
      window.location.href = game.href;
    } else {
      setToast(`${game.name} — coming soon`);
    }
  };
  const launchRef = useRef(launchActive);
  useEffect(() => {
    launchRef.current = launchActive;
  });

  // Press E to step into the pod you're standing at.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (event.code === "KeyE") launchRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const enterTouch = async (wantGyro: boolean) => {
    let nextMode: ControlMode = "touch";
    if (wantGyro) {
      const OrientationEvent = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      try {
        if (typeof OrientationEvent.requestPermission === "function") {
          const result = await OrientationEvent.requestPermission();
          if (result === "granted") nextMode = "gyro";
        } else {
          nextMode = "gyro";
        }
      } catch {
        nextMode = "touch";
      }
    }
    modeRef.current = nextMode;
    setMode(nextMode);
    setEntered(true);
  };

  const enterDesktop = () => {
    setEntered(true);
    lockFnRef.current?.();
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // --- Scene -------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070d);
    scene.fog = new THREE.Fog(0x05070d, 30, 120);

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      400,
    );
    camera.position.set(0, EYE_HEIGHT, 34); // by the entrance, facing the center

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

    const disposables: { dispose(): void }[] = [];

    // --- Floor: dark disc + neon rings ------------------------------------
    const floorGeo = new THREE.CircleGeometry(ROOM_RADIUS, 64);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x0a0f1b });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    disposables.push(floorGeo, floorMat);

    const ringMat = new THREE.LineBasicMaterial({
      color: 0x2b3b5c,
      transparent: true,
      opacity: 0.7,
    });
    disposables.push(ringMat);
    for (const rad of [10, 20, 30, 40]) {
      const pts: THREE.Vector3[] = [];
      for (let a = 0; a <= 64; a += 1) {
        const t = (a / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(t) * rad, 0.02, Math.sin(t) * rad));
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(pts);
      scene.add(new THREE.LineLoop(ringGeo, ringMat));
      disposables.push(ringGeo);
    }

    // --- Dome interior: geodesic shell seen from the inside ---------------
    const domeGeo = new THREE.SphereGeometry(
      DOME_R,
      28,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x080d18,
      side: THREE.BackSide,
    });
    const domeShell = new THREE.Mesh(domeGeo, domeMat);
    scene.add(domeShell);
    const domeWireMat = new THREE.MeshBasicMaterial({
      color: 0x3a4f78,
      wireframe: true,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.22,
    });
    const domeWire = new THREE.Mesh(domeGeo, domeWireMat);
    scene.add(domeWire);
    disposables.push(domeGeo, domeMat, domeWireMat);

    // A low cylindrical wall skirting the base so there is no seam at eye level.
    const wallGeo = new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, 10, 48, 1, true);
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x0a1120,
      side: THREE.BackSide,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = 5;
    scene.add(wall);
    disposables.push(wallGeo, wallMat);

    // A soft dome of stars overhead so the ceiling has some life.
    const starCount = 400;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const t = Math.random() * Math.PI * 2;
      const p = Math.random() * Math.PI * 0.5;
      const rad = DOME_R - 1;
      starPos[i * 3] = Math.cos(t) * Math.sin(p) * rad;
      starPos[i * 3 + 1] = Math.cos(p) * rad;
      starPos[i * 3 + 2] = Math.sin(t) * Math.sin(p) * rad;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x9fb6ff,
      size: 0.4,
      transparent: true,
      opacity: 0.7,
    });
    scene.add(new THREE.Points(starGeo, starMat));
    disposables.push(starGeo, starMat);

    // --- Game pods around the ring ----------------------------------------
    const glowTexture = makeGlowTexture();
    disposables.push(glowTexture);
    const podPositions: THREE.Vector3[] = [];
    const beamMaterials: THREE.MeshBasicMaterial[] = [];

    const pedestalGeo = new THREE.CylinderGeometry(2.6, 3, 1.4, 24);
    const beamGeo = new THREE.CylinderGeometry(1.9, 1.9, 12, 24, 1, true);
    const signGeo = new THREE.PlaneGeometry(6, 7.5);
    const signFrameGeo = new THREE.PlaneGeometry(6.5, 8);
    disposables.push(pedestalGeo, beamGeo, signGeo, signFrameGeo);

    games.forEach((game, i) => {
      const angle = (i / games.length) * Math.PI * 2;
      const px = Math.sin(angle) * POD_RING;
      const pz = -Math.cos(angle) * POD_RING;
      const accent = new THREE.Color(game.accent);

      const podGroup = new THREE.Group();
      podGroup.position.set(px, 0, pz);
      // Face the sign toward the center of the room.
      podGroup.rotation.y = Math.atan2(-px, -pz);

      const trimMat = new THREE.MeshBasicMaterial({ color: accent });
      const baseMat = new THREE.MeshBasicMaterial({ color: 0x0c1424 });
      disposables.push(trimMat, baseMat);

      const pedestal = new THREE.Mesh(pedestalGeo, baseMat);
      pedestal.position.y = 0.7;
      podGroup.add(pedestal);
      const pedestalRim = new THREE.Mesh(
        new THREE.TorusGeometry(2.7, 0.12, 8, 32),
        trimMat,
      );
      pedestalRim.rotation.x = Math.PI / 2;
      pedestalRim.position.y = 1.4;
      podGroup.add(pedestalRim);
      disposables.push(pedestalRim.geometry);

      // Beam of light rising from the pedestal (the "doorway").
      const beamMat = new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 7;
      podGroup.add(beam);
      beamMaterials.push(beamMat);
      disposables.push(beamMat);

      // Floor glow disc under the pod.
      const glowMat = new THREE.SpriteMaterial({
        map: glowTexture,
        color: accent,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.5,
      });
      const glow = new THREE.Sprite(glowMat);
      glow.scale.set(9, 9, 1);
      glow.position.y = 0.1;
      podGroup.add(glow);
      disposables.push(glowMat);

      // The sign, on a slim floating frame facing the room center.
      const signFrame = new THREE.Mesh(signFrameGeo, trimMat);
      signFrame.position.set(0, 5.6, 0.02);
      podGroup.add(signFrame);
      const signTex = makePodTexture(game);
      const signMat = new THREE.MeshBasicMaterial({
        map: signTex,
        transparent: true,
      });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(0, 5.6, 0.06);
      podGroup.add(sign);
      disposables.push(signTex, signMat);

      scene.add(podGroup);
      podPositions.push(new THREE.Vector3(px, 0, pz));
    });

    // --- Controls ---------------------------------------------------------
    const keys = new Set<string>();
    let yaw = 0; // faces -z, toward the center of the room
    let pitch = 0;
    let gyroYawOffset = 0;
    const yawOffsetQ = new THREE.Quaternion();

    const gyro = { alpha: 0, beta: 0, gamma: 0, has: false };
    let screenAngle = THREE.MathUtils.degToRad(
      window.screen.orientation?.angle ?? 0,
    );

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha === null) return;
      gyro.alpha = THREE.MathUtils.degToRad(event.alpha);
      gyro.beta = THREE.MathUtils.degToRad(event.beta ?? 0);
      gyro.gamma = THREE.MathUtils.degToRad(event.gamma ?? 0);
      gyro.has = true;
    };
    const onScreenRotate = () => {
      screenAngle = THREE.MathUtils.degToRad(
        window.screen.orientation?.angle ?? 0,
      );
    };

    const isTyping = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      return (
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      );
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event)) return;
      keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (isTyping(event)) return;
      keys.delete(event.code);
    };

    const applyLook = (dx: number, dy: number, sensitivity: number) => {
      yaw -= dx * sensitivity;
      pitch -= dy * sensitivity;
      pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
    };
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      applyLook(event.movementX, event.movementY, 0.0022);
    };
    const onPointerLockChange = () => {
      setLocked(document.pointerLockElement === renderer.domElement);
    };
    const requestLock = () => {
      if (!window.matchMedia("(pointer: coarse)").matches) {
        renderer.domElement.requestPointerLock();
      }
    };
    lockFnRef.current = requestLock;

    // Touch: left half = walk stick, right half = look/turn.
    const touchState = {
      moveId: -1,
      moveStart: new THREE.Vector2(),
      moveDelta: new THREE.Vector2(),
      lookId: -1,
      lookLast: new THREE.Vector2(),
    };
    const onTouchStart = (event: TouchEvent) => {
      event.preventDefault();
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.clientX < window.innerWidth / 2 && touchState.moveId === -1) {
          touchState.moveId = touch.identifier;
          touchState.moveStart.set(touch.clientX, touch.clientY);
          touchState.moveDelta.set(0, 0);
        } else if (touchState.lookId === -1) {
          touchState.lookId = touch.identifier;
          touchState.lookLast.set(touch.clientX, touch.clientY);
        }
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === touchState.moveId) {
          touchState.moveDelta.set(
            (touch.clientX - touchState.moveStart.x) / 60,
            (touch.clientY - touchState.moveStart.y) / 60,
          );
          touchState.moveDelta.clampScalar(-1, 1);
        } else if (touch.identifier === touchState.lookId) {
          if (modeRef.current === "gyro") {
            gyroYawOffset -= (touch.clientX - touchState.lookLast.x) * 0.004;
            touchState.lookLast.set(touch.clientX, touch.clientY);
          } else {
            applyLook(
              touch.clientX - touchState.lookLast.x,
              touch.clientY - touchState.lookLast.y,
              0.0045,
            );
            touchState.lookLast.set(touch.clientX, touch.clientY);
          }
        }
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === touchState.moveId) {
          touchState.moveId = -1;
          touchState.moveDelta.set(0, 0);
        } else if (touch.identifier === touchState.lookId) {
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
    window.addEventListener("deviceorientation", onOrientation);
    window.screen.orientation?.addEventListener("change", onScreenRotate);
    renderer.domElement.addEventListener("click", requestLock);
    renderer.domElement.addEventListener("touchstart", onTouchStart, {
      passive: false,
    });
    renderer.domElement.addEventListener("touchmove", onTouchMove, {
      passive: false,
    });
    renderer.domElement.addEventListener("touchend", onTouchEnd);
    window.addEventListener("resize", onResize);

    // --- Animation loop ---------------------------------------------------
    const clock = new THREE.Clock();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const velocity = new THREE.Vector3();
    let currentActive = -1;
    let animationFrame = 0;

    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      if (modeRef.current === "gyro" && gyro.has) {
        setQuaternionFromOrientation(
          camera.quaternion,
          gyro.alpha,
          gyro.beta,
          gyro.gamma,
          screenAngle,
        );
        camera.quaternion.premultiply(
          yawOffsetQ.setFromAxisAngle(WORLD_UP, gyroYawOffset),
        );
      } else {
        camera.rotation.set(0, 0, 0);
        camera.rotateY(yaw);
        camera.rotateX(pitch);
      }

      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-4) {
        forward.set(0, 0, -1);
      } else {
        forward.normalize();
      }
      right.crossVectors(forward, WORLD_UP);

      velocity.set(0, 0, 0);
      if (keys.has("KeyW") || keys.has("ArrowUp")) velocity.add(forward);
      if (keys.has("KeyS") || keys.has("ArrowDown")) velocity.sub(forward);
      if (keys.has("KeyD") || keys.has("ArrowRight")) velocity.add(right);
      if (keys.has("KeyA") || keys.has("ArrowLeft")) velocity.sub(right);
      if (touchState.moveId !== -1) {
        velocity.addScaledVector(forward, -touchState.moveDelta.y);
        velocity.addScaledVector(right, touchState.moveDelta.x);
      }
      if (overlayOpenRef.current) velocity.set(0, 0, 0);

      if (velocity.lengthSq() > 0) {
        if (velocity.lengthSq() > 1) velocity.normalize();
        camera.position.addScaledVector(velocity, MOVE_SPEED * delta);
        // clamp inside the dome
        const distFromCenter = Math.hypot(
          camera.position.x,
          camera.position.z,
        );
        if (distFromCenter > ROOM_RADIUS - 2) {
          const scale = (ROOM_RADIUS - 2) / distFromCenter;
          camera.position.x *= scale;
          camera.position.z *= scale;
        }
      }

      if (modeRef.current !== "gyro") {
        camera.position.y = EYE_HEIGHT + Math.sin(elapsed * 1.4) * 0.035;
      } else {
        camera.position.y = EYE_HEIGHT;
      }

      // pulse the beams so the pods feel alive
      const pulse = 0.12 + Math.sin(elapsed * 2) * 0.05;
      for (const mat of beamMaterials) mat.opacity = pulse;

      // which pod are we standing at?
      let nearest = -1;
      let nearestDistance = POD_NEAR;
      for (let i = 0; i < podPositions.length; i += 1) {
        const distance = Math.hypot(
          podPositions[i].x - camera.position.x,
          podPositions[i].z - camera.position.z,
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = i;
        }
      }
      if (nearest !== currentActive) {
        currentActive = nearest;
        setActiveGame(nearest);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      window.removeEventListener("deviceorientation", onOrientation);
      window.screen.orientation?.removeEventListener("change", onScreenRotate);
      renderer.domElement.removeEventListener("click", requestLock);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", onResize);
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      }
      disposables.forEach((resource) => resource.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [games]);

  const active = activeGame >= 0 ? games[activeGame] : null;
  const showTouchOverlay = isTouch && !entered;
  const showDesktopOverlay = !isTouch && !entered;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div ref={hostRef} className="stage-fixed" />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {/* crosshair */}
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#dbe5ff]/80" />

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-2 p-4">
          <p
            className="text-xs font-bold uppercase tracking-[0.24em]"
            style={{ color: arena.accent }}
          >
            {arena.entrance.name} · lobby
          </p>
          <Link
            href="/rabbit-hole/game"
            className="pointer-events-auto rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
          >
            back to the street
          </Link>
        </div>

        {/* controls hint */}
        <p className="absolute inset-x-0 bottom-4 px-4 text-center text-[11px] uppercase tracking-[0.25em] text-ink-dim">
          {isTouch
            ? mode === "gyro"
              ? "move your phone to look — left thumb: walk — swipe right: turn"
              : "left thumb: walk — right thumb: look"
            : locked
              ? "wasd / arrows: move — mouse: look — E: step into a pod"
              : "cursor released — click the scene to look around again"}
        </p>

        {/* selected pod placard */}
        {active && (
          <div className="absolute inset-x-0 bottom-14 flex justify-center px-4">
            <div
              className="max-w-md rounded-lg border bg-[#0b1020]/88 p-5 text-center backdrop-blur-sm"
              style={{ borderColor: `${active.accent}66` }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-[0.28em]"
                style={{ color: active.accent }}
              >
                {active.status === "live" ? "ready to play" : "coming soon"}
              </p>
              <p className="mt-1.5 text-lg font-black tracking-tight text-[#dbe5ff]">
                {active.name}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                {active.tagline}
              </p>
              <button
                type="button"
                onClick={launchActive}
                disabled={active.status !== "live"}
                className="pointer-events-auto mt-4 inline-block rounded-md border bg-[#121826]/72 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors enabled:hover:text-[#0b1020] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderColor: `${active.accent}99` }}
              >
                {active.status === "live" ? "Step into the light" : "Under construction"}
                <span className="ml-2 hidden text-[10px] text-ink-dim sm:inline">
                  {active.status === "live" ? "or press E" : ""}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* transient toast */}
        {toast && (
          <div className="absolute inset-x-0 top-[18%] flex justify-center px-4">
            <p className="rounded-md border border-white/14 bg-[#0b1020]/90 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dbe5ff] backdrop-blur-sm">
              {toast}
            </p>
          </div>
        )}
      </div>

      {/* enter overlay (desktop) */}
      {showDesktopOverlay && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-black/80 px-6 py-10 text-center">
          <p
            className="text-2xl font-black uppercase tracking-[0.24em]"
            style={{ color: arena.accent }}
          >
            {arena.entrance.name}
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            {arena.lobby.intro}
          </p>
          <button
            type="button"
            onClick={enterDesktop}
            className="w-full max-w-xs rounded-md border bg-[#121826]/72 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
            style={{ borderColor: `${arena.accent}99` }}
          >
            enter the lobby
          </button>
          <Link
            href="/rabbit-hole/game"
            className="text-xs uppercase tracking-[0.22em] text-ink-dim underline-offset-4 transition-colors hover:text-[#dbe5ff] hover:underline"
          >
            back to the street
          </Link>
        </div>
      )}

      {/* tap-to-enter overlay (mobile) */}
      {showTouchOverlay && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-black/85 px-6 py-10 text-center">
          <p
            className="text-2xl font-black uppercase tracking-[0.24em]"
            style={{ color: arena.accent }}
          >
            {arena.entrance.name}
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            {arena.lobby.intro}
          </p>
          <button
            type="button"
            onClick={() => enterTouch(true)}
            className="w-full max-w-xs rounded-md border bg-[#121826]/72 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors active:bg-[#dbe5ff] active:text-[#0b1020]"
            style={{ borderColor: `${arena.accent}99` }}
          >
            enter with motion controls
            <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-ink-soft">
              move your phone to look around, AR style
            </span>
          </button>
          <button
            type="button"
            onClick={() => enterTouch(false)}
            className="w-full max-w-xs rounded-md border border-white/18 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-ink-soft transition-colors active:bg-[#dbe5ff] active:text-[#0b1020]"
          >
            enter with touch controls
            <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-ink-dim">
              drag to look, thumb to walk
            </span>
          </button>
          <Link
            href="/rabbit-hole/game"
            className="mt-2 text-xs uppercase tracking-[0.22em] text-ink-dim underline-offset-4 transition-colors hover:text-[#dbe5ff]"
          >
            back to the street
          </Link>
        </div>
      )}
    </div>
  );
}
