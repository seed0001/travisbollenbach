"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createGalaxySky } from "@/lib/galaxy";
import {
  setQuaternionFromOrientation,
  requestOrientationPermission,
} from "@/lib/orientation";
import { SHARD_COUNT, generateGalaxy, type PlanetSpec } from "@/lib/space";

// ---------------------------------------------------------------------------
// Room 01 — The Galaxy. A star fighter, nine seeded worlds, twelve shards —
// and asteroids for the phaser. Desktop flies with pointer-lock mouse flight
// (Esc frees the mouse); phones fly AR-style: move the phone to aim the ship,
// thumbs on THRUST and FIRE. Everyone in the room shows in the census,
// split desktop / mobile.
// ---------------------------------------------------------------------------

const MAX_SPEED = 90;
const BOOST_SPEED = 160;
const WORLD_RADIUS = 1100;
const COLLECT_RADIUS = 10;
const PLANET_CARD_RANGE = 60;
const ASTEROID_COUNT = 34;
const PHASER_RANGE = 520;
const PHASER_COOLDOWN_MS = 320;

type ControlMode = "desktop" | "touch" | "gyro";

type ShardResult = {
  progress?: { xp: number; galaxyShards: string[] };
  clearedNow?: boolean;
};

export default function GalaxyRoom() {
  const hostRef = useRef<HTMLDivElement>(null);
  const collectedRef = useRef<Set<string>>(new Set());
  const modeRef = useRef<ControlMode>("desktop");
  const thrustHeldRef = useRef(false);
  const fireRequestRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const flashTimerRef = useRef(0);

  const [entered, setEntered] = useState(false);
  // client-only component (ssr:false) — window exists at first render
  const [isTouch] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches,
  );
  const [mode, setMode] = useState<ControlMode>("desktop");
  const [locked, setLocked] = useState(false);
  const [everLocked, setEverLocked] = useState(false);
  const [shipReady, setShipReady] = useState(false);
  const [xp, setXp] = useState<number | null>(null);
  const [shardsHeld, setShardsHeld] = useState(0);
  const [alreadyCleared, setAlreadyCleared] = useState(false);
  const [clearedNow, setClearedNow] = useState(false);
  const [nearPlanet, setNearPlanet] = useState<PlanetSpec | null>(null);
  const [flashActive, setFlashActive] = useState(false);
  const [census, setCensus] = useState<{
    total: number;
    desktop: number;
    mobile: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.progress) return;
        setXp(d.progress.xp);
        const shards: string[] = d.progress.galaxyShards ?? [];
        collectedRef.current = new Set(shards);
        setShardsHeld(shards.length);
        if (d.progress.roomsCleared?.includes("galaxy")) setAlreadyCleared(true);
      })
      .catch(() => {});
  }, []);

  const enter = async (wantGyro: boolean) => {
    let nextMode: ControlMode = isTouch ? "touch" : "desktop";
    if (wantGyro && (await requestOrientationPermission())) nextMode = "gyro";
    modeRef.current = nextMode;
    setMode(nextMode);
    try {
      audioCtxRef.current = new AudioContext();
    } catch {
      audioCtxRef.current = null;
    }
    setEntered(true);
  };

  const pew = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(760, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(130, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  };

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

    // sun
    const sunGeo = add(new THREE.IcosahedronGeometry(64, 3));
    const sunMat = add(new THREE.MeshBasicMaterial({ color: 0xffe9b8 }));
    scene.add(new THREE.Mesh(sunGeo, sunMat));
    const sunLight = add(new THREE.PointLight(0xfff0d2, 4, 0, 0));
    scene.add(sunLight);
    const glowTex = add(
      (() => {
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
      })(),
    );
    const sunGlowMat = add(
      new THREE.SpriteMaterial({
        map: glowTex,
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
      const mat = add(
        new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(planet.hue, 0.45, 0.5),
          flatShading: true,
        }),
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

    // shards
    const shardGeo = add(new THREE.OctahedronGeometry(2.4, 0));
    const shardMat = add(
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.95 }),
    );
    const shardMeshes = new Map<string, THREE.Mesh>();
    shards.forEach((shard) => {
      if (collectedRef.current.has(shard.id)) return;
      const mesh = new THREE.Mesh(shardGeo, shardMat);
      mesh.position.set(shard.x, shard.y, shard.z);
      scene.add(mesh);
      shardMeshes.set(shard.id, mesh);
    });

    // asteroids — phaser fodder, tumbling in the dark
    const asteroidMat = add(
      new THREE.MeshLambertMaterial({ color: 0x6f665c, flatShading: true }),
    );
    const asteroidGroup = new THREE.Group();
    scene.add(asteroidGroup);
    const asteroidSpins = new Map<THREE.Object3D, THREE.Vector3>();
    const spawnAsteroid = () => {
      const size = 2.5 + Math.random() * 6;
      const geo = add(new THREE.DodecahedronGeometry(size, 0));
      const mesh = new THREE.Mesh(geo, asteroidMat);
      const angle = Math.random() * Math.PI * 2;
      const distance = 180 + Math.random() * 720;
      mesh.position.set(
        Math.cos(angle) * distance,
        (Math.random() - 0.5) * 260,
        Math.sin(angle) * distance,
      );
      asteroidGroup.add(mesh);
      asteroidSpins.set(
        mesh,
        new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5),
      );
      return mesh;
    };
    for (let i = 0; i < ASTEROID_COUNT; i += 1) spawnAsteroid();
    const respawnTimers: number[] = [];

    // impact flashes
    const flashMat = add(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xffd9a0,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const activeFlashes: { sprite: THREE.Sprite; ttl: number }[] = [];

    // --- the ship — real model only, no stand-in --------------------------------
    const ship = new THREE.Group();
    const shipModel = new THREE.Group();
    ship.add(shipModel);
    scene.add(ship);
    ship.position.set(0, 20, 620);
    let shipLoaded = false;

    new GLTFLoader().load(
      "/models/star_fighter.glb",
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        // confirmed in live flight: this asset needs -90° for the nose to lead
        model.rotation.y = -Math.PI / 2;
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const scale = 7 / Math.max(size.x, size.y, size.z, 0.001);
        model.scale.setScalar(scale);
        const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
        model.position.sub(center);
        shipModel.add(model);
        shipLoaded = true;
        setShipReady(true);
      },
      undefined,
      (err) => {
        console.error("galaxy: ship model failed to load", err);
      },
    );

    const shipLight = add(new THREE.PointLight(0xbfd4ff, 3, 40, 1.2));
    shipLight.position.set(0, 6, 8);
    ship.add(shipLight);

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

    // phaser beam
    const beamGeo = add(new THREE.CylinderGeometry(0.12, 0.12, PHASER_RANGE, 6));
    beamGeo.translate(0, PHASER_RANGE / 2, 0);
    const beamMat = add(
      new THREE.MeshBasicMaterial({
        color: 0x7ef2ff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.visible = false;
    scene.add(beam);
    let beamUntil = 0;
    let lastFireAt = 0;
    const raycaster = new THREE.Raycaster();

    // --- presence: the room census ------------------------------------------------
    let socket: WebSocket | null = null;
    let reconnectTimer = 0;
    const connect = () => {
      if (disposed) return;
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocol}://${location.host}/ws/lobby?room=galaxy`);
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.t === "census") {
            setCensus({ total: msg.total, desktop: msg.desktop, mobile: msg.mobile });
          }
        } catch {
          /* not for us */
        }
      };
      socket.onclose = () => {
        if (!disposed) reconnectTimer = window.setTimeout(connect, 5000);
      };
      socket.onerror = () => socket?.close();
    };
    connect();

    // --- collection ----------------------------------------------------------------
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

    // --- controls ---------------------------------------------------------------------
    const keys = new Set<string>();
    let throttle = 0.35;
    let pendingYaw = 0;
    let pendingPitch = 0;
    let bankAmount = 0;

    const gyro = { alpha: 0, beta: 0, gamma: 0, has: false };
    let screenAngle = THREE.MathUtils.degToRad(window.screen.orientation?.angle ?? 0);
    const gyroTarget = new THREE.Quaternion();

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha === null) return;
      gyro.alpha = THREE.MathUtils.degToRad(event.alpha);
      gyro.beta = THREE.MathUtils.degToRad(event.beta ?? 0);
      gyro.gamma = THREE.MathUtils.degToRad(event.gamma ?? 0);
      gyro.has = true;
    };
    const onScreenRotate = () => {
      screenAngle = THREE.MathUtils.degToRad(window.screen.orientation?.angle ?? 0);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.code);
      if (e.code === "Space") fireRequestRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      pendingYaw -= e.movementX * 0.0021;
      pendingPitch -= e.movementY * 0.0016;
    };
    const onMouseDown = () => {
      if (document.pointerLockElement === renderer.domElement) {
        fireRequestRef.current = true;
      }
    };
    const onPointerLockChange = () => {
      const isLocked = document.pointerLockElement === renderer.domElement;
      setLocked(isLocked);
      if (isLocked) setEverLocked(true);
    };
    const requestLock = () => {
      if (modeRef.current === "desktop") {
        const r = renderer.domElement.requestPointerLock() as unknown as
          | Promise<void>
          | undefined;
        r?.catch?.(() => {});
      }
      audioCtxRef.current?.resume().catch(() => {});
    };

    // touch steering: drag anywhere on the canvas right half (touch mode only)
    const touchState = { steerId: -1, last: new THREE.Vector2() };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      audioCtxRef.current?.resume().catch(() => {});
      if (modeRef.current !== "touch") return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX >= window.innerWidth * 0.4 && touchState.steerId === -1) {
          touchState.steerId = t.identifier;
          touchState.last.set(t.clientX, t.clientY);
        }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchState.steerId) {
          pendingYaw -= (t.clientX - touchState.last.x) * 0.004;
          pendingPitch -= (t.clientY - touchState.last.y) * 0.003;
          touchState.last.set(t.clientX, t.clientY);
        }
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touchState.steerId) touchState.steerId = -1;
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
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    window.addEventListener("deviceorientation", onOrientation);
    window.screen.orientation?.addEventListener("change", onScreenRotate);
    renderer.domElement.addEventListener("click", requestLock);
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: false });
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });
    renderer.domElement.addEventListener("touchend", onTouchEnd);
    window.addEventListener("resize", onResize);
    requestLock();

    // --- flight loop -------------------------------------------------------------------
    const clock = new THREE.Clock();
    const forward = new THREE.Vector3();
    const toCamera = new THREE.Vector3();
    const camTarget = new THREE.Vector3();
    let currentPlanet: PlanetSpec | null = null;
    let frame = 0;

    const firePhaser = (now: number) => {
      if (!shipLoaded || now - lastFireAt < PHASER_COOLDOWN_MS) return;
      lastFireAt = now;
      pew();
      beam.position.copy(ship.position).addScaledVector(forward, 5);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward);
      beam.visible = true;
      beamUntil = now + 110;
      raycaster.set(ship.position, forward);
      raycaster.far = PHASER_RANGE;
      const hit = raycaster.intersectObjects(asteroidGroup.children, false)[0];
      if (hit) {
        const target = hit.object;
        asteroidGroup.remove(target);
        asteroidSpins.delete(target);
        const flash = new THREE.Sprite(flashMat);
        flash.position.copy(hit.point);
        flash.scale.setScalar(6);
        scene.add(flash);
        activeFlashes.push({ sprite: flash, ttl: 0.5 });
        respawnTimers.push(window.setTimeout(() => {
          if (!disposed) spawnAsteroid();
        }, 15_000));
      }
    };

    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const now = performance.now();

      // throttle: keys on desktop, held button on phones
      if (modeRef.current === "desktop") {
        if (keys.has("KeyW") || keys.has("ArrowUp")) throttle += delta * 0.6;
        if (keys.has("KeyS") || keys.has("ArrowDown")) throttle -= delta * 0.6;
      } else {
        throttle += (thrustHeldRef.current ? 1.6 : -0.8) * delta;
      }
      throttle = THREE.MathUtils.clamp(throttle, modeRef.current === "desktop" ? 0 : 0.12, 1);
      const boosting = keys.has("ShiftLeft") || keys.has("ShiftRight");
      const speed = throttle * (boosting ? BOOST_SPEED : MAX_SPEED);

      // orientation
      if (modeRef.current === "gyro" && gyro.has) {
        setQuaternionFromOrientation(
          gyroTarget,
          gyro.alpha,
          gyro.beta,
          gyro.gamma,
          screenAngle,
        );
        ship.quaternion.slerp(gyroTarget, 1 - Math.exp(-8 * delta));
      } else {
        const maxStep = 2.4 * delta;
        const yawStep = THREE.MathUtils.clamp(pendingYaw, -maxStep, maxStep);
        const pitchStep = THREE.MathUtils.clamp(pendingPitch, -maxStep, maxStep);
        pendingYaw -= yawStep;
        pendingPitch -= pitchStep;
        // unused input drains away instead of piling up
        pendingYaw *= Math.exp(-8 * delta);
        pendingPitch *= Math.exp(-8 * delta);
        ship.rotateY(yawStep);
        ship.rotateX(pitchStep);
        bankAmount = THREE.MathUtils.lerp(
          bankAmount,
          THREE.MathUtils.clamp(-yawStep / Math.max(maxStep, 1e-6), -1, 1),
          1 - Math.exp(-5 * delta),
        );
        shipModel.rotation.z = bankAmount * 0.65;
      }

      ship.getWorldDirection(forward);
      forward.multiplyScalar(-1);
      ship.position.addScaledVector(forward, speed * delta);

      // soft world edge
      if (ship.position.length() > WORLD_RADIUS) {
        const home = ship.position.clone().multiplyScalar(-1).normalize();
        forward.lerp(home, 0.02).normalize();
        const m = new THREE.Matrix4().lookAt(
          ship.position,
          ship.position.clone().add(forward),
          new THREE.Vector3(0, 1, 0),
        );
        ship.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(m), 0.04);
      }
      if (ship.position.length() < 90) ship.position.setLength(90);
      for (const planet of planetMeshes) {
        const d = ship.position.distanceTo(planet.position);
        const min = planet.spec.radius + 6;
        if (d < min) {
          ship.position.sub(planet.position).setLength(min).add(planet.position);
        }
      }

      engine.scale.setScalar(1.6 + throttle * 3.2 + (boosting ? 1.4 : 0));
      engineMat.opacity = 0.35 + throttle * 0.5;

      // fire, if anyone asked
      if (fireRequestRef.current) {
        fireRequestRef.current = false;
        firePhaser(now);
      }
      if (beam.visible && now > beamUntil) beam.visible = false;

      // flashes fade
      for (let i = activeFlashes.length - 1; i >= 0; i -= 1) {
        const f = activeFlashes[i];
        f.ttl -= delta;
        f.sprite.scale.multiplyScalar(1 + delta * 4);
        f.sprite.material.opacity = Math.max(f.ttl / 0.5, 0);
        if (f.ttl <= 0) {
          scene.remove(f.sprite);
          activeFlashes.splice(i, 1);
        }
      }

      // asteroids tumble
      for (const [mesh, spin] of asteroidSpins) {
        mesh.rotation.x += spin.x * delta;
        mesh.rotation.y += spin.y * delta;
        mesh.rotation.z += spin.z * delta;
      }

      // shards spin; collect on approach
      for (const [id, mesh] of shardMeshes) {
        mesh.rotation.y += delta * 1.6;
        mesh.rotation.x += delta * 0.7;
        if (ship.position.distanceTo(mesh.position) < COLLECT_RADIUS) bank(id);
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
        const d = ship.position.distanceTo(planet.position) - planet.spec.radius;
        if (d < PLANET_CARD_RANGE && d < best) {
          best = d;
          nearest = planet.spec;
        }
      }
      if (nearest !== currentPlanet) {
        currentPlanet = nearest;
        setNearPlanet(nearest);
      }

      void elapsed;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.clearTimeout(reconnectTimer);
      respawnTimers.forEach((t) => window.clearTimeout(t));
      socket?.close();
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
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
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, [entered]);

  const showButtons = entered && isTouch;

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
              {census && (
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-sky-200/80">
                  {census.total} pilot{census.total === 1 ? "" : "s"} aboard —{" "}
                  {census.desktop} desktop · {census.mobile} mobile
                </p>
              )}
            </div>
            <Link
              href="/lobby"
              className="pointer-events-auto rounded-full border border-matrix-dim px-4 py-2 text-xs uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
            >
              dock at the nexus
            </Link>
          </div>

          {/* ship still loading */}
          {!shipReady && (
            <p className="absolute inset-x-0 top-24 text-center text-xs uppercase tracking-[0.3em] text-sky-200/80 animate-pulse">
              your fighter is inbound…
            </p>
          )}

          {/* shard pickup flash */}
          {flashActive && (
            <p className="absolute inset-x-0 top-24 text-center text-sm font-bold uppercase tracking-[0.3em] text-sky-200">
              shard secured +5 xp
            </p>
          )}

          {/* paused (desktop) */}
          {!isTouch && !locked && everLocked && !clearedNow && (
            <div className="absolute inset-x-0 top-32 flex justify-center">
              <p className="rounded-full border border-white/20 bg-black/60 px-5 py-2 text-[11px] uppercase tracking-[0.25em] text-white/85 backdrop-blur-sm">
                paused — mouse free · click space to fly again
              </p>
            </div>
          )}

          {/* planet card */}
          {nearPlanet && (
            <div className="absolute inset-x-0 bottom-24 flex justify-center px-4">
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
            {isTouch
              ? mode === "gyro"
                ? "move your phone to aim — hold thrust to fly — tap fire"
                : "drag right side to steer — hold thrust — tap fire"
              : "mouse: steer — w/s: throttle — shift: boost — click / space: fire — esc: free the mouse"}
          </p>
        </div>
      )}

      {/* thumb controls (phones) */}
      {showButtons && (
        <div className="absolute inset-x-0 bottom-14 z-20 flex items-end justify-between px-6">
          <button
            type="button"
            onPointerDown={() => (fireRequestRef.current = true)}
            className="h-20 w-20 rounded-full border-2 border-rose-300/70 bg-rose-500/25 text-xs font-bold uppercase tracking-widest text-rose-100 backdrop-blur-sm active:bg-rose-400/60"
          >
            fire
          </button>
          <button
            type="button"
            onPointerDown={() => (thrustHeldRef.current = true)}
            onPointerUp={() => (thrustHeldRef.current = false)}
            onPointerLeave={() => (thrustHeldRef.current = false)}
            onPointerCancel={() => (thrustHeldRef.current = false)}
            className="h-24 w-24 rounded-full border-2 border-sky-300/70 bg-sky-500/25 text-xs font-bold uppercase tracking-widest text-sky-100 backdrop-blur-sm active:bg-sky-400/60"
          >
            thrust
          </button>
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
            Beyond this gate there is no floor. A star fighter is waiting.
            Somewhere between the sun and nine uncharted worlds, twelve shards
            of light are drifting — and the asteroids are fair game for your
            phaser.
          </p>
          <p className="text-xs uppercase tracking-[0.25em] text-ink-dim">
            {alreadyCleared
              ? "you have swept this galaxy before — fly for the joy of it"
              : `${shardsHeld}/${SHARD_COUNT} shards recovered so far`}
          </p>
          {isTouch ? (
            <>
              <button
                type="button"
                onClick={() => enter(true)}
                className="w-full max-w-xs rounded-full border border-matrix bg-matrix-dark/60 px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-matrix transition-colors active:bg-matrix active:text-black"
              >
                fly with motion controls
                <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-ink-soft">
                  move your phone to aim the ship, AR style
                </span>
              </button>
              <button
                type="button"
                onClick={() => enter(false)}
                className="w-full max-w-xs rounded-full border border-matrix-dim px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-ink-soft transition-colors active:bg-matrix active:text-black"
              >
                fly with touch controls
                <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-ink-dim">
                  drag to steer, thumbs for thrust and fire
                </span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => enter(false)}
              className="w-full max-w-xs rounded-full border border-matrix bg-matrix-dark/60 px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
            >
              board the fighter
            </button>
          )}
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
