import * as THREE from "three";
import { Tree } from "@dgreenheck/ez-tree";
import {
  CHUNK_SIZE,
  WATER_LEVEL,
  createNoise2D,
  mulberry32,
  type Terrain,
} from "./terrain";

// ---------------------------------------------------------------------------
// The forest. Trees are grown with EZ-Tree by Daniel Greenheck
// (https://github.com/dgreenheck/ez-tree, MIT) — see CREDITS.md.
//
// A handful of template trees are generated once from the world seed, then
// scattered across chunks as instanced meshes: thousands of trees, a few
// draw calls per chunk. Placement is a pure function of seed + chunk
// coordinates, so every forest grows in the same place every visit.
// ---------------------------------------------------------------------------

const MAX_TREES_PER_CHUNK = 12;
const TREE_MAX_ALTITUDE = 26; // above this the rock and snow take over
const TREE_MIN_ALTITUDE = WATER_LEVEL + 1.2;
const MAX_GRADE = 0.55; // skip slopes steeper than ~29°

type Habitat = "highland" | "lowland" | "scrub";

const TEMPLATE_PRESETS: { preset: string; habitat: Habitat; scale: number }[] =
  [
    { preset: "Pine Medium", habitat: "highland", scale: 1 },
    { preset: "Pine Large", habitat: "highland", scale: 1 },
    { preset: "Oak Medium", habitat: "lowland", scale: 1 },
    { preset: "Ash Medium", habitat: "lowland", scale: 1 },
    { preset: "Aspen Medium", habitat: "lowland", scale: 1 },
    { preset: "Bush 1", habitat: "scrub", scale: 1.2 },
    { preset: "Bush 2", habitat: "scrub", scale: 1.2 },
  ];

type TreeTemplate = {
  habitat: Habitat;
  baseScale: number;
  branchGeometry: THREE.BufferGeometry;
  branchMaterial: THREE.Material;
  leafGeometry: THREE.BufferGeometry;
  leafMaterial: THREE.Material;
};

export type ChunkTrees = {
  group: THREE.Group;
  /** packed [x, z, x, z, ...] world positions, for proximity queries */
  positionsXZ: Float32Array;
};

export type Forest = {
  buildChunkTrees(cx: number, cz: number): ChunkTrees | null;
  disposeChunkTrees(trees: ChunkTrees): void;
  dispose(): void;
};

type Exclusion = { x: number; z: number; radius: number };

export function createForest(
  seed: number,
  terrain: Terrain,
  exclusions: Exclusion[] = [],
): Forest {
  const templates: TreeTemplate[] = TEMPLATE_PRESETS.map((spec, index) => {
    const tree = new Tree();
    tree.loadPreset(spec.preset);
    tree.options.seed = seed + index * 977;
    tree.generate();
    return {
      habitat: spec.habitat,
      baseScale: spec.scale,
      branchGeometry: tree.branchesMesh.geometry,
      branchMaterial: tree.branchesMesh.material as THREE.Material,
      leafGeometry: tree.leavesMesh.geometry,
      leafMaterial: tree.leavesMesh.material as THREE.Material,
    };
  });

  const forestNoise = createNoise2D(seed + 404);
  const dummy = new THREE.Object3D();

  const pickTemplate = (rng: () => number, altitude: number) => {
    if (rng() < 0.25) {
      // scrub grows everywhere below the tree line
      return templates.filter((t) => t.habitat === "scrub");
    }
    const habitat: Habitat = altitude > 13 ? "highland" : "lowland";
    return templates.filter((t) => t.habitat === habitat);
  };

  const buildChunkTrees = (cx: number, cz: number): ChunkTrees | null => {
    // forest density is its own slow noise — clumped woods, open plains
    const centerX = (cx + 0.5) * CHUNK_SIZE;
    const centerZ = (cz + 0.5) * CHUNK_SIZE;
    const density = THREE.MathUtils.smoothstep(
      forestNoise(centerX * 0.004, centerZ * 0.004),
      -0.35,
      0.75,
    );
    const attempts = Math.round(density * MAX_TREES_PER_CHUNK);
    if (attempts === 0) return null;

    const rng = mulberry32(
      (seed ^ Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663)) >>> 0,
    );

    type Placement = { x: number; z: number; y: number; scale: number; rot: number };
    const byTemplate = new Map<TreeTemplate, Placement[]>();
    const positions: number[] = [];

    for (let i = 0; i < attempts; i += 1) {
      const wx = cx * CHUNK_SIZE + rng() * CHUNK_SIZE;
      const wz = cz * CHUNK_SIZE + rng() * CHUNK_SIZE;
      const h = terrain.heightAt(wx, wz);
      if (h < TREE_MIN_ALTITUDE || h > TREE_MAX_ALTITUDE) continue;
      const gradeX = Math.abs(terrain.heightAt(wx + 2, wz) - h) / 2;
      const gradeZ = Math.abs(terrain.heightAt(wx, wz + 2) - h) / 2;
      if (Math.max(gradeX, gradeZ) > MAX_GRADE) continue;
      if (
        exclusions.some(
          (e) => Math.hypot(wx - e.x, wz - e.z) < e.radius,
        )
      ) {
        continue;
      }

      const candidates = pickTemplate(rng, h);
      const template = candidates[Math.floor(rng() * candidates.length)];
      const list = byTemplate.get(template) ?? [];
      list.push({
        x: wx,
        z: wz,
        y: h - 0.1,
        scale: template.baseScale * (0.8 + rng() * 0.6),
        rot: rng() * Math.PI * 2,
      });
      byTemplate.set(template, list);
      positions.push(wx, wz);
    }
    if (positions.length === 0) return null;

    const group = new THREE.Group();
    for (const [template, placements] of byTemplate) {
      const branches = new THREE.InstancedMesh(
        template.branchGeometry,
        template.branchMaterial,
        placements.length,
      );
      const leaves = new THREE.InstancedMesh(
        template.leafGeometry,
        template.leafMaterial,
        placements.length,
      );
      placements.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, p.rot, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        branches.setMatrixAt(i, dummy.matrix);
        leaves.setMatrixAt(i, dummy.matrix);
      });
      branches.computeBoundingSphere();
      leaves.computeBoundingSphere();
      group.add(branches, leaves);
    }
    return { group, positionsXZ: new Float32Array(positions) };
  };

  const disposeChunkTrees = (trees: ChunkTrees) => {
    // instance buffers only — geometries and materials belong to the templates
    trees.group.children.forEach((child) => {
      (child as THREE.InstancedMesh).dispose();
    });
  };

  const dispose = () => {
    templates.forEach((t) => {
      t.branchGeometry.dispose();
      t.branchMaterial.dispose();
      t.leafGeometry.dispose();
      t.leafMaterial.dispose();
    });
  };

  return { buildChunkTrees, disposeChunkTrees, dispose };
}
