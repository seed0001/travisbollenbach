import * as THREE from "three";

// ============================================================================
// The laser show — beat-reactive beams sweeping down from the dome rigging.
//
// A ring of laser heads hangs over the stage. Each head pans around and tilts
// on its own phase; an AnalyserNode tapped off the music stem drives sweep
// speed, beam brightness, and a beat detector that flashes the beams, pops a
// floor ring, and rotates the beam colors. With no analyser (or the song
// paused) the rig idles: slow sweeps, faint beams.
//
// update() returns the smoothed music level + beat flag so the caller can
// drive other reactive bits (crowd sway, spotlight pulse) off the same tap.
// ============================================================================

export type LaserAudio = { level: number; beat: boolean };

export type ConcertLasers = {
  update: (
    elapsed: number,
    delta: number,
    analyser: AnalyserNode | null,
  ) => LaserAudio;
  dispose: () => void;
};

const HEAD_COUNT = 12;
const LASER_COLORS = [0x8b5cf6, 0x22d3ee, 0xe879f9, 0x60a5fa];
/** Beams brighten from this floor as the music energy rises. */
const BEAM_OPACITY_IDLE = 0.05;

export function createConcertLasers(
  scene: THREE.Scene,
  {
    rigY,
    rigRadius,
    beamLength,
    floorRadius,
  }: {
    rigY: number;
    rigRadius: number;
    beamLength: number;
    floorRadius: number;
  },
): ConcertLasers {
  const root = new THREE.Group();
  root.name = "LaserRig";
  scene.add(root);

  // Shared beam geometry: a thin open cylinder hanging from the head origin.
  const beamGeo = new THREE.CylinderGeometry(0.07, 0.22, beamLength, 6, 1, true)
    .translate(0, -beamLength / 2, 0);

  type Head = {
    pivot: THREE.Group;
    mat: THREE.MeshBasicMaterial;
    baseAngle: number;
    panSpeed: number;
    tiltPhase: number;
    tiltSpeed: number;
    colorShift: number;
  };
  const heads: Head[] = [];

  for (let i = 0; i < HEAD_COUNT; i += 1) {
    const angle = (i / HEAD_COUNT) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.position.set(
      Math.cos(angle) * rigRadius,
      rigY,
      Math.sin(angle) * rigRadius,
    );

    const mat = new THREE.MeshBasicMaterial({
      color: LASER_COLORS[i % LASER_COLORS.length],
      transparent: true,
      opacity: BEAM_OPACITY_IDLE,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    pivot.add(new THREE.Mesh(beamGeo, mat));
    root.add(pivot);

    heads.push({
      pivot,
      mat,
      baseAngle: angle,
      panSpeed: 0.25 + (i % 3) * 0.12,
      tiltPhase: (i / HEAD_COUNT) * Math.PI * 2,
      tiltSpeed: 0.9 + (i % 4) * 0.22,
      colorShift: 0,
    });
  }

  // Floor ring that pops on the beat, hugging the stage edge.
  const flashGeo = new THREE.RingGeometry(floorRadius * 0.9, floorRadius, 96);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xdbe5ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const flashRing = new THREE.Mesh(flashGeo, flashMat);
  flashRing.rotation.x = -Math.PI / 2;
  flashRing.position.y = 0.05;
  root.add(flashRing);

  // --- Music analysis state -------------------------------------------------
  const freq = new Uint8Array(128); // fftSize 256 → 128 bins
  let level = 0; // smoothed full-band energy 0..1
  let bassAvg = 0.1; // slow-moving bass baseline for onset detection
  let lastBeatAt = -10;
  let beatFlash = 0; // 1 on beat, decays
  let beatCount = 0;
  let sweep = 0; // energy-scaled sweep clock

  const analyze = (
    elapsed: number,
    delta: number,
    analyser: AnalyserNode | null,
  ): LaserAudio => {
    if (!analyser) {
      level = Math.max(0, level - delta * 2);
      return { level, beat: false };
    }
    analyser.getByteFrequencyData(freq);

    let sum = 0;
    for (let i = 0; i < freq.length; i += 1) sum += freq[i];
    const rawLevel = sum / (freq.length * 255);

    let bassSum = 0;
    for (let i = 1; i <= 5; i += 1) bassSum += freq[i];
    const bass = bassSum / (5 * 255);

    level += (rawLevel - level) * Math.min(1, delta * 9);
    bassAvg += (bass - bassAvg) * Math.min(1, delta * 1.1);

    const beat =
      bass > bassAvg * 1.28 + 0.02 &&
      bass > 0.16 &&
      elapsed - lastBeatAt > 0.22;
    if (beat) {
      lastBeatAt = elapsed;
      beatFlash = 1;
      beatCount += 1;
    }
    return { level, beat };
  };

  const update = (
    elapsed: number,
    delta: number,
    analyser: AnalyserNode | null,
  ): LaserAudio => {
    const audio = analyze(elapsed, delta, analyser);
    beatFlash = Math.max(0, beatFlash - delta * 2.6);

    // sweeps crawl when idle, whip around when the music is loud
    sweep += delta * (0.35 + audio.level * 2.4);
    const colorStep = beatCount >> 2; // rotate palette every 4 beats

    for (let i = 0; i < heads.length; i += 1) {
      const head = heads[i];
      // pan the whole head around the vertical axis…
      head.pivot.rotation.y =
        head.baseAngle + sweep * head.panSpeed * (i % 2 ? 1 : -1);
      // …while the beam tilts through a cone that opens with the music
      const tiltRange = 0.28 + audio.level * 0.5;
      head.pivot.rotation.z =
        0.35 + Math.sin(sweep * head.tiltSpeed + head.tiltPhase) * tiltRange;

      head.mat.opacity =
        BEAM_OPACITY_IDLE + audio.level * 0.24 + beatFlash * 0.18;

      const wantShift = (i + colorStep) % LASER_COLORS.length;
      if (head.colorShift !== wantShift) {
        head.colorShift = wantShift;
        head.mat.color.setHex(LASER_COLORS[wantShift]);
      }
    }

    flashMat.opacity = beatFlash * 0.35;
    return audio;
  };

  return {
    update,
    dispose: () => {
      scene.remove(root);
      beamGeo.dispose();
      flashGeo.dispose();
      flashMat.dispose();
      for (const head of heads) head.mat.dispose();
    },
  };
}
