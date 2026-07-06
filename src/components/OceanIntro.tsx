"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const ORGANISM_COUNT = 3200;

function random(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function makeOrganisms() {
  return Array.from({ length: ORGANISM_COUNT }, (_, index) => {
    const a = random(index + 1);
    const b = random(index + 101);
    const c = random(index + 401);
    const d = random(index + 907);

    return {
      angle: a * Math.PI * 2,
      drift: (b - 0.5) * 90,
      lane: (c - 0.5) * 72,
      orbit: 34 + random(index + 1409) * 138,
      phase: d * Math.PI * 2,
      scale: 0.18 + random(index + 2017) * 1.25,
      speed: 0.045 + random(index + 2801) * 0.13,
      wobble: 0.8 + random(index + 3203) * 4.2,
    };
  });
}

export default function OceanIntro() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.011);

    const camera = new THREE.PerspectiveCamera(
      54,
      host.clientWidth / host.clientHeight,
      0.1,
      700,
    );
    camera.position.set(0, 0, 112);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x6b98a8, 0.28);
    scene.add(ambient);

    const keyLight = new THREE.PointLight(0x8df4ff, 15, 260, 2);
    keyLight.position.set(-36, 34, 58);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0xff6fba, 8, 210, 2);
    fillLight.position.set(48, -26, 32);
    scene.add(fillLight);

    const bodyGeometry = new THREE.IcosahedronGeometry(1, 2);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x5dd8e8,
      emissive: 0x123d46,
      emissiveIntensity: 0.7,
      metalness: 0,
      roughness: 0.42,
    });
    const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, ORGANISM_COUNT);
    bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(bodies);

    const glowGeometry = new THREE.SphereGeometry(1, 10, 8);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xbffcff,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glows = new THREE.InstancedMesh(glowGeometry, glowMaterial, ORGANISM_COUNT);
    glows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(glows);

    const organisms = makeOrganisms();
    const pointer = new THREE.Vector2();
    const clock = new THREE.Clock();
    const matrix = new THREE.Matrix4();
    const glowMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const glowScale = new THREE.Vector3();
    let animationFrame = 0;

    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const onResize = () => {
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };

    host.addEventListener("pointermove", onPointerMove);
    window.addEventListener("resize", onResize);

    const render = () => {
      const elapsed = clock.getElapsedTime();

      for (let i = 0; i < organisms.length; i += 1) {
        const organism = organisms[i];
        const swim = elapsed * organism.speed + organism.phase;
        const angle = organism.angle + swim;
        const depth = ((organism.drift + elapsed * organism.wobble * 1.8 + 190) % 380) - 190;
        const pulse = 1 + Math.sin(elapsed * 1.6 + organism.phase) * 0.12;
        const orbit = organism.orbit + Math.sin(elapsed * 0.18 + organism.phase) * 4;

        position.set(
          Math.cos(angle) * orbit + Math.sin(swim * 2.7) * 3.2,
          organism.lane + Math.sin(swim * 3.1) * 5.5,
          depth,
        );

        euler.set(
          Math.sin(swim * 2.2) * 0.55,
          angle + Math.PI * 0.5,
          Math.cos(swim * 1.7) * 0.35,
        );
        rotation.setFromEuler(euler);

        const size = organism.scale * (1 + (position.z + 190) / 560);
        scale.set(size * 1.45 * pulse, size * 0.72, size * 0.92);
        matrix.compose(position, rotation, scale);
        bodies.setMatrixAt(i, matrix);

        glowScale.set(size * 2.9, size * 2.9, size * 2.9);
        glowMatrix.compose(position, rotation, glowScale);
        glows.setMatrixAt(i, glowMatrix);
      }

      bodies.instanceMatrix.needsUpdate = true;
      glows.instanceMatrix.needsUpdate = true;

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 5, 0.018);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, -pointer.y * 4, 0.018);
      camera.position.z = 112 + Math.sin(elapsed * 0.08) * 1.8;
      camera.lookAt(pointer.x * 2.5, -pointer.y * 2, -32);

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };

    render();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      host.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      bodyGeometry.dispose();
      bodyMaterial.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="ocean-stage" aria-hidden="true" />;
}
