import * as THREE from "three";

// Shared matrix-glyph rendering for 3D point clouds: the construct's code rain
// and the character chamber's glyph swarm both sample this atlas.

export const GLYPHS =
  "アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789ABCDEFXYZ<>/\\{}[]$#*+=";
export const ATLAS_GRID = 8; // 8x8 cells is enough for the glyph set

export function makeGlyphAtlas() {
  const cell = 128;
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_GRID * cell;
  canvas.height = ATLAS_GRID * cell;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.font = `bold ${Math.floor(cell * 0.72)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < GLYPHS.length; i += 1) {
      ctx.fillText(
        GLYPHS[i],
        (i % ATLAS_GRID) * cell + cell / 2,
        Math.floor(i / ATLAS_GRID) * cell + cell / 2,
      );
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export type GlyphMaterialOptions = {
  atlas: THREE.CanvasTexture;
  /** base world-space glyph size */
  size?: number;
  /** extra size added per particle, scaled by its random seed */
  sizeJitter?: number;
  /** distance where glyphs start fading (match scene fog) */
  fadeNear?: number;
  /** distance where glyphs are fully faded */
  fadeFar?: number;
  /** overall alpha multiplier */
  alpha?: number;
};

/**
 * Point-sprite material that renders each particle as a flickering glyph from
 * the atlas. Geometry must provide float attributes `glyph` (0..GLYPHS.length)
 * and `seed` (0..1). Call `updateGlyphScale` on resize and advance the `uTime`
 * uniform each frame.
 */
export function createGlyphMaterial({
  atlas,
  size = 0.7,
  sizeJitter = 0.4,
  fadeNear = 20,
  fadeFar = 130,
  alpha = 1,
}: GlyphMaterialOptions) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uAtlas: { value: atlas },
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x00ff66) },
      // half the drawing-buffer height — same size attenuation PointsMaterial uses
      uScale: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float glyph;
      attribute float seed;
      uniform float uScale;
      varying float vGlyph;
      varying float vSeed;
      varying float vDepth;

      void main() {
        vGlyph = glyph;
        vSeed = seed;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mvPosition.z;
        gl_PointSize = (${size.toFixed(3)} + seed * ${sizeJitter.toFixed(3)}) * uScale / vDepth;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas;
      uniform float uTime;
      uniform vec3 uColor;
      varying float vGlyph;
      varying float vSeed;
      varying float vDepth;

      const float GRID = ${ATLAS_GRID.toFixed(1)};
      const float COUNT = ${GLYPHS.length.toFixed(1)};

      void main() {
        // each particle flickers through the glyph set at its own cadence
        float index = mod(vGlyph + floor(uTime * (1.0 + vSeed * 3.0)), COUNT);
        vec2 uv = vec2(
          (mod(index, GRID) + gl_PointCoord.x) / GRID,
          1.0 - (floor(index / GRID) + gl_PointCoord.y) / GRID
        );
        float shape = texture2D(uAtlas, uv).a;
        float fade = 1.0 - smoothstep(${fadeNear.toFixed(1)}, ${fadeFar.toFixed(1)}, vDepth);
        float a = shape * fade * (0.35 + vSeed * 0.55) * ${alpha.toFixed(3)};
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
        #include <colorspace_fragment>
      }
    `,
  });
}

/** Keep point sizing correct across resizes (drawing-buffer height / 2). */
export function updateGlyphScale(
  material: THREE.ShaderMaterial,
  renderer: THREE.WebGLRenderer,
) {
  material.uniforms.uScale.value = renderer.domElement.height * 0.5;
}
