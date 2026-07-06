"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const ORGANISM_COUNT = 5200;

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
      scale: 0.09 + random(index + 2017) * 0.34,
      speed: 0.065 + random(index + 2801) * 0.18,
      wobble: 0.8 + random(index + 3203) * 4.2,
      hue: 0.48 + random(index + 3907) * 0.32,
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

    const ambient = new THREE.AmbientLight(0x8fb8c2, 0.35);
    scene.add(ambient);

    const keyLight = new THREE.PointLight(0x8df4ff, 11, 260, 2);
    keyLight.position.set(-36, 34, 58);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0xff6fba, 5, 210, 2);
    fillLight.position.set(48, -26, 32);
    scene.add(fillLight);

    const bodyGeometry = new THREE.CapsuleGeometry(0.32, 0.92, 3, 8);
    bodyGeometry.rotateZ(Math.PI / 2);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x05090a,
      emissiveIntensity: 0.28,
      metalness: 0,
      roughness: 0.58,
      vertexColors: true,
    });
    const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, ORGANISM_COUNT);
    bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(bodies);

    const headGeometry = new THREE.SphereGeometry(0.28, 8, 6);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x05090a,
      emissiveIntensity: 0.25,
      metalness: 0,
      roughness: 0.62,
      vertexColors: true,
    });
    const heads = new THREE.InstancedMesh(headGeometry, headMaterial, ORGANISM_COUNT);
    heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(heads);

    const organisms = makeOrganisms();
    const color = new THREE.Color();
    for (let i = 0; i < organisms.length; i += 1) {
      const organism = organisms[i];
      color.setHSL(organism.hue, 0.46, 0.42 + random(i + 4409) * 0.32);
      bodies.setColorAt(i, color);
      color.offsetHSL(0.02, -0.08, 0.08);
      heads.setColorAt(i, color);
    }
    if (bodies.instanceColor) {
      bodies.instanceColor.needsUpdate = true;
    }
    if (heads.instanceColor) {
      heads.instanceColor.needsUpdate = true;
    }

    const pointer = new THREE.Vector2();
    const clock = new THREE.Clock();
    const matrix = new THREE.Matrix4();
    const headMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const headPosition = new THREE.Vector3();
    const headOffset = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const scale = new THREE.Vector3();
    const headScale = new THREE.Vector3();
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
        const pulse = 1 + Math.sin(elapsed * 3.2 + organism.phase) * 0.08;
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

        const size = organism.scale * (0.62 + (position.z + 190) / 620);
        scale.set(size * 2.2 * pulse, size * 0.62, size * 0.62);
        matrix.compose(position, rotation, scale);
        bodies.setMatrixAt(i, matrix);

        headOffset.set(size * 1.35, 0, 0).applyQuaternion(rotation);
        headPosition.copy(position).add(headOffset);
        headScale.setScalar(size * 0.82);
        headMatrix.compose(headPosition, rotation, headScale);
        heads.setMatrixAt(i, headMatrix);
      }

      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;

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
      headGeometry.dispose();
      headMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="ocean-stage" aria-hidden="true" />;
}
