"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { monoliths } from "@/lib/content";

const EYE_HEIGHT = 2.2;
const MOVE_SPEED = 12;
const BOUNDS = { x: 70, zMin: -140, zMax: 20 };
const REVEAL_RADIUS = 10;
const RAIN_COUNT = 2200;

type ControlMode = "touch" | "gyro";

function subscribeToPointerType(callback: () => void) {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function makeLabelTexture(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.font = "700 58px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#8fb3ff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#dbe5ff";
    ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// --- Procedural ambience (no audio files needed) ---------------------------

type Ambience = {
  setProximity(v: number): void;
  setMuted(m: boolean): void;
  dispose(): void;
};

function createAmbience(startMuted: boolean): Ambience | null {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    if (!startMuted) {
      master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2.5);
    }

    // Low detuned drone — the hum of the machine
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.16;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 240;
    droneGain.connect(droneFilter);
    droneFilter.connect(master);
    [
      { freq: 46, type: "sine" as const, level: 1 },
      { freq: 46.6, type: "sine" as const, level: 1 },
      { freq: 92.5, type: "triangle" as const, level: 0.35 },
    ].forEach((voice) => {
      const osc = ctx.createOscillator();
      osc.type = voice.type;
      osc.frequency.value = voice.freq;
      const gain = ctx.createGain();
      gain.gain.value = voice.level;
      osc.connect(gain);
      gain.connect(droneGain);
      osc.start();
    });

    // Airy shimmer — filtered noise drifting overhead like the rain
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
      channel[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const shimmerFilter = ctx.createBiquadFilter();
    shimmerFilter.type = "bandpass";
    shimmerFilter.frequency.value = 1500;
    shimmerFilter.Q.value = 8;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.02;
    noise.connect(shimmerFilter);
    shimmerFilter.connect(shimmerGain);
    shimmerGain.connect(master);
    noise.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 600;
    lfo.connect(lfoDepth);
    lfoDepth.connect(shimmerFilter.frequency);
    lfo.start();

    // Proximity chord — swells as you approach a monolith
    const proxGain = ctx.createGain();
    proxGain.gain.value = 0;
    proxGain.connect(master);
    [196, 294].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(proxGain);
      osc.start();
    });

    return {
      setProximity(v: number) {
        proxGain.gain.setTargetAtTime(v * 0.06, ctx.currentTime, 0.25);
      },
      setMuted(m: boolean) {
        master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.15);
      },
      dispose() {
        ctx.close().catch(() => {});
      },
    };
  } catch {
    return null;
  }
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
  quaternion.multiply(Q_FLIP); // camera looks out the back of the device
  quaternion.multiply(qScreen.setFromAxisAngle(ZEE, -screenAngle));
}

export default function ConstructGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const lockFnRef = useRef<(() => void) | null>(null);
  const modeRef = useRef<ControlMode>("touch");
  const ambienceRef = useRef<Ambience | null>(null);
  const mutedRef = useRef(false);

  const [locked, setLocked] = useState(false);
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState<ControlMode>("touch");
  const [muted, setMuted] = useState(false);
  const [nearMonolith, setNearMonolith] = useState<number>(-1);
  const isTouch = useSyncExternalStore(
    subscribeToPointerType,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );

  const startAudio = () => {
    if (!ambienceRef.current) {
      ambienceRef.current = createAmbience(mutedRef.current);
    }
  };

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    ambienceRef.current?.setMuted(next);
  };

  const enterTouch = async (wantGyro: boolean) => {
    let nextMode: ControlMode = "touch";
    if (wantGyro) {
      // iOS requires an explicit permission grant from a user gesture
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
    startAudio();
    setEntered(true);
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // --- Scene -------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090b10);
    scene.fog = new THREE.Fog(0x090b10, 24, 145);

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      400,
    );
    camera.position.set(0, EYE_HEIGHT, 10);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

    const disposables: { dispose(): void }[] = [];

    // --- Floor grid ----------------------------------------------------------
    const grid = new THREE.GridHelper(400, 200, 0x8fb3ff, 0x26324a);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    scene.add(grid);
    disposables.push(grid.geometry, grid.material as THREE.Material);

    const floorGeometry = new THREE.PlaneGeometry(400, 400);
    const floorMaterial = new THREE.MeshBasicMaterial({
      color: 0x10141d,
      transparent: true,
      opacity: 0.9,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    scene.add(floor);
    disposables.push(floorGeometry, floorMaterial);

    // --- Monoliths -----------------------------------------------------------
    const monolithGeometry = new THREE.BoxGeometry(5, 11, 1.4);
    const monolithMaterial = new THREE.MeshBasicMaterial({ color: 0x111826 });
    const edgeGeometry = new THREE.EdgesGeometry(monolithGeometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x8fb3ff });
    disposables.push(
      monolithGeometry,
      monolithMaterial,
      edgeGeometry,
      edgeMaterial,
    );

    const monolithPositions: THREE.Vector3[] = [];
    monoliths.forEach((monolith) => {
      const [x, z] = monolith.position;
      const group = new THREE.Group();
      group.position.set(x, 5.5, z);

      group.add(new THREE.Mesh(monolithGeometry, monolithMaterial));
      group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

      const labelTexture = makeLabelTexture(monolith.title);
      const labelMaterial = new THREE.SpriteMaterial({
        map: labelTexture,
        transparent: true,
      });
      const label = new THREE.Sprite(labelMaterial);
      label.scale.set(14, 1.75, 1);
      label.position.y = 7.2;
      group.add(label);
      disposables.push(labelTexture, labelMaterial);

      const ringGeometry = new THREE.RingGeometry(2.6, 3, 48);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xf0c36a,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -5.45;
      group.add(ring);
      disposables.push(ringGeometry, ringMaterial);

      scene.add(group);
      monolithPositions.push(new THREE.Vector3(x, 0, z));
    });

    // --- Falling code rain (3D points) ----------------------------------------
    const rainGeometry = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(RAIN_COUNT * 3);
    const rainSpeeds = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i += 1) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 300;
      rainPositions[i * 3 + 1] = Math.random() * 60;
      rainPositions[i * 3 + 2] = -140 + Math.random() * 180;
      rainSpeeds[i] = 2 + Math.random() * 7;
    }
    rainGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(rainPositions, 3),
    );
    const rainMaterial = new THREE.PointsMaterial({
      color: 0x8fb3ff,
      size: 0.22,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    });
    const rain = new THREE.Points(rainGeometry, rainMaterial);
    scene.add(rain);
    disposables.push(rainGeometry, rainMaterial);

    // --- Controls state ---------------------------------------------------------
    const keys = new Set<string>();
    let yaw = 0; // spawn facing down the -z corridor of monoliths
    let pitch = 0;
    let gyroYawOffset = 0; // swipe-to-turn on top of device orientation
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

    const onKeyDown = (event: KeyboardEvent) => {
      keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
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

    // --- Touch controls: left half = move stick, right half = look/turn ----------
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
            // device handles pitch/roll; swiping turns the body
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

    // --- Animation loop ------------------------------------------------------------
    const clock = new THREE.Clock();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const velocity = new THREE.Vector3();
    let currentNear = -1;
    let animationFrame = 0;

    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      // orientation: AR-style from device sensors, or yaw/pitch from input
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

      // movement basis: where the camera faces, flattened to the floor
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-4) {
        forward.set(0, 0, -1);
      } else {
        forward.normalize();
      }
      right.crossVectors(forward, WORLD_UP); // forward × up = right-hand side

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
        camera.position.addScaledVector(velocity, MOVE_SPEED * delta);
        camera.position.x = Math.max(
          -BOUNDS.x,
          Math.min(BOUNDS.x, camera.position.x),
        );
        camera.position.z = Math.max(
          BOUNDS.zMin,
          Math.min(BOUNDS.zMax, camera.position.z),
        );
      }

      // subtle idle bob (skip in gyro mode — the sensor already moves)
      if (modeRef.current !== "gyro") {
        camera.position.y = EYE_HEIGHT + Math.sin(elapsed * 1.4) * 0.035;
      } else {
        camera.position.y = EYE_HEIGHT;
      }

      // rain fall + wrap
      const positions = rainGeometry.attributes.position
        .array as Float32Array;
      for (let i = 0; i < RAIN_COUNT; i += 1) {
        positions[i * 3 + 1] -= rainSpeeds[i] * delta;
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = 60;
        }
      }
      rainGeometry.attributes.position.needsUpdate = true;

      // proximity check
      let nearest = -1;
      let nearestDistance = REVEAL_RADIUS;
      for (let i = 0; i < monolithPositions.length; i += 1) {
        const distance = Math.hypot(
          monolithPositions[i].x - camera.position.x,
          monolithPositions[i].z - camera.position.z,
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = i;
        }
      }
      if (nearest !== currentNear) {
        currentNear = nearest;
        setNearMonolith(nearest);
      }
      ambienceRef.current?.setProximity(
        nearest === -1 ? 0 : 1 - nearestDistance / REVEAL_RADIUS,
      );

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
      ambienceRef.current?.dispose();
      ambienceRef.current = null;
    };
  }, []);

  const near = nearMonolith >= 0 ? monoliths[nearMonolith] : null;
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
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#dbe5ff]">
            immersive environment
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="pointer-events-auto rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
            >
              {muted ? "sound off" : "sound on"}
            </button>
            <Link
              href="/rabbit-hole"
              className="pointer-events-auto rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
            >
              exit
            </Link>
          </div>
        </div>

        {/* controls hint */}
        <p className="absolute inset-x-0 bottom-4 px-4 text-center text-[11px] uppercase tracking-[0.25em] text-ink-dim">
          {isTouch
            ? mode === "gyro"
              ? "move your phone to look — left thumb: walk — swipe right side: turn"
              : "left thumb: walk — right thumb: look"
            : locked
              ? "wasd / arrows: move — mouse: look — esc: release cursor"
              : "cursor released — click the scene to look around again"}
        </p>

        {/* monolith inscription */}
        {near && (
          <div className="absolute inset-x-0 bottom-14 flex justify-center px-4">
            <div className="max-w-xl rounded-lg border border-white/14 bg-[#0b1020]/88 p-5 text-center backdrop-blur-sm">
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#dbe5ff]">
                {near.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {near.inscription}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* click-to-enter overlay (desktop) */}
      {showDesktopOverlay && (
        <div
          onClick={() => {
            startAudio();
            setEntered(true);
            lockFnRef.current?.();
          }}
          className="absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center gap-6 bg-black/70 text-center"
        >
          <p className="text-2xl font-black uppercase tracking-[0.24em] text-[#dbe5ff]">
            immersive environment
          </p>
          <p className="max-w-sm px-6 text-sm leading-relaxed text-ink-soft">
            Five questions are placed in the dark. Walk up to them.
          </p>
          <p className="animate-pulse text-xs uppercase tracking-[0.3em] text-ink-dim">
            click anywhere to enter
          </p>
          <Link
            href="/rabbit-hole"
            onClick={(event) => event.stopPropagation()}
            className="z-30 mt-4 text-xs uppercase tracking-[0.22em] text-ink-dim underline-offset-4 transition-colors hover:text-[#dbe5ff] hover:underline"
          >
            back to the environment page
          </Link>
        </div>
      )}

      {/* tap-to-enter overlay (mobile) — pick control style */}
      {showTouchOverlay && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/80 px-6 text-center">
          <p className="text-2xl font-black uppercase tracking-[0.24em] text-[#dbe5ff]">
            immersive environment
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            Five questions are placed in the dark. Walk up to them.
          </p>
          <button
            type="button"
            onClick={() => enterTouch(true)}
            className="w-full max-w-xs rounded-md border border-[#8fb3ff]/60 bg-[#121826]/72 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors active:bg-[#dbe5ff] active:text-[#0b1020]"
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
            href="/rabbit-hole"
            className="mt-2 text-xs uppercase tracking-[0.22em] text-ink-dim underline-offset-4 transition-colors hover:text-[#dbe5ff]"
          >
            back to the environment page
          </Link>
        </div>
      )}
    </div>
  );
}
