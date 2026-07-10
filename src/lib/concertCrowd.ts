import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ============================================================================
// The crowd — instanced audience figures on the concert hall tiers.
//
// Low-poly blockout people in the hall's unlit neon language: dark bodies,
// a scattering of glowing "phone lights" held overhead. Everyone sways side
// to side on their own phase; lights swing wider than bodies. Three draw
// calls total (bodies, heads baked into bodies, lights), so a couple
// thousand people cost almost nothing.
// ============================================================================

export type CrowdTier = { inner: number; outer: number; y: number };

export type ConcertCrowd = {
  /** Per-frame sway. `elapsed` is total seconds (THREE.Clock.elapsedTime). */
  update: (elapsed: number) => void;
  dispose: () => void;
};

/** People per tier at density 1, innermost (closest to stage) first. */
const TIER_COUNTS = [700, 620, 520];
/** Fraction of the crowd holding a light overhead. */
const LIGHT_FRACTION = 0.45;

const BODY_COLORS = [0x1a2440, 0x1a1330, 0x0f1b33, 0x231a3d, 0x2b2350];
const LIGHT_COLORS = [0xffd9a0, 0x22d3ee, 0x8b5cf6, 0xdbe5ff];

export function createConcertCrowd(
  scene: THREE.Scene,
  tiers: CrowdTier[],
  { density = 1 }: { density?: number } = {},
): ConcertCrowd {
  // --- One merged figure: capsule body + sphere head -----------------------
  const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.85, 3, 8).translate(
    0,
    0.725,
    0,
  );
  const headGeo = new THREE.SphereGeometry(0.17, 8, 6).translate(0, 1.62, 0);
  const figureGeo = mergeGeometries([bodyGeo, headGeo]);
  bodyGeo.dispose();
  headGeo.dispose();

  const figureMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lightGeo = new THREE.SphereGeometry(0.07, 6, 5);
  const lightMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // --- Seat everyone --------------------------------------------------------
  type Seat = {
    pos: THREE.Vector3;
    yaw: number; // facing the stage at center
    scale: number;
    phase: number;
    speed: number;
    amp: number;
    lightIndex: number; // -1 if empty-handed
    lightAmp: number;
  };
  const seats: Seat[] = [];
  let lightCount = 0;

  tiers.forEach((tier, i) => {
    const count = Math.floor((TIER_COUNTS[i] ?? 400) * density);
    for (let n = 0; n < count; n += 1) {
      // bias toward the inner railing — everyone wants to be near the stage
      const t = Math.random() ** 1.7;
      const r = tier.inner + 1.6 + t * (tier.outer - tier.inner - 3.2);
      const a = Math.random() * Math.PI * 2;
      const holdsLight = Math.random() < LIGHT_FRACTION;
      seats.push({
        pos: new THREE.Vector3(Math.cos(a) * r, tier.y, Math.sin(a) * r),
        yaw: Math.atan2(-Math.sin(a), -Math.cos(a)), // look at (0,·,0)
        scale: 0.9 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.6,
        amp: 0.06 + Math.random() * 0.08,
        lightIndex: holdsLight ? lightCount++ : -1,
        lightAmp: 0.3 + Math.random() * 0.4,
      });
    }
  });

  const figures = new THREE.InstancedMesh(figureGeo, figureMat, seats.length);
  figures.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  figures.frustumCulled = false; // instances ring the whole hall
  const lights = new THREE.InstancedMesh(lightGeo, lightMat, lightCount);
  lights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  lights.frustumCulled = false;

  const color = new THREE.Color();
  seats.forEach((seat, i) => {
    color.setHex(BODY_COLORS[i % BODY_COLORS.length]);
    figures.setColorAt(i, color);
    if (seat.lightIndex >= 0) {
      color.setHex(LIGHT_COLORS[seat.lightIndex % LIGHT_COLORS.length]);
      lights.setColorAt(seat.lightIndex, color);
    }
  });

  scene.add(figures);
  scene.add(lights);

  // --- Per-frame sway --------------------------------------------------------
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const qYaw = new THREE.Quaternion();
  const qLean = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  const IDENTITY_Q = new THREE.Quaternion();

  const update = (elapsed: number) => {
    for (let i = 0; i < seats.length; i += 1) {
      const seat = seats[i];
      const sway = Math.sin(elapsed * seat.speed + seat.phase);

      qYaw.setFromAxisAngle(Y_AXIS, seat.yaw);
      qLean.setFromAxisAngle(Z_AXIS, sway * seat.amp);
      q.multiplyQuaternions(qYaw, qLean);
      s.setScalar(seat.scale);
      m.compose(seat.pos, q, s);
      figures.setMatrixAt(i, m);

      if (seat.lightIndex >= 0) {
        // held overhead, swinging on a wider arc than the body lean —
        // tangential to the ring (local X after the yaw)
        const swing = sway * seat.lightAmp;
        const tx = -Math.sin(seat.yaw);
        const tz = -Math.cos(seat.yaw);
        p.set(
          seat.pos.x + tx * swing * seat.scale,
          seat.pos.y + (1.95 + Math.abs(swing) * -0.15) * seat.scale,
          seat.pos.z + tz * swing * seat.scale,
        );
        s.setScalar(seat.scale);
        m.compose(p, IDENTITY_Q, s);
        lights.setMatrixAt(seat.lightIndex, m);
      }
    }
    figures.instanceMatrix.needsUpdate = true;
    lights.instanceMatrix.needsUpdate = true;
  };

  update(0);

  return {
    update,
    dispose: () => {
      scene.remove(figures);
      scene.remove(lights);
      figureGeo.dispose();
      figureMat.dispose();
      lightGeo.dispose();
      lightMat.dispose();
    },
  };
}
