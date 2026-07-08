import * as THREE from "three";

// ---------------------------------------------------------------------------
// A real point-cloud galaxy. No painted sky texture — that stretched into
// fuzzy blobs and seam walls. Instead: thousands of individual stars as
// screen-space points (always crisp), a Milky Way made of genuine star
// density along a tilted great circle, and a whisper of additive glow.
// ---------------------------------------------------------------------------

// gaussian via Box-Muller — the band's thickness falls off naturally
function gauss(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** small round soft-edged dot, shared by all star layers */
function makeStarTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** larger, much softer blob for the band glow and nebulae */
function makeGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,0.5)");
    g.addColorStop(0.5, "rgba(255,255,255,0.14)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// realistic-ish stellar tints: blue-white giants to warm dwarfs
const STAR_TINTS = [
  [0.72, 0.8, 1.0],
  [0.85, 0.9, 1.0],
  [1.0, 1.0, 1.0],
  [1.0, 0.95, 0.85],
  [1.0, 0.85, 0.7],
] as const;

function pickTint(dim: number): [number, number, number] {
  const t = STAR_TINTS[(Math.random() * STAR_TINTS.length) | 0];
  return [t[0] * dim, t[1] * dim, t[2] * dim];
}

export function createGalaxySky(radius: number): {
  mesh: THREE.Object3D;
  dispose(): void;
} {
  const group = new THREE.Group();
  group.renderOrder = -1;
  const disposables: { dispose(): void }[] = [];

  const starTexture = makeStarTexture();
  const glowTexture = makeGlowTexture();
  disposables.push(starTexture, glowTexture);

  // the galactic plane: a great circle tilted across the sky
  const bandRotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0.42, 0.78, 0.46).normalize(),
  );

  const pointOnSphere = (out: THREE.Vector3) => {
    const z = Math.random() * 2 - 1;
    const t = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - z * z);
    out.set(s * Math.cos(t), z, s * Math.sin(t));
  };

  const pointInBand = (out: THREE.Vector3, sigma: number) => {
    const t = Math.random() * Math.PI * 2;
    out.set(Math.cos(t), gauss() * sigma, Math.sin(t));
    out.normalize().applyQuaternion(bandRotation);
  };

  const addStarLayer = (
    count: number,
    size: number,
    opacity: number,
    place: (out: THREE.Vector3) => void,
    dimRange: [number, number],
  ) => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const p = new THREE.Vector3();
    for (let i = 0; i < count; i += 1) {
      place(p);
      p.multiplyScalar(radius);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      const [r, g, b] = pickTint(
        dimRange[0] + Math.random() * (dimRange[1] - dimRange[0]),
      );
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size,
      map: starTexture,
      vertexColors: true,
      transparent: true,
      opacity,
      sizeAttenuation: false, // constant pixel size — stars stay pin-sharp
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    disposables.push(geometry, material);
    group.add(new THREE.Points(geometry, material));
  };

  // open-sky stars: mostly faint, a few bright, everywhere
  addStarLayer(1600, 1.6, 0.9, pointOnSphere, [0.35, 0.8]);
  addStarLayer(500, 2.6, 0.95, pointOnSphere, [0.55, 1.0]);
  addStarLayer(110, 4.2, 1.0, pointOnSphere, [0.8, 1.0]);

  // the Milky Way: density, not paint — a core lane and a wider halo
  addStarLayer(2600, 1.4, 0.8, (o) => pointInBand(o, 0.055), [0.3, 0.75]);
  addStarLayer(1500, 1.8, 0.85, (o) => pointInBand(o, 0.13), [0.3, 0.7]);
  addStarLayer(300, 2.6, 0.9, (o) => pointInBand(o, 0.08), [0.6, 1.0]);

  // faint glow hugging the band — additive sprites, far too dim to read as
  // geometry, just enough to make the lane feel luminous
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    color: new THREE.Color(0.55, 0.62, 0.78),
    transparent: true,
    opacity: 0.055,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  disposables.push(glowMaterial);
  const glowPoint = new THREE.Vector3();
  for (let i = 0; i < 90; i += 1) {
    pointInBand(glowPoint, 0.05);
    const sprite = new THREE.Sprite(glowMaterial);
    sprite.position.copy(glowPoint).multiplyScalar(radius * 0.985);
    const s = radius * (0.1 + Math.random() * 0.12);
    sprite.scale.set(s, s * (0.5 + Math.random() * 0.4), 1);
    group.add(sprite);
  }

  // two quiet nebulae off the band
  const nebulaTints = [
    new THREE.Color(0.5, 0.36, 0.62),
    new THREE.Color(0.32, 0.44, 0.66),
  ];
  nebulaTints.forEach((tint) => {
    const material = new THREE.SpriteMaterial({
      map: glowTexture,
      color: tint,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    disposables.push(material);
    const center = new THREE.Vector3();
    pointOnSphere(center);
    center.y = Math.abs(center.y) * 0.6 + 0.25; // keep them up in the sky
    center.normalize();
    for (let i = 0; i < 7; i += 1) {
      const sprite = new THREE.Sprite(material);
      sprite.position
        .copy(center)
        .multiplyScalar(radius * 0.98)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * radius * 0.12,
            (Math.random() - 0.5) * radius * 0.08,
            (Math.random() - 0.5) * radius * 0.12,
          ),
        );
      const s = radius * (0.06 + Math.random() * 0.08);
      sprite.scale.set(s, s, 1);
      group.add(sprite);
    }
  });

  return {
    mesh: group,
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
