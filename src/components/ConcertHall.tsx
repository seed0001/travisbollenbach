"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import {
  createConcertPerformer,
  type ConcertPerformer,
} from "@/lib/luna/createConcertPerformer";
import { DEFAULT_AVATAR_NAME } from "@/lib/luna/avatar/VRMAvatarController";
import {
  splitFullSong,
  stemsAsFiles,
} from "@/lib/luna/audio/stemSplitClient";
import {
  DEFAULT_CONCERT_TRACK,
  DEFAULT_LINEUP,
  LUNA_CONCERT_TRACKS,
  LUNA_SCALE_DEFAULT,
  STAGE_LINEUPS,
  customUploadTrack,
  type ConcertTrack,
  type StageLineup,
} from "@/lib/luna/concertConfig";
import {
  MENU_BOARD_POS,
  MENU_BOARD_RADIUS,
  createMenuBoard,
} from "@/lib/luna/stageMenuBoard";
import LunaStageMenu from "@/components/LunaStageMenu";

// ============================================================================
// The Concert Hall — a very large, multi-level hall "in the round".
//
// A sunken stage sits at the dead center, at the bottom. Concentric tiers
// (balconies) rise outward and upward around it, so from any upper level you
// look DOWN across the void at the stage. Luna performs at center stage with
// lip sync, expressions, and beat-synced motion from the Luna Singing SDK.
//
// Everything uses the site's unlit neon material language (MeshBasicMaterial).
// ============================================================================

const ACCENT = "#8b5cf6"; // stage / house accent — swap to taste
const RIM = "#22d3ee"; // cool trim on railings & rings
const EYE_HEIGHT = 2.0; // camera height above whatever floor you're on
const MOVE_SPEED = 16; // metres/sec — hall is big, so move quick
const RAMP_HALF = 0.13; // half-arc (radians) of a ramp sector

// --- The hall's cross-section, from the center out --------------------------
// Each level is a flat annular floor. The radial GAPS between them are open
// voids (you can look/fall-off is blocked by railings) except where a ramp
// sector bridges two levels.
type Level = { inner: number; outer: number; y: number };
const LEVELS: Level[] = [
  { inner: 0, outer: 22, y: 0 }, // 0 · the stage floor (lowest, center)
  { inner: 36, outer: 60, y: 6 }, // 1 · orchestra / first ring
  { inner: 74, outer: 98, y: 13 }, // 2 · mezzanine
  { inner: 112, outer: 136, y: 21 }, // 3 · balcony
  { inner: 150, outer: 176, y: 30 }, // 4 · gallery + main entrance
];
const OUTER_R = LEVELS[LEVELS.length - 1].outer; // interior wall radius
const DOME_R = OUTER_R + 6;
const STAGE_R = LEVELS[0].outer;

// Ramp sectors bridging each gap (gap i connects LEVELS[i] ↔ LEVELS[i+1]).
// Two ramps per gap, on opposite sides, rotated a bit each ring so the descent
// spirals down toward the stage.
const RAMP_ANGLES: number[][] = LEVELS.slice(0, -1).map((_, i) => {
  const base = (i * Math.PI) / 4;
  return [base, base + Math.PI];
});

function subscribeToPointerType(callback: () => void) {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function angularDist(a: number, b: number) {
  let d = Math.abs(a - b) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

// Where is the floor at (x, z)? Returns the walkable height, or null for void
// (the open gaps between tiers). This is what makes the hall multi-level:
// movement is blocked over voids, and the camera eases to whatever level or
// ramp you're standing on.
function floorAt(x: number, z: number): number | null {
  const r = Math.hypot(x, z);
  const ang = Math.atan2(z, x);

  for (const lvl of LEVELS) {
    if (r >= lvl.inner && r <= lvl.outer) return lvl.y;
  }
  for (let i = 0; i < LEVELS.length - 1; i += 1) {
    const lo = LEVELS[i];
    const hi = LEVELS[i + 1];
    if (r > lo.outer && r < hi.inner) {
      for (const a of RAMP_ANGLES[i]) {
        if (angularDist(ang, a) < RAMP_HALF) {
          const t = (r - lo.outer) / (hi.inner - lo.outer);
          return THREE.MathUtils.lerp(lo.y, hi.y, t);
        }
      }
      return null; // open void between tiers
    }
  }
  return null; // outside the outer wall
}

export default function ConcertHall({
  track: initialTrack = DEFAULT_CONCERT_TRACK,
}: {
  track?: ConcertTrack;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lockFnRef = useRef<(() => void) | null>(null);
  const overlayOpenRef = useRef(true);
  const performerRef = useRef<ConcertPerformer | null>(null);
  const customTrackRef = useRef<ConcertTrack | null>(null);
  const pendingPlayRef = useRef(false);
  const initialTrackRef = useRef(initialTrack);
  const selectedTrackIdRef = useRef(initialTrack.id);
  const lunaScaleRef = useRef(LUNA_SCALE_DEFAULT);
  const enteredRef = useRef(false);
  const nearMenuRef = useRef(false);

  const [entered, setEntered] = useState(false);
  const [locked, setLocked] = useState(false);
  const [performerStatus, setPerformerStatus] = useState("Loading Luna…");
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState(initialTrack.id);
  const [trackLoading, setTrackLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nearMenuBoard, setNearMenuBoard] = useState(false);
  const [lunaScale, setLunaScale] = useState(LUNA_SCALE_DEFAULT);
  const [avatarName, setAvatarName] = useState(DEFAULT_AVATAR_NAME);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [lineupId, setLineupId] = useState(DEFAULT_LINEUP.id);
  const lineupRef = useRef<StageLineup>(DEFAULT_LINEUP);
  const isTouch = useSyncExternalStore(
    subscribeToPointerType,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );

  useEffect(() => {
    selectedTrackIdRef.current = selectedTrackId;
  }, [selectedTrackId]);

  useEffect(() => {
    enteredRef.current = entered;
  }, [entered]);

  useEffect(() => {
    lunaScaleRef.current = lunaScale;
    performerRef.current?.setScale(lunaScale);
  }, [lunaScale]);

  useEffect(() => {
    overlayOpenRef.current = !entered && !menuOpen;
  }, [entered, menuOpen]);

  const selectedTrack =
    customTrackRef.current?.id === selectedTrackId
      ? customTrackRef.current
      : LUNA_CONCERT_TRACKS.find((t) => t.id === selectedTrackId) ??
        DEFAULT_CONCERT_TRACK;

  const loadTrack = useCallback(
    async (next: ConcertTrack, autoplay?: boolean) => {
      setSelectedTrackId(next.id);
      const performer = performerRef.current;
      if (!performer) return;

      setTrackLoading(true);
      try {
        await performer.loadTrack(
          next,
          autoplay ?? (entered && (isPlaying || pendingPlayRef.current)),
        );
        setIsPlaying(performer.isPlaying());
      } catch (err) {
        console.error(err);
        setPerformerStatus(
          `Track failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setTrackLoading(false);
      }
    },
    [entered, isPlaying],
  );

  const pickTrack = useCallback(
    async (next: ConcertTrack) => {
      if (next.id === selectedTrackId && !trackLoading) return;
      customTrackRef.current = null;
      await loadTrack(next);
    },
    [loadTrack, selectedTrackId, trackLoading],
  );

  const uploadSong = useCallback(
    async (file: File, title: string) => {
      setTrackLoading(true);
      try {
        const split = await splitFullSong(file, setPerformerStatus);
        const { music, vocals } = stemsAsFiles(split);
        const track = customUploadTrack(title, music, vocals);
        customTrackRef.current = track;
        await loadTrack(track);
      } catch (err) {
        console.error(err);
        setPerformerStatus(
          `Track failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        setTrackLoading(false);
      }
    },
    [loadTrack],
  );

  const uploadAvatar = useCallback(async (file: File) => {
    const performer = performerRef.current;
    if (!performer) return;
    setAvatarLoading(true);
    try {
      await performer.loadAvatar({ kind: "file", file });
    } catch (err) {
      console.error(err);
    } finally {
      setAvatarName(performerRef.current?.getAvatarName() ?? DEFAULT_AVATAR_NAME);
      setAvatarLoading(false);
    }
  }, []);

  // Swap the stage lineup: lead singer, plus optional duet partner. Both
  // singers share the playing stems, so the song never stops mid-swap.
  const applyLineup = useCallback(async (lineup: StageLineup) => {
    lineupRef.current = lineup;
    setLineupId(lineup.id);
    const performer = performerRef.current;
    if (!performer) return;
    setAvatarLoading(true);
    try {
      if (performer.getAvatarName() !== lineup.lead.name) {
        await performer.loadAvatar({
          kind: "url",
          url: lineup.lead.url,
          name: lineup.lead.name,
        });
      }
      await performer.setDuetPartner(lineup.partner);
    } catch (err) {
      console.error(err);
    } finally {
      setAvatarName(performerRef.current?.getAvatarName() ?? DEFAULT_AVATAR_NAME);
      setAvatarLoading(false);
    }
  }, []);

  const resetAvatar = useCallback(async () => {
    await applyLineup(DEFAULT_LINEUP);
  }, [applyLineup]);

  const startPerformance = useCallback(async () => {
    const performer = performerRef.current;
    if (!performer || performer.isPlaying()) return;
    await performer.play();
    setIsPlaying(true);
  }, []);

  const enterDesktop = () => {
    enteredRef.current = true;
    setEntered(true);
    pendingPlayRef.current = true;
    lockFnRef.current?.();
    void startPerformance();
  };
  const enterTouch = () => {
    enteredRef.current = true;
    setEntered(true);
    pendingPlayRef.current = true;
    void startPerformance();
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const accent = new THREE.Color(ACCENT);
    const rim = new THREE.Color(RIM);
    const disposables: { dispose(): void }[] = [];

    // --- Scene / camera / renderer ----------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03040a);
    scene.fog = new THREE.Fog(0x03040a, 80, 340);

    const camera = new THREE.PerspectiveCamera(
      68,
      window.innerWidth / window.innerHeight,
      0.1,
      800,
    );
    // Spawn up on the mezzanine, looking inward + down at the stage.
    const spawnLevel = LEVELS[2];
    const spawnR = (spawnLevel.inner + spawnLevel.outer) / 2;
    camera.position.set(spawnR, spawnLevel.y + EYE_HEIGHT, 0);
    camera.layers.enable(1);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xdbe5ff, 1.6);
    keyLight.position.set(4, 12, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x8b5cf6, 0.45);
    fillLight.position.set(-6, 8, -4);
    scene.add(fillLight);

    // --- Shared materials (unlit neon language) ---------------------------
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x0a0e1c });
    const floorMat2 = new THREE.MeshBasicMaterial({ color: 0x0c1224 });
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x080b16,
      side: THREE.BackSide,
    });
    const railMat = new THREE.MeshBasicMaterial({ color: rim });
    const ringLineMat = new THREE.LineBasicMaterial({
      color: rim,
      transparent: true,
      opacity: 0.6,
    });
    const rampMat = new THREE.MeshBasicMaterial({ color: 0x10182e });
    const rampTrimMat = new THREE.MeshBasicMaterial({ color: accent });
    disposables.push(
      floorMat,
      floorMat2,
      wallMat,
      railMat,
      ringLineMat,
      rampMat,
      rampTrimMat,
    );

    // --- Tier floors + railings -------------------------------------------
    LEVELS.forEach((lvl, i) => {
      if (i === 0) return; // stage floor is built separately below
      const geo = new THREE.RingGeometry(lvl.inner, lvl.outer, 96, 1);
      const floor = new THREE.Mesh(geo, i % 2 ? floorMat2 : floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = lvl.y;
      scene.add(floor);
      disposables.push(geo);

      // Glowing edge lines at the inner (over-the-void) and outer edges.
      for (const edge of [lvl.inner, lvl.outer]) {
        const pts: THREE.Vector3[] = [];
        for (let a = 0; a <= 96; a += 1) {
          const t = (a / 96) * Math.PI * 2;
          pts.push(
            new THREE.Vector3(Math.cos(t) * edge, lvl.y + 0.02, Math.sin(t) * edge),
          );
        }
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        scene.add(new THREE.LineLoop(lineGeo, ringLineMat));
        disposables.push(lineGeo);
      }

      // Railing at the inner edge — a torus you can lean over to see the stage.
      const railGeo = new THREE.TorusGeometry(lvl.inner, 0.16, 8, 120);
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.y = lvl.y + 1.1;
      scene.add(rail);
      disposables.push(railGeo);

      // A few vertical posts so the railing reads as a balcony.
      const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6);
      disposables.push(postGeo);
      const posts = 48;
      const postMesh = new THREE.InstancedMesh(postGeo, railMat, posts);
      const m = new THREE.Matrix4();
      for (let p = 0; p < posts; p += 1) {
        const t = (p / posts) * Math.PI * 2;
        m.makeTranslation(
          Math.cos(t) * lvl.inner,
          lvl.y + 0.55,
          Math.sin(t) * lvl.inner,
        );
        postMesh.setMatrixAt(p, m);
      }
      scene.add(postMesh);
    });

    // --- Ramps between tiers ----------------------------------------------
    for (let i = 0; i < LEVELS.length - 1; i += 1) {
      const lo = LEVELS[i];
      const hi = LEVELS[i + 1];
      const r0 = lo.outer;
      const r1 = hi.inner;
      const rm = (r0 + r1) / 2;
      const ym = (lo.y + hi.y) / 2;
      const radialLen = Math.hypot(r1 - r0, hi.y - lo.y);
      const slope = Math.atan2(hi.y - lo.y, r1 - r0);
      const width = 2 * RAMP_HALF * rm; // arc width of the sector

      for (const a of RAMP_ANGLES[i]) {
        const group = new THREE.Group();
        group.position.set(Math.cos(a) * rm, ym, Math.sin(a) * rm);
        group.rotation.y = -a;

        const deck = new THREE.Mesh(
          new THREE.BoxGeometry(radialLen, 0.3, width),
          rampMat,
        );
        deck.rotation.z = slope;
        group.add(deck);
        disposables.push(deck.geometry);

        // neon edge strips down both sides of the ramp
        for (const s of [-1, 1]) {
          const strip = new THREE.Mesh(
            new THREE.BoxGeometry(radialLen, 0.34, 0.12),
            rampTrimMat,
          );
          strip.rotation.z = slope;
          strip.position.z = (s * width) / 2;
          group.add(strip);
          disposables.push(strip.geometry);
        }
        scene.add(group);
      }
    }

    // --- Outer wall + dome -------------------------------------------------
    const topY = LEVELS[LEVELS.length - 1].y;
    const wallGeo = new THREE.CylinderGeometry(
      OUTER_R,
      OUTER_R,
      topY + 24,
      96,
      1,
      true,
    );
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = (topY + 24) / 2;
    scene.add(wall);
    disposables.push(wallGeo);

    const domeGeo = new THREE.SphereGeometry(
      DOME_R,
      48,
      24,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    const dome = new THREE.Mesh(domeGeo, wallMat);
    dome.position.y = topY + 24;
    scene.add(dome);
    const domeWire = new THREE.Mesh(
      domeGeo,
      new THREE.MeshBasicMaterial({
        color: 0x2b3f6a,
        wireframe: true,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.18,
      }),
    );
    domeWire.position.y = topY + 24;
    scene.add(domeWire);
    disposables.push(domeGeo, domeWire.material as THREE.Material);

    // Overhead star/house-light field for some life in the ceiling.
    const starCount = 500;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const t = Math.random() * Math.PI * 2;
      const p = Math.random() * Math.PI * 0.5;
      const rad = DOME_R - 2;
      starPos[i * 3] = Math.cos(t) * Math.sin(p) * rad;
      starPos[i * 3 + 1] = topY + 24 + Math.cos(p) * rad * 0.5;
      starPos[i * 3 + 2] = Math.sin(t) * Math.sin(p) * rad;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x9fb6ff,
      size: 0.5,
      transparent: true,
      opacity: 0.7,
    });
    scene.add(new THREE.Points(starGeo, starMat));
    disposables.push(starGeo, starMat);

    // --- The stage (center, lowest) ---------------------------------------
    const stageGeo = new THREE.CircleGeometry(STAGE_R, 96);
    const stageMat = new THREE.MeshBasicMaterial({ color: 0x141024 });
    const stage = new THREE.Mesh(stageGeo, stageMat);
    stage.rotation.x = -Math.PI / 2;
    stage.position.y = 0.01;
    scene.add(stage);
    disposables.push(stageGeo, stageMat);

    // Stage rim glow.
    const stageRimGeo = new THREE.TorusGeometry(STAGE_R, 0.35, 10, 120);
    const stageRimMat = new THREE.MeshBasicMaterial({ color: accent });
    const stageRim = new THREE.Mesh(stageRimGeo, stageRimMat);
    stageRim.rotation.x = Math.PI / 2;
    stageRim.position.y = 0.4;
    scene.add(stageRim);
    disposables.push(stageRimGeo, stageRimMat);

    // Spotlight beams raking down onto the stage from the rigging.
    const beamMats: THREE.MeshBasicMaterial[] = [];
    const beamGeo = new THREE.CylinderGeometry(0.6, 6, topY + 20, 20, 1, true);
    disposables.push(beamGeo);
    for (let i = 0; i < 6; i += 1) {
      const t = (i / 6) * Math.PI * 2;
      const beamMat = new THREE.MeshBasicMaterial({
        color: i % 2 ? accent : rim,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(
        Math.cos(t) * (STAGE_R * 0.5),
        (topY + 20) / 2,
        Math.sin(t) * (STAGE_R * 0.5),
      );
      scene.add(beam);
      beamMats.push(beamMat);
      disposables.push(beamMat);
    }

    createMenuBoard(scene, accent);

    // ======================================================================
    // Luna — center-stage performer (Luna Singing SDK)
    // ======================================================================
    let sceneDisposed = false;
    void createConcertPerformer(
      scene,
      initialTrackRef.current,
      (status) => {
        if (!sceneDisposed) {
          setPerformerStatus(status);
          if (status.startsWith("Playing")) setIsPlaying(true);
          if (status.startsWith("Paused") || status.startsWith("Finished")) {
            setIsPlaying(false);
          }
        }
      },
      () => lunaScaleRef.current,
    )
      .then(async (performer) => {
        if (sceneDisposed) {
          performer.dispose();
          return;
        }
        performerRef.current = performer;

        const wanted =
          LUNA_CONCERT_TRACKS.find((t) => t.id === selectedTrackIdRef.current) ??
          initialTrackRef.current;
        if (wanted.id !== performer.getTrackId()) {
          await performer.loadTrack(wanted, false);
        }

        // Apply a lineup picked on the enter overlay before the performer
        // finished loading (default lineup is what loadDefault gave us).
        const lineup = lineupRef.current;
        if (lineup.id !== DEFAULT_LINEUP.id) {
          if (performer.getAvatarName() !== lineup.lead.name) {
            await performer.loadAvatar({
              kind: "url",
              url: lineup.lead.url,
              name: lineup.lead.name,
            });
          }
          await performer.setDuetPartner(lineup.partner);
          setAvatarName(performer.getAvatarName());
        }

        if (pendingPlayRef.current) {
          await performer.play();
          setIsPlaying(true);
        }
        performer.setScale(lunaScaleRef.current);
      })
      .catch((err) => {
        console.error(err);
        if (!sceneDisposed) {
          setPerformerStatus(
            `Luna failed to load: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      });

    // ======================================================================
    // Controls — desktop pointer-lock + WASD, or dual-thumb touch. (Mirrors
    // ArenaLobby so it feels the same walking in from the street.)
    // ======================================================================
    const keys = new Set<string>();
    let yaw = Math.PI; // spawn looking toward -X (the stage is at center)
    let pitch = -0.35; // tilted down toward the stage below
    const WORLD_UP = new THREE.Vector3(0, 1, 0);

    const isTyping = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      keys.delete(e.code);
    };

    const applyLook = (dx: number, dy: number, sens: number) => {
      yaw -= dx * sens;
      pitch -= dy * sens;
      pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      applyLook(e.movementX, e.movementY, 0.0022);
    };
    const onPointerLockChange = () =>
      setLocked(document.pointerLockElement === renderer.domElement);
    const requestLock = () => {
      if (!window.matchMedia("(pointer: coarse)").matches) {
        renderer.domElement.requestPointerLock();
      }
    };
    lockFnRef.current = requestLock;

    const touch = {
      moveId: -1,
      moveStart: new THREE.Vector2(),
      moveDelta: new THREE.Vector2(),
      lookId: -1,
      lookLast: new THREE.Vector2(),
    };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX < window.innerWidth / 2 && touch.moveId === -1) {
          touch.moveId = t.identifier;
          touch.moveStart.set(t.clientX, t.clientY);
          touch.moveDelta.set(0, 0);
        } else if (touch.lookId === -1) {
          touch.lookId = t.identifier;
          touch.lookLast.set(t.clientX, t.clientY);
        }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touch.moveId) {
          touch.moveDelta.set(
            (t.clientX - touch.moveStart.x) / 60,
            (t.clientY - touch.moveStart.y) / 60,
          );
          touch.moveDelta.clampScalar(-1, 1);
        } else if (t.identifier === touch.lookId) {
          applyLook(
            t.clientX - touch.lookLast.x,
            t.clientY - touch.lookLast.y,
            0.0045,
          );
          touch.lookLast.set(t.clientX, t.clientY);
        }
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === touch.moveId) {
          touch.moveId = -1;
          touch.moveDelta.set(0, 0);
        } else if (t.identifier === touch.lookId) {
          touch.lookId = -1;
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

    // --- Animation loop ----------------------------------------------------
    const clock = new THREE.Clock();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const velocity = new THREE.Vector3();
    let currentFloorY = spawnLevel.y;
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
      right.crossVectors(forward, WORLD_UP);

      velocity.set(0, 0, 0);
      if (keys.has("KeyW") || keys.has("ArrowUp")) velocity.add(forward);
      if (keys.has("KeyS") || keys.has("ArrowDown")) velocity.sub(forward);
      if (keys.has("KeyD") || keys.has("ArrowRight")) velocity.add(right);
      if (keys.has("KeyA") || keys.has("ArrowLeft")) velocity.sub(right);
      if (touch.moveId !== -1) {
        velocity.addScaledVector(forward, -touch.moveDelta.y);
        velocity.addScaledVector(right, touch.moveDelta.x);
      }
      if (overlayOpenRef.current) velocity.set(0, 0, 0);

      const nearMenuNow =
        Math.hypot(
          camera.position.x - MENU_BOARD_POS.x,
          camera.position.z - MENU_BOARD_POS.z,
        ) < MENU_BOARD_RADIUS;
      if (nearMenuNow !== nearMenuRef.current) {
        nearMenuRef.current = nearMenuNow;
        setNearMenuBoard(nearMenuNow);
      }

      if (velocity.lengthSq() > 0) {
        if (velocity.lengthSq() > 1) velocity.normalize();
        const nx = camera.position.x + velocity.x * MOVE_SPEED * delta;
        const nz = camera.position.z + velocity.z * MOVE_SPEED * delta;
        const fy = floorAt(nx, nz);
        if (fy !== null) {
          // walkable — step, and remember which level/ramp we're on
          camera.position.x = nx;
          camera.position.z = nz;
          currentFloorY = fy;
        }
        // else: void or wall ahead — hold position (soft railing)
      }

      // ease eye height to the floor we're standing on (smooth ramp descent)
      const targetY = currentFloorY + EYE_HEIGHT;
      camera.position.y += (targetY - camera.position.y) * Math.min(1, delta * 8);

      // pulse the stage beams
      const pulse = 0.06 + Math.sin(elapsed * 1.6) * 0.03;
      for (const m of beamMats) m.opacity = pulse;

      performerRef.current?.setAudienceTarget(
        enteredRef.current ? camera.position : null,
      );
      performerRef.current?.update(delta);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      sceneDisposed = true;
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
      performerRef.current?.dispose();
      performerRef.current = null;
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  const togglePerformance = async () => {
    const performer = performerRef.current;
    if (!performer) return;
    await performer.togglePlayPause();
    setIsPlaying(performer.isPlaying());
  };

  const showOverlay = !entered;

  const lineupPicker = (
    <div
      className="flex w-full max-w-md flex-col gap-3"
      role="group"
      aria-label="Stage lineup"
    >
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-ink-dim">
        Singers
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        {STAGE_LINEUPS.map((lineup) => {
          const active = lineup.id === lineupId;
          return (
            <button
              key={lineup.id}
              type="button"
              disabled={avatarLoading}
              onClick={() => void applyLineup(lineup)}
              className="w-full rounded-md border px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors disabled:opacity-45 sm:w-auto"
              style={{
                borderColor: active ? ACCENT : "rgba(255,255,255,0.18)",
                backgroundColor: active ? `${ACCENT}22` : "rgba(255,255,255,0.055)",
                color: active ? "#dbe5ff" : "rgba(219,229,255,0.72)",
              }}
            >
              {lineup.label}
            </button>
          );
        })}
      </div>
      {avatarLoading && (
        <p className="text-center text-[10px] uppercase tracking-[0.18em] text-ink-dim">
          Loading performer…
        </p>
      )}
    </div>
  );

  const setlistPicker = (compact = false) => (
    <div
      className={
        compact
          ? "pointer-events-auto flex flex-wrap items-center justify-center gap-2"
          : "flex w-full max-w-md flex-col gap-3"
      }
      role="group"
      aria-label="Concert setlist"
    >
      {!compact && (
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-ink-dim">
          Setlist
        </p>
      )}
      <div
        className={
          compact
            ? "flex flex-wrap items-center justify-center gap-2"
            : "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center"
        }
      >
        {LUNA_CONCERT_TRACKS.map((item) => {
          const active = item.id === selectedTrackId;
          return (
            <button
              key={item.id}
              type="button"
              disabled={trackLoading}
              onClick={() => void pickTrack(item)}
              className={
                compact
                  ? "rounded-md border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors disabled:opacity-45"
                  : "w-full rounded-md border px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors disabled:opacity-45 sm:w-auto"
              }
              style={{
                borderColor: active ? ACCENT : "rgba(255,255,255,0.18)",
                backgroundColor: active ? `${ACCENT}22` : "rgba(255,255,255,0.055)",
                color: active ? "#dbe5ff" : "rgba(219,229,255,0.72)",
              }}
            >
              {item.title}
            </button>
          );
        })}
      </div>
      {trackLoading && (
        <p className="text-center text-[10px] uppercase tracking-[0.18em] text-ink-dim">
          Loading track…
        </p>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div ref={hostRef} className="stage-fixed" />

      <LunaStageMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        lunaScale={lunaScale}
        onLunaScaleChange={setLunaScale}
        selectedTrackId={selectedTrackId}
        onPickTrack={(t) => void pickTrack(t)}
        onUploadSong={(file, title) => void uploadSong(file, title)}
        trackLoading={trackLoading}
        avatarName={avatarName}
        avatarLoading={avatarLoading}
        lineupId={lineupId}
        onPickLineup={(lineup) => void applyLineup(lineup)}
        onUploadAvatar={(file) => void uploadAvatar(file)}
        onResetAvatar={() => void resetAvatar()}
        status={performerStatus}
      />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#dbe5ff]/80" />

        <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-2 p-4">
          <p
            className="text-xs font-bold uppercase tracking-[0.24em]"
            style={{ color: ACCENT }}
          >
            The Concert Hall · Luna live
          </p>
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            {entered && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
                style={{ borderColor: `${ACCENT}66` }}
              >
                stage menu
              </button>
            )}
            {entered && (
              <button
                type="button"
                onClick={() => void togglePerformance()}
                className="rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
                style={{ borderColor: `${ACCENT}66` }}
              >
                {isPlaying ? "pause set" : "play set"}
              </button>
            )}
            {entered && (
              <Link
                href="/rabbit-hole/game"
                className="rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
              >
                leave the hall
              </Link>
            )}
          </div>
        </div>

        {entered && (
          <p
            className="absolute inset-x-0 top-[4.5rem] px-4 text-center text-[11px] uppercase tracking-[0.2em] text-ink-soft sm:top-20"
          >
            {performerStatus}
          </p>
        )}

        {entered && nearMenuBoard && !menuOpen && (
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="pointer-events-auto absolute bottom-16 left-1/2 -translate-x-1/2 rounded-md border bg-[#121826]/90 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff]"
            style={{ borderColor: `${ACCENT}99` }}
          >
            open stage menu board
          </button>
        )}

        <p className="absolute inset-x-0 bottom-4 px-4 text-center text-[11px] uppercase tracking-[0.25em] text-ink-dim">
          {isTouch
            ? "left thumb: walk — right thumb: look — leave the hall up top"
            : locked
              ? "wasd / arrows: move — mouse: look — esc: free the cursor for the buttons"
              : "cursor released — click the scene to look around, or leave the hall up top"}
        </p>
      </div>

      {/* enter overlay */}
      {showOverlay && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-black/80 px-6 py-10 text-center">
          <p
            className="text-2xl font-black uppercase tracking-[0.24em]"
            style={{ color: ACCENT }}
          >
            The Concert Hall
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            A hall in the round: the stage sits at the bottom center, ringed by
            balconies that climb outward. Walk the tiers, lean over a railing,
            or follow a ramp down to the floor. Pick your singers — solo or
            duet — and a song. The stage menu board on the floor has the rest.
          </p>
          {lineupPicker}
          {setlistPicker()}
          <p className="text-xs uppercase tracking-[0.18em] text-ink-dim">
            Selected: {selectedTrack.title}
          </p>
          <button
            type="button"
            onClick={isTouch ? enterTouch : enterDesktop}
            className="w-full max-w-xs rounded-md border bg-[#121826]/72 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
            style={{ borderColor: `${ACCENT}99` }}
          >
            enter the hall
          </button>
          <Link
            href="/rabbit-hole/game"
            className="text-xs uppercase tracking-[0.22em] text-ink-dim underline-offset-4 transition-colors hover:text-[#dbe5ff] hover:underline"
          >
            back to the street
          </Link>
        </div>
      )}
    </div>
  );
}
