"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import * as THREE from "three";

// A reusable first-person walking stage. It owns the scene, camera, renderer,
// desktop pointer-lock / touch / gyro controls, and the animation loop; the
// caller populates the world through `build` and returns a handle describing
// what to update each frame and which spots the visitor can walk up to.
//
// The Construct (ConstructGame) predates this and keeps its own bespoke loop
// because it also carries the multiplayer lobby. WalkWorld is the lean version
// the Gateway hub and the Portfolio walk share.

export type Interactable = {
  id: string;
  x: number;
  z: number;
  radius: number;
  accent?: string;
  eyebrow?: string;
  title?: string;
  blurb?: string;
  prompt?: string; // e.g. "Enter the portfolio" / "Read it up close"
  onInteract?: () => void;
};

export type WorldHandle = {
  interactables?: Interactable[];
  update?: (
    elapsed: number,
    delta: number,
    camera: THREE.PerspectiveCamera,
  ) => void;
  disposables?: { dispose(): void }[];
  dispose?: () => void;
};

type ControlMode = "touch" | "gyro";

type Props = {
  build: (scene: THREE.Scene) => WorldHandle;
  spawn?: { x?: number; z?: number; yaw?: number };
  bounds: { x: number; zMin: number; zMax: number };
  background?: number;
  fog?: { color: number; near: number; far: number };
  eyeHeight?: number;
  moveSpeed?: number;
  paused?: boolean; // freeze movement + release the cursor (e.g. a reader overlay is open)
  overlay: { kicker: string; title: string; intro: string; enter: string };
  hint: { desktop: string; touch: string };
  topRight?: ReactNode;
  exitHref?: string;
  exitLabel?: string;
};

function subscribeToPointerType(callback: () => void) {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
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

export default function WalkWorld({
  build,
  spawn,
  bounds,
  background = 0x090b10,
  fog,
  eyeHeight = 2.2,
  moveSpeed = 12,
  paused = false,
  overlay,
  hint,
  topRight,
  exitHref = "/",
  exitLabel = "exit",
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const buildRef = useRef(build);
  const modeRef = useRef<ControlMode>("touch");
  const lockFnRef = useRef<(() => void) | null>(null);
  const pausedRef = useRef(paused);
  const enteredRef = useRef(false);
  const nearRef = useRef<Interactable | null>(null);
  const interactablesRef = useRef<Interactable[]>([]);

  const [entered, setEntered] = useState(false);
  const [locked, setLocked] = useState(false);
  const [near, setNear] = useState<Interactable | null>(null);

  const isTouch = useSyncExternalStore(
    subscribeToPointerType,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );

  useEffect(() => {
    buildRef.current = build;
  }, [build]);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused && document.pointerLockElement) document.exitPointerLock();
  }, [paused]);

  // Trigger the interactable the visitor is standing next to (E / tap button).
  const triggerNear = () => {
    const target = nearRef.current;
    if (!target?.onInteract) return;
    if (document.pointerLockElement) document.exitPointerLock();
    target.onInteract();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (event.code === "KeyE" && !pausedRef.current) triggerNear();
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
    enteredRef.current = true;
    setEntered(true);
  };

  const enterDesktop = () => {
    enteredRef.current = true;
    setEntered(true);
    lockFnRef.current?.();
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // --- Scene / camera / renderer -----------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(background);
    if (fog) scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.35);
    scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xdbe5ff, 1.5);
    keyLight.position.set(6, 14, 8);
    scene.add(keyLight);
    const hemiLight = new THREE.HemisphereLight(0xbcd0ff, 0x0b1020, 0.75);
    scene.add(hemiLight);

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      500,
    );
    camera.position.set(spawn?.x ?? 0, eyeHeight, spawn?.z ?? 12);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

    // --- Build the world ----------------------------------------------------
    const handle = buildRef.current(scene);
    interactablesRef.current = handle.interactables ?? [];

    // --- Controls -----------------------------------------------------------
    const keys = new Set<string>();
    let yaw = spawn?.yaw ?? 0;
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

    const applyLook = (dx: number, dy: number, sensitivity: number) => {
      yaw -= dx * sensitivity;
      pitch -= dy * sensitivity;
      pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      applyLook(event.movementX, event.movementY, 0.0022);
    };
    const onPointerLockChange = () => {
      setLocked(document.pointerLockElement === renderer.domElement);
    };
    const requestLock = () => {
      if (
        !pausedRef.current &&
        !window.matchMedia("(pointer: coarse)").matches
      ) {
        renderer.domElement.requestPointerLock();
      }
    };
    lockFnRef.current = requestLock;

    // Touch: left half walks, right half looks / turns.
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

    // --- Animation loop -----------------------------------------------------
    const clock = new THREE.Clock();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const velocity = new THREE.Vector3();
    let animationFrame = 0;
    let currentNearId: string | null = null;

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
      if (forward.lengthSq() < 1e-4) forward.set(0, 0, -1);
      else forward.normalize();
      right.crossVectors(forward, WORLD_UP);

      velocity.set(0, 0, 0);
      if (enteredRef.current && !pausedRef.current) {
        if (keys.has("KeyW") || keys.has("ArrowUp")) velocity.add(forward);
        if (keys.has("KeyS") || keys.has("ArrowDown")) velocity.sub(forward);
        if (keys.has("KeyD") || keys.has("ArrowRight")) velocity.add(right);
        if (keys.has("KeyA") || keys.has("ArrowLeft")) velocity.sub(right);
        if (touchState.moveId !== -1) {
          velocity.addScaledVector(forward, -touchState.moveDelta.y);
          velocity.addScaledVector(right, touchState.moveDelta.x);
        }
      }

      if (velocity.lengthSq() > 0) {
        if (velocity.lengthSq() > 1) velocity.normalize();
        camera.position.addScaledVector(velocity, moveSpeed * delta);
        camera.position.x = Math.max(
          -bounds.x,
          Math.min(bounds.x, camera.position.x),
        );
        camera.position.z = Math.max(
          bounds.zMin,
          Math.min(bounds.zMax, camera.position.z),
        );
      }

      if (modeRef.current !== "gyro") {
        camera.position.y = eyeHeight + Math.sin(elapsed * 1.4) * 0.035;
      } else {
        camera.position.y = eyeHeight;
      }

      handle.update?.(elapsed, delta, camera);

      // Which walk-up spot are we standing in? (nearest within its radius)
      let found: Interactable | null = null;
      let bestDistance = Infinity;
      for (const item of interactablesRef.current) {
        const distance = Math.hypot(
          item.x - camera.position.x,
          item.z - camera.position.z,
        );
        if (distance < item.radius && distance < bestDistance) {
          bestDistance = distance;
          found = item;
        }
      }
      if ((found?.id ?? null) !== currentNearId) {
        currentNearId = found?.id ?? null;
        nearRef.current = found;
        setNear(found);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      lockFnRef.current = null;
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
      handle.dispose?.();
      handle.disposables?.forEach((resource) => resource.dispose());
      scene.clear();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#dbe5ff]">
            {overlay.kicker}
          </p>
          <div className="flex items-center gap-2">
            {topRight}
            <Link
              href={exitHref}
              className="pointer-events-auto rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
            >
              {exitLabel}
            </Link>
          </div>
        </div>

        {/* controls hint */}
        {entered && (
          <p className="absolute inset-x-0 bottom-4 px-4 text-center text-[11px] uppercase tracking-[0.25em] text-ink-dim">
            {isTouch
              ? hint.touch
              : locked
                ? hint.desktop
                : "cursor released — click the scene to look around again"}
          </p>
        )}

        {/* walk-up placard */}
        {entered && near && !paused && (
          <div className="absolute inset-x-0 bottom-14 flex justify-center px-4">
            <div
              className="max-w-md rounded-lg border bg-[#0b1020]/88 p-5 text-center backdrop-blur-sm"
              style={{ borderColor: `${near.accent ?? "#8fb3ff"}66` }}
            >
              {near.eyebrow && (
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.28em]"
                  style={{ color: near.accent ?? "#8fb3ff" }}
                >
                  {near.eyebrow}
                </p>
              )}
              {near.title && (
                <p className="mt-1.5 text-lg font-black tracking-tight text-[#dbe5ff]">
                  {near.title}
                </p>
              )}
              {near.blurb && (
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {near.blurb}
                </p>
              )}
              {near.onInteract && (
                <button
                  type="button"
                  onClick={triggerNear}
                  className="pointer-events-auto mt-4 inline-block rounded-md border bg-[#121826]/72 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
                  style={{ borderColor: `${near.accent ?? "#8fb3ff"}99` }}
                >
                  {near.prompt ?? "Enter"}
                  <span className="ml-2 hidden text-[10px] text-ink-dim sm:inline">
                    or press E
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* enter overlay (desktop) */}
      {showDesktopOverlay && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-black/80 px-6 py-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#8fb3ff]">
            {overlay.kicker}
          </p>
          <p className="max-w-md text-3xl font-black tracking-tight text-[#dbe5ff]">
            {overlay.title}
          </p>
          <p className="max-w-md text-sm leading-relaxed text-ink-soft">
            {overlay.intro}
          </p>
          <button
            type="button"
            onClick={enterDesktop}
            className="w-full max-w-xs rounded-md border border-[#8fb3ff]/60 bg-[#121826]/72 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
          >
            {overlay.enter}
          </button>
        </div>
      )}

      {/* enter overlay (mobile) — pick a control style */}
      {showTouchOverlay && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-black/85 px-6 py-10 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#8fb3ff]">
            {overlay.kicker}
          </p>
          <p className="max-w-md text-2xl font-black tracking-tight text-[#dbe5ff]">
            {overlay.title}
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            {overlay.intro}
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
        </div>
      )}
    </div>
  );
}
