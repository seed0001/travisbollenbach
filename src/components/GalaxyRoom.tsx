"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createGalaxySky } from "@/lib/galaxy";
import {
  SHARD_COUNT,
  generateGalaxy,
  type PlanetSpec,
} from "@/lib/space";

// ---------------------------------------------------------------------------
// Room 01 — The Galaxy. Step through the gate and you're in open space with
// a star fighter: a sun, nine seeded planets, and twelve shards of light
// hidden among them. Fly, explore, bring them all home.
//
// Flight is arcade mouse-flight: the ship steers toward where your cursor
// sits relative to screen center (no pointer lock), W/S is throttle, shift
// is boost. On touch: right half steers, left half is the throttle stick.
// ---------------------------------------------------------------------------

const MAX_SPEED = 90;
const BOOST_SPEED = 160;
const WORLD_RADIUS = 1100; // soft boundary — space folds you back toward the sun
const COLLECT_RADIUS = 10;
const PLANET_CARD_RANGE = 60;

type ShardResult = {
  progress?: { xp: number; galaxyShards: string[] };
  added?: boolean;
  clearedNow?: boolean;
};

// stand-in fighter, used until (or unless) the GLB loads
function buildFallbackShip(): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({
    color: 0x8a93a8,
    flatShading: true,
  });
  const accentMat = new THREE.MeshLambertMaterial({
    color: 0x3d4a63,
    flatShading: true,
  });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1, 4.4, 6), bodyMat);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.4;
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.7, 3.4, 6), bodyMat);
  hull.rotation.x = -Math.PI / 2;
  hull.position.z = 1.4;
  const wingGeo = new THREE.BoxGeometry(6.4, 0.16, 1.8);
  const wings = new THREE.Mesh(wingGeo, accentMat);
  wings.position.z = 1.6;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.6, 1.4), accentMat);
  fin.position.set(0, 0.9, 2);
  group.add(nose, hull, wings, fin);
  return group;
}

export default function GalaxyRoom() {
  const hostRef = useRef<HTMLDivElement>(null);
  const collectedRef = useRef<Set<string>>(new Set());

  const [entered, setEntered] = useState(false);
  const [xp, setXp] = useState<number | null>(null);
  const [shardsHeld, setShardsHeld] = useState(0);
  const [alreadyCleared, setAlreadyCleared] = useState(false);
  const [clearedNow, setClearedNow] = useState(false);
  const [nearPlanet, setNearPlanet] = useState<PlanetSpec | null>(null);
  const [flashActive, setFlashActive] = useState(false);
  const flashTimerRef = useRef(0);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.progress) return;
        setXp(d.progress.xp);
        const shards: string[] = d.progress.galaxyShards ?? [];
        collectedRef.current = new Set(shards);
        setShardsHeld(shards.length);
        if (d.progress.roomsCleared?.includes("galaxy")) {
          setAlreadyCleared(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!entered) return;
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;

    // --- space -----------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020308);

    const camera = new THREE.PerspectiveCamera(
      72,
      window.innerWidth / window.innerHeight,
      0.5,
      5000,
    );

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

    const sky = createGalaxySky(2400);
    scene.add(sky.mesh);
    disposables.push(sky);

    const ambient = add(new THREE.AmbientLight(0x38415c, 1.2));
    scene.add(ambient);

    // the sun
    const sunGeo = add(new THREE.IcosahedronGeometry(64, 3));
    const sunMat = add(new THREE.MeshBasicMaterial({ color: 0xffe9b8 }));
    scene.add(new THREE.Mesh(sunGeo, sunMat));
    const sunLight = add(new THREE.PointLight(0xfff0d2, 4, 0, 0));
    scene.add(sunLight);
    const glowTex = (() => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        g.addColorStop(0, "rgba(255,236,180,0.9)");
        g.addColorStop(0.4, "rgba(255,210,140,0.25)");
        g.addColorStop(1, "rgba(255,200,120,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
      }
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const sunGlowMat = add(
      new THREE.SpriteMaterial({
        map: add(glowTex),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const sunGlow = new THREE.Sprite(sunGlowMat);
    sunGlow.scale.set(420, 420, 1);
    scene.add(sunGlow);

    // planets
    const { planets, shards } = generateGalaxy();
    const planetMeshes: { spec: PlanetSpec; position: THREE.Vector3 }[] = [];
    planets.forEach((planet) => {
      const geo = add(new THREE.IcosahedronGeometry(planet.radius, 2));
      const color = new THREE.Color().setHSL(planet.hue, 0.45, 0.5);
      const mat = add(
        new THREE.MeshLambertMaterial({ color, flatShading: true }),
      );
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(planet.x, planet.y, planet.z);
      scene.add(mesh);
      if (planet.ring) {
        const ringGeo = add(
          new THREE.RingGeometry(planet.radius * 1.5, planet.radius * 2.2, 48),
        );
        const ringMat = add(
          new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL((planet.hue + 0.08) % 1, 0.4, 0.6),
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide,
          }),
        );
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(mesh.position);
        ring.rotation.x = Math.PI / 2.6;
        ring.rotation.y = planet.hue * 2;
        scene.add(ring);
      }
      planetMeshes.push({ spec: planet, position: mesh.position.clone() });
    });

    // shards — glowing octahedra; the ones already banked don't respawn
    const shardGeo = add(new THREE.OctahedronGeometry(2.4, 0));
    const shardMat = add(
      new THREE.MeshBasicMaterial({
        color: 0x9fe8ff,
        transparent: true,
        opacity: 0.95,
      }),
    );
    const shardMeshes = new Map<string, THREE.Mesh>();
    shards.forEach((shard) => {
      if (collectedRef.current.has(shard.id)) return;
      const mesh = new THREE.Mesh(shardGeo, shardMat);
      mesh.position.set(shard.x, shard.y, shard.z);
      scene.add(mesh);
      shardMeshes.set(shard.id, mesh);
    });

    // --- the ship ----------------------------------------------------------------
    const ship = new THREE.Group();
    const shipModel = new THREE.Group(); // bank/roll applied here, steering on `ship`
    ship.add(shipModel);
    let placeholder: THREE.Group | null = buildFallbackShip();
    shipModel.add(placeholder);
    scene.add(ship);
    ship.position.set(0, 20, 620);

    new GLTFLoader().load(
      "/models/star_fighter.glb",
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        // the asset's nose points +z — turn it to face -z, our flight axis
        model.rotation.y = Math.PI;
        model.updateMatrixWorld(true);
        // normalize whatever scale the asset shipped at to ~7 units long
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const scale = 7 / Math.max(size.x, size.y, size.z, 0.001);
        model.scale.setScalar(scale);
        const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
        model.position.sub(center);
        if (placeholder) {
          shipModel.remove(placeholder);
          placeholder = null;
        }
        shipModel.add(model);
      },
      undefined,
      () => {
        /* GLB missing or bad — the fallback fighter keeps flying */
      },
    );

    // the fighter carries its own fill light so it reads even with the sun
    // dead ahead (a backlit black wedge is realistic but unplayable)
    const shipLight = add(new THREE.PointLight(0xbfd4ff, 3, 40, 1.2));
    shipLight.position.set(0, 6, 8);
    ship.add(shipLight);

    // engine glow
    const engineMat = add(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0x86c8ff,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const engine = new THREE.Sprite(engineMat);
    engine.position.set(0, 0, 4);
    engine.scale.set(3, 3, 1);
    shipModel.add(engine);

    // --- controls -------------------------------------------------------------------
    const keys = new Set<string>();
    const steer = new THREE.Vector2(); // -1..1, screen-relative
    let throttle = 0.35;

    const onKeyDown = (e: KeyboardEvent) => keys.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onMouseMove = (e: MouseEvent) => {
      steer.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1,
      );
    };

    const touchState = { steerId: -1, throttleId: -1, throttleStartY: 0, throttleStart: 0 };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX >= window.innerWidth / 2 && touchState.steerId === -1) {
          touchState.steerId = t.identifier;
        } else if (touchState.throttleId === -1) {
          touchState.throttleId = t.identifier;
          touchState.throttleStartY = t.clientY;
          touchState.throttleStart = throttle;
        }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchState.steerId) {
          steer.set(
            ((t.clientX - window.innerWidth * 0.75) / (window.innerWidth * 0.25)) * 1.2,
            ((t.clientY - window.innerHeight * 0.5) / (window.innerHeight * 0.5)) * 1.2,
          );
          steer.clampScalar(-1, 1);
        } else if (t.identifier === touchState.throttleId) {
          const delta = (touchState.throttleStartY - t.clientY) / (window.innerHeight * 0.4);
          throttle = THREE.MathUtils.clamp(touchState.throttleStart + delta, 0, 1);
        }
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchState.steerId) {
          touchState.steerId = -1;
          steer.set(0, 0);
        } else if (t.identifier === touchState.throttleId) {
          touchState.throttleId = -1;
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
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: false });
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });
    renderer.domElement.addEventListener("touchend", onTouchEnd);
    window.addEventListener("resize", onResize);

    // --- collection --------------------------------------------------------------
    const bank = (shardId: string) => {
      const mesh = shardMeshes.get(shardId);
      if (!mesh) return;
      scene.remove(mesh);
      shardMeshes.delete(shardId);
      collectedRef.current.add(shardId);
      setShardsHeld(collectedRef.current.size);
      setFlashActive(true);
      window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = window.setTimeout(() => setFlashActive(false), 900);
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectShard: shardId }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: ShardResult | null) => {
          if (!d?.progress) return;
          setXp(d.progress.xp);
          if (d.clearedNow) setClearedNow(true);
        })
        .catch(() => {});
    };

    // --- flight loop ----------------------------------------------------------------
    const clock = new THREE.Clock();
    const forward = new THREE.Vector3();
    const toCamera = new THREE.Vector3();
    const camTarget = new THREE.Vector3();
    let currentPlanet: PlanetSpec | null = null;
    let frame = 0;

    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      // throttle
      if (keys.has("KeyW") || keys.has("ArrowUp")) throttle += delta * 0.6;
      if (keys.has("KeyS") || keys.has("ArrowDown")) throttle -= delta * 0.6;
      throttle = THREE.MathUtils.clamp(throttle, 0, 1);
      const boosting = keys.has("ShiftLeft") || keys.has("ShiftRight");
      const speed = throttle * (boosting ? BOOST_SPEED : MAX_SPEED);

      // steering: cursor offset turns the ship, dead zone in the middle
      const dz = 0.08;
      const yawInput = Math.abs(steer.x) > dz ? steer.x : 0;
      const pitchInput = Math.abs(steer.y) > dz ? steer.y : 0;
      ship.rotateY(-yawInput * 1.5 * delta);
      ship.rotateX(-pitchInput * 1.1 * delta);
      // bank into the turn
      shipModel.rotation.z = THREE.MathUtils.lerp(
        shipModel.rotation.z,
        -yawInput * 0.7,
        1 - Math.exp(-6 * delta),
      );

      ship.getWorldDirection(forward);
      forward.multiplyScalar(-1); // group faces -z
      ship.position.addScaledVector(forward, speed * delta);

      // soft world edge: past the boundary, ease the nose back toward the sun
      const fromSun = ship.position.length();
      if (fromSun > WORLD_RADIUS) {
        const home = ship.position.clone().multiplyScalar(-1).normalize();
        forward.lerp(home, 0.02).normalize();
        const m = new THREE.Matrix4().lookAt(
          ship.position,
          ship.position.clone().add(forward),
          new THREE.Vector3(0, 1, 0),
        );
        ship.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(m), 0.04);
      }

      // don't fly through planets or the sun
      const sunDist = ship.position.length();
      if (sunDist < 90) {
        ship.position.setLength(90);
      }
      for (const planet of planetMeshes) {
        const d = ship.position.distanceTo(planet.position);
        const min = planet.spec.radius + 6;
        if (d < min) {
          ship.position
            .sub(planet.position)
            .setLength(min)
            .add(planet.position);
        }
      }

      // engine responds to throttle
      engine.scale.setScalar(1.6 + throttle * 3.2 + (boosting ? 1.4 : 0));
      engineMat.opacity = 0.35 + throttle * 0.5;

      // shards spin and breathe
      for (const [id, mesh] of shardMeshes) {
        mesh.rotation.y += delta * 1.6;
        mesh.rotation.x += delta * 0.7;
        mesh.position.y += Math.sin(elapsed * 1.3 + mesh.position.x) * delta * 0.6;
        if (ship.position.distanceTo(mesh.position) < COLLECT_RADIUS) {
          bank(id);
        }
      }

      // chase camera
      toCamera.set(0, 4.5, 16).applyQuaternion(ship.quaternion);
      camTarget.copy(ship.position).add(toCamera);
      camera.position.lerp(camTarget, 1 - Math.exp(-5 * delta));
      camera.lookAt(
        ship.position.x + forward.x * 30,
        ship.position.y + forward.y * 30,
        ship.position.z + forward.z * 30,
      );

      // nearest planet card
      let nearest: PlanetSpec | null = null;
      let best = Infinity;
      for (const planet of planetMeshes) {
        const d =
          ship.position.distanceTo(planet.position) - planet.spec.radius;
        if (d < PLANET_CARD_RANGE && d < best) {
          best = d;
          nearest = planet.spec;
        }
      }
      if (nearest !== currentPlanet) {
        currentPlanet = nearest;
        setNearPlanet(nearest);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", onResize);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
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
              <p className="glow-green text-xs uppercase tracking-[0.3em] text-matrix">
                room 01 — the galaxy
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-ink-dim">
                {xp !== null && `${xp} xp · `}
                shards {shardsHeld}/{SHARD_COUNT}
                {alreadyCleared && " · cleared"}
              </p>
            </div>
            <Link
              href="/lobby"
              className="pointer-events-auto rounded-full border border-matrix-dim px-4 py-2 text-xs uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
            >
              dock at the nexus
            </Link>
          </div>

          {/* shard pickup flash */}
          {flashActive && (
            <p className="absolute inset-x-0 top-24 text-center text-sm font-bold uppercase tracking-[0.3em] text-sky-200">
              shard secured +5 xp
            </p>
          )}

          {/* planet card */}
          {nearPlanet && (
            <div className="absolute inset-x-0 bottom-16 flex justify-center px-4">
              <p className="rounded-2xl border border-white/15 bg-black/70 px-6 py-3 text-center backdrop-blur-sm">
                <span className="text-sm font-bold uppercase tracking-[0.3em] text-white/90">
                  {nearPlanet.name}
                </span>
                <span className="ml-3 text-xs uppercase tracking-[0.2em] text-ink-dim">
                  uncharted world
                </span>
              </p>
            </div>
          )}

          {/* controls hint */}
          <p className="absolute inset-x-0 bottom-4 px-4 text-center text-[11px] uppercase tracking-[0.25em] text-ink-dim">
            steer with the mouse — w/s: throttle — shift: boost — collect the
            shards of light
          </p>
        </div>
      )}

      {/* room cleared */}
      {clearedNow && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-black/85 px-6 text-center">
          <p className="glow-green text-3xl font-bold uppercase tracking-[0.3em] text-matrix">
            all shards home
          </p>
          <p className="max-w-md text-sm leading-relaxed text-ink-soft">
            Twelve shards of light, one galaxy swept clean. +100 xp, +50
            points. Room 01 is yours.
          </p>
          <div className="flex gap-3">
            <Link
              href="/lobby"
              className="rounded-full border border-matrix px-8 py-3 text-xs font-bold uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
            >
              return to the nexus →
            </Link>
            <button
              type="button"
              onClick={() => setClearedNow(false)}
              className="rounded-full border border-line px-6 py-3 text-xs uppercase tracking-[0.2em] text-ink-dim transition-colors hover:text-ink-soft"
            >
              keep flying
            </button>
          </div>
        </div>
      )}

      {/* entry overlay */}
      {!entered && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/90 px-6 text-center">
          <p className="glow-green text-2xl font-bold uppercase tracking-[0.3em] text-matrix">
            room 01 — the galaxy
          </p>
          <p className="max-w-md text-sm leading-relaxed text-ink-soft">
            Beyond this gate there is no floor. A star fighter is waiting for
            you. Somewhere between the sun and nine uncharted worlds, twelve
            shards of light are drifting — bring them all home.
          </p>
          <p className="text-xs uppercase tracking-[0.25em] text-ink-dim">
            {alreadyCleared
              ? "you have swept this galaxy before — fly for the joy of it"
              : `${shardsHeld}/${SHARD_COUNT} shards recovered so far`}
          </p>
          <button
            type="button"
            onClick={() => setEntered(true)}
            className="w-full max-w-xs rounded-full border border-matrix bg-matrix-dark/60 px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
          >
            board the fighter
          </button>
          <Link
            href="/lobby"
            className="text-xs uppercase tracking-[0.25em] text-ink-dim underline-offset-4 transition-colors hover:text-matrix"
          >
            ← back to the nexus
          </Link>
        </div>
      )}
    </div>
  );
}
