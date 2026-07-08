import * as THREE from "three";

// ---------------------------------------------------------------------------
// A painted galaxy. Generates an equirectangular night-sky texture on a
// canvas — thousands of stars, a tilted Milky Way band with dust lanes, and
// a few faint nebulae — and wraps it on an inward-facing sphere. No assets,
// no network: the whole sky is painted at load time.
// ---------------------------------------------------------------------------

const SKY_W = 2048;
const SKY_H = 1024;

function paintGalaxy(ctx: CanvasRenderingContext2D) {
  // deep space: near-black with a whisper of blue at the horizon
  const base = ctx.createLinearGradient(0, 0, 0, SKY_H);
  base.addColorStop(0, "#03040a");
  base.addColorStop(0.55, "#050614");
  base.addColorStop(1, "#070a18");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SKY_W, SKY_H);

  // the galactic band runs as a gentle sine across the sky
  const bandY = (x: number) =>
    SKY_H * 0.5 + Math.sin((x / SKY_W) * Math.PI * 2) * SKY_H * 0.16;
  const bandHalf = SKY_H * 0.14;

  // far starfield — smaller and denser inside the band
  const starColors = [
    "255,255,255",
    "200,215,255",
    "255,240,220",
    "180,200,255",
    "255,220,200",
  ];
  for (let i = 0; i < 4200; i += 1) {
    const x = Math.random() * SKY_W;
    const y = Math.random() * SKY_H;
    const inBand = Math.abs(y - bandY(x)) < bandHalf * (0.7 + Math.random());
    if (!inBand && Math.random() < 0.55) continue; // thin out the open sky
    const r = inBand ? Math.random() * 0.9 + 0.2 : Math.random() * 1.4 + 0.3;
    const alpha = Math.random() * 0.7 + 0.25;
    ctx.fillStyle = `rgba(${starColors[(Math.random() * starColors.length) | 0]},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // milky glow: layered soft blobs along the band
  for (let i = 0; i < 900; i += 1) {
    const x = Math.random() * SKY_W;
    const spread = (Math.random() - 0.5) * bandHalf * 2.2;
    const y = bandY(x) + spread;
    const radius = Math.random() * 55 + 18;
    const core = 1 - Math.abs(spread) / (bandHalf * 1.3);
    if (core <= 0) continue;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const tint =
      Math.random() < 0.75
        ? "205,215,235"
        : Math.random() < 0.5
          ? "185,170,220"
          : "160,190,225";
    g.addColorStop(0, `rgba(${tint},${0.028 * core})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // dust lanes: dark ragged blobs threading the bright band
  for (let i = 0; i < 260; i += 1) {
    const x = Math.random() * SKY_W;
    const y = bandY(x) + (Math.random() - 0.5) * bandHalf * 0.9;
    const radius = Math.random() * 34 + 10;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, `rgba(4,4,10,${Math.random() * 0.16 + 0.05})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  // bright band stars sprinkled over the glow
  for (let i = 0; i < 1400; i += 1) {
    const x = Math.random() * SKY_W;
    const y = bandY(x) + (Math.random() - 0.5) * bandHalf * 1.6;
    const r = Math.random() * 0.8 + 0.15;
    ctx.fillStyle = `rgba(235,240,255,${Math.random() * 0.8 + 0.2})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // a few distant nebulae off the band
  const nebulae = [
    { tint: "150,110,200", a: 0.05 },
    { tint: "110,150,210", a: 0.045 },
    { tint: "200,120,160", a: 0.035 },
  ];
  for (const n of nebulae) {
    const x = Math.random() * SKY_W;
    const y = Math.random() * SKY_H * 0.6 + SKY_H * 0.1;
    for (let i = 0; i < 14; i += 1) {
      const px = x + (Math.random() - 0.5) * 160;
      const py = y + (Math.random() - 0.5) * 110;
      const radius = Math.random() * 70 + 30;
      const g = ctx.createRadialGradient(px, py, 0, px, py, radius);
      g.addColorStop(0, `rgba(${n.tint},${n.a * Math.random()})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(px - radius, py - radius, radius * 2, radius * 2);
    }
  }

  // a handful of hero stars with glow
  for (let i = 0; i < 26; i += 1) {
    const x = Math.random() * SKY_W;
    const y = Math.random() * SKY_H * 0.8;
    const r = Math.random() * 1.3 + 0.9;
    ctx.shadowColor = "rgba(220,230,255,0.9)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

/** Inward-facing sky sphere carrying the painted galaxy. Caller owns disposal
 * of geometry, material, and texture (all returned). */
export function createGalaxySky(radius: number): {
  mesh: THREE.Mesh;
  dispose(): void;
} {
  const canvas = document.createElement("canvas");
  canvas.width = SKY_W;
  canvas.height = SKY_H;
  const ctx = canvas.getContext("2d");
  if (ctx) paintGalaxy(ctx);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.SphereGeometry(radius, 48, 32);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return {
    mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
