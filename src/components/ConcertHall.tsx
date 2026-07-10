"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  VRMLoaderPlugin,
  VRMUtils,
  VRMHumanBoneName,
  type VRM,
} from "@pixiv/three-vrm";

// ============================================================================
// The Concert Hall — a very large, multi-level hall "in the round".
//
// A sunken stage sits at the dead center, at the bottom. Concentric tiers
// (balconies) rise outward and upward around it, so from any upper level you
// look DOWN across the void at the stage. A VRM artist paces back and forth
// on the stage.
//
// This is an OUTLINE / blockout for the model developer to build on:
//   • The architecture (levels, ramps, railings, dome, stage) is real and
//     walkable — floor-height following + ramp connectors between tiers.
//   • The performer is a placeholder mannequin driven by a procedural walk.
//     Pass `artistSrc` (a .vrm / .glb URL) to drop in the real avatar — it
//     reuses the exact procedural gait from ConstructGame, so the handoff is
//     just "give it a URL."
//
// Everything uses the site's unlit neon material language (MeshBasicMaterial),
// so it matches The Arena and drops straight into the rabbit-hole.
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

export default function ConcertHall({ artistSrc }: { artistSrc?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const lockFnRef = useRef<(() => void) | null>(null);
  const overlayOpenRef = useRef(true);

  const [entered, setEntered] = useState(false);
  const [locked, setLocked] = useState(false);
  const isTouch = useSyncExternalStore(
    subscribeToPointerType,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );

  useEffect(() => {
    overlayOpenRef.current = !entered;
  }, [entered]);

  const enterDesktop = () => {
    setEntered(true);
    lockFnRef.current?.();
  };
  const enterTouch = () => setEntered(true);

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

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

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

    // ======================================================================
    // The performer — placeholder mannequin now, real VRM when `artistSrc`
    // is provided. Both are driven by the same procedural walk cycle.
    // ======================================================================
    const STAGE_PATROL = STAGE_R - 6; // walk from -X to +X across the stage
    const ARTIST_SPEED = 1.7; // metres/sec

    type ArtistBones = {
      leftUpperLeg: THREE.Object3D | null;
      rightUpperLeg: THREE.Object3D | null;
      leftLowerLeg: THREE.Object3D | null;
      rightLowerLeg: THREE.Object3D | null;
      leftUpperArm: THREE.Object3D | null;
      rightUpperArm: THREE.Object3D | null;
      spine: THREE.Object3D | null;
    };
    const artist = {
      root: null as THREE.Object3D | null,
      vrm: null as VRM | null,
      bones: null as ArtistBones | null,
      baseY: 0,
      dir: 1, // +1 walking toward +X, -1 toward -X
      gait: 0,
    };

    // A rough blockout figure so the stage isn't empty before the real avatar
    // is dropped in. Legs/arms are named so the same gait drives them.
    function buildMannequin(): { root: THREE.Object3D; bones: ArtistBones } {
      const group = new THREE.Group();
      const skin = new THREE.MeshBasicMaterial({ color: accent });
      const dark = new THREE.MeshBasicMaterial({ color: 0x1a1330 });
      disposables.push(skin, dark);

      const torsoGeo = new THREE.CapsuleGeometry(0.32, 0.7, 4, 12);
      const torso = new THREE.Mesh(torsoGeo, dark);
      torso.position.y = 1.15;
      group.add(torso);
      const headGeo = new THREE.SphereGeometry(0.24, 16, 12);
      const head = new THREE.Mesh(headGeo, skin);
      head.position.y = 1.75;
      group.add(head);
      disposables.push(torsoGeo, headGeo);

      const limbGeo = new THREE.CapsuleGeometry(0.1, 0.6, 4, 8);
      disposables.push(limbGeo);
      const mkLimb = (x: number, y: number, m: THREE.Material) => {
        // pivot at the top so rotation.x swings the limb from the joint
        const pivot = new THREE.Object3D();
        pivot.position.set(x, y, 0);
        const limb = new THREE.Mesh(limbGeo, m);
        limb.position.y = -0.4;
        pivot.add(limb);
        group.add(pivot);
        return pivot;
      };
      const leftUpperArm = mkLimb(-0.42, 1.45, dark);
      const rightUpperArm = mkLimb(0.42, 1.45, dark);
      const leftUpperLeg = mkLimb(-0.18, 0.78, dark);
      const rightUpperLeg = mkLimb(0.18, 0.78, dark);

      return {
        root: group,
        bones: {
          leftUpperArm,
          rightUpperArm,
          leftUpperLeg,
          rightUpperLeg,
          leftLowerLeg: null,
          rightLowerLeg: null,
          spine: torso,
        },
      };
    }

    const placeholder = buildMannequin();
    artist.root = placeholder.root;
    artist.bones = placeholder.bones;
    artist.baseY = 0.02;
    artist.root.position.set(-STAGE_PATROL, artist.baseY, 0);
    scene.add(artist.root);

    // Real VRM handoff: give it a URL and it swaps the placeholder out, wiring
    // the same humanoid bones the gait already knows how to drive.
    let sceneDisposed = false;
    if (artistSrc) {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      loader.load(
        artistSrc,
        (gltf) => {
          const vrm = (gltf.userData.vrm as VRM | undefined) ?? null;
          if (!vrm || sceneDisposed) {
            if (vrm) VRMUtils.deepDispose(vrm.scene);
            return;
          }
          VRMUtils.rotateVRM0(vrm); // VRM0 faces -Z; align to +Z
          const b = (name: VRMHumanBoneName) =>
            vrm.humanoid?.getNormalizedBoneNode(name) ?? null;

          // remove the placeholder
          if (artist.root) {
            scene.remove(artist.root);
          }
          const root = vrm.scene;
          root.traverse((o) => (o.frustumCulled = false));
          // normalize height, stand feet on the stage
          root.updateMatrixWorld(true);
          const size = new THREE.Box3()
            .setFromObject(root)
            .getSize(new THREE.Vector3());
          root.scale.setScalar(1.7 / (size.y > 1e-3 ? size.y : 1.7));
          root.updateMatrixWorld(true);
          const minY = new THREE.Box3().setFromObject(root).min.y;
          artist.baseY = 0.02 - minY;
          root.position.set(-STAGE_PATROL, artist.baseY, 0);
          scene.add(root);

          artist.root = root;
          artist.vrm = vrm;
          artist.bones = {
            spine: b(VRMHumanBoneName.Spine),
            leftUpperArm: b(VRMHumanBoneName.LeftUpperArm),
            rightUpperArm: b(VRMHumanBoneName.RightUpperArm),
            leftUpperLeg: b(VRMHumanBoneName.LeftUpperLeg),
            rightUpperLeg: b(VRMHumanBoneName.RightUpperLeg),
            leftLowerLeg: b(VRMHumanBoneName.LeftLowerLeg),
            rightLowerLeg: b(VRMHumanBoneName.RightLowerLeg),
          };
        },
        undefined,
        () => {}, // a missing avatar shouldn't break the hall
      );
    }

    const poseBone = (node: THREE.Object3D | null, x: number) => {
      if (node) node.rotation.x = x;
    };

    // Walk the artist from one side of the stage to the other, turn, repeat.
    const updateArtist = (delta: number) => {
      const root = artist.root;
      if (!root) return;
      root.position.x += artist.dir * ARTIST_SPEED * delta;
      if (root.position.x > STAGE_PATROL) {
        root.position.x = STAGE_PATROL;
        artist.dir = -1;
      } else if (root.position.x < -STAGE_PATROL) {
        root.position.x = -STAGE_PATROL;
        artist.dir = 1;
      }
      // face the walk direction (+X → +90°, -X → -90°)
      const targetYaw = artist.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      let diff = targetYaw - root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      root.rotation.y += diff * Math.min(1, delta * 8);

      // procedural gait (shared by mannequin + VRM)
      const b = artist.bones;
      if (b) {
        artist.gait += delta * 6.5;
        const swing = Math.sin(artist.gait) * 0.5;
        poseBone(b.leftUpperLeg, swing);
        poseBone(b.rightUpperLeg, -swing);
        poseBone(b.leftLowerLeg, -Math.max(0, -swing) * 0.6);
        poseBone(b.rightLowerLeg, -Math.max(0, swing) * 0.6);
        poseBone(b.leftUpperArm, -swing * 0.45);
        poseBone(b.rightUpperArm, swing * 0.45);
        poseBone(b.spine, Math.abs(swing) * 0.05);
        root.position.y = artist.baseY + Math.abs(Math.sin(artist.gait)) * 0.04;
      }
      artist.vrm?.update(delta);
    };

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

      updateArtist(delta);
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
      if (artist.vrm) VRMUtils.deepDispose(artist.vrm.scene);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [artistSrc]);

  const showOverlay = !entered;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div ref={hostRef} className="stage-fixed" />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#dbe5ff]/80" />

        <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-2 p-4">
          <p
            className="text-xs font-bold uppercase tracking-[0.24em]"
            style={{ color: ACCENT }}
          >
            The Concert Hall · outline
          </p>
          <Link
            href="/rabbit-hole/game"
            className="pointer-events-auto rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
          >
            back to the street
          </Link>
        </div>

        <p className="absolute inset-x-0 bottom-4 px-4 text-center text-[11px] uppercase tracking-[0.25em] text-ink-dim">
          {isTouch
            ? "left thumb: walk — right thumb: look — ramps take you down to the stage"
            : locked
              ? "wasd / arrows: move — mouse: look — walk a ramp down toward the stage"
              : "cursor released — click the scene to look around again"}
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
            or follow a ramp down to the floor. The performer paces the stage.
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
