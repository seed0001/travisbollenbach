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
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = "bold 64px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#00ff66";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#00ff66";
    ctx.fillText(text.toUpperCase(), canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function ConstructGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const lockFnRef = useRef<(() => void) | null>(null);
  const [locked, setLocked] = useState(false);
  const [nearMonolith, setNearMonolith] = useState<number>(-1);
  const isTouch = useSyncExternalStore(
    subscribeToPointerType,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // --- Scene -------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 20, 130);

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
    const grid = new THREE.GridHelper(400, 200, 0x00ff66, 0x043017);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    scene.add(grid);
    disposables.push(grid.geometry, grid.material as THREE.Material);

    const floorGeometry = new THREE.PlaneGeometry(400, 400);
    const floorMaterial = new THREE.MeshBasicMaterial({
      color: 0x010604,
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
    const monolithMaterial = new THREE.MeshBasicMaterial({ color: 0x010a05 });
    const edgeGeometry = new THREE.EdgesGeometry(monolithGeometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x00ff66 });
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

      // glow ring on the floor
      const ringGeometry = new THREE.RingGeometry(2.6, 3, 48);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff66,
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
      color: 0x00ff66,
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

    // --- Touch controls: left half = move stick, right half = look ---------------
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
          applyLook(
            touch.clientX - touchState.lookLast.x,
            touch.clientY - touchState.lookLast.y,
            0.0045,
          );
          touchState.lookLast.set(touch.clientX, touch.clientY);
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

      // orientation
      camera.rotation.set(0, 0, 0);
      camera.rotateY(yaw);
      camera.rotateX(pitch);

      // movement input
      forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      right.set(Math.cos(yaw), 0, -Math.sin(yaw));
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

      // subtle idle bob
      camera.position.y =
        EYE_HEIGHT + Math.sin(elapsed * 1.4) * 0.035;

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

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
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
      disposables.forEach((resource) => resource.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const near = nearMonolith >= 0 ? monoliths[nearMonolith] : null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div ref={hostRef} className="stage-fixed" />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {/* crosshair */}
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-matrix/80" />

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <p className="glow-green text-xs uppercase tracking-[0.3em] text-matrix">
            the construct
          </p>
          <Link
            href="/rabbit-hole"
            className="pointer-events-auto rounded-full border border-matrix-dim px-4 py-2 text-xs uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
          >
            jack out
          </Link>
        </div>

        {/* controls hint */}
        <p className="absolute inset-x-0 bottom-4 text-center text-[11px] uppercase tracking-[0.25em] text-ink-dim">
          {isTouch
            ? "left thumb: move — right thumb: look"
            : "wasd / arrows: move — mouse: look — esc: release cursor"}
        </p>

        {/* monolith inscription */}
        {near && (
          <div className="absolute inset-x-0 bottom-14 flex justify-center px-4">
            <div className="max-w-xl rounded-2xl border border-matrix-dim bg-black/85 p-5 text-center backdrop-blur-sm">
              <p className="glow-green text-sm font-bold uppercase tracking-[0.25em] text-matrix">
                {near.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {near.inscription}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* click-to-enter overlay (desktop only) */}
      {!locked && !isTouch && (
        <div
          onClick={() => lockFnRef.current?.()}
          className="absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center gap-6 bg-black/70 text-center"
        >
          <p className="glow-green text-2xl font-bold uppercase tracking-[0.3em] text-matrix">
            the construct
          </p>
          <p className="max-w-sm px-6 text-sm leading-relaxed text-ink-soft">
            A loading program. Five questions stand in the dark. Walk up to
            them.
          </p>
          <p className="animate-pulse text-xs uppercase tracking-[0.3em] text-ink-dim">
            click anywhere to enter
          </p>
          <Link
            href="/rabbit-hole"
            onClick={(event) => event.stopPropagation()}
            className="z-30 mt-4 text-xs uppercase tracking-[0.25em] text-ink-dim underline-offset-4 transition-colors hover:text-matrix hover:underline"
          >
            ← back to the rabbit hole
          </Link>
        </div>
      )}
    </div>
  );
}
