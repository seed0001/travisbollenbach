"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const PALETTES = {
  red: { body: 0xe11d48, rim: 0xff4d6d, glow: "rgba(244, 63, 94, 0.4)" },
  blue: { body: 0x0284c7, rim: 0x4dc3ff, glow: "rgba(56, 189, 248, 0.4)" },
} as const;

const WIDTH = 260;
const HEIGHT = 150;

/**
 * A real 3D pill: glossy capsule with studio lighting, idling in a slow
 * spin and float. Speeds up and swells while the enclosing button is
 * hovered.
 */
export default function Pill3D({ variant }: { variant: "red" | "blue" }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const palette = PALETTES[variant];

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, WIDTH / HEIGHT, 0.1, 50);
    camera.position.set(0, 0.35, 5.6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(WIDTH, HEIGHT);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    host.appendChild(renderer.domElement);

    const geometry = new THREE.CapsuleGeometry(0.62, 1.7, 12, 32);
    geometry.rotateZ(Math.PI / 2);
    const material = new THREE.MeshPhysicalMaterial({
      color: palette.body,
      roughness: 0.2,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
    });
    const pill = new THREE.Mesh(geometry, material);
    const group = new THREE.Group();
    group.add(pill);
    group.rotation.z = -0.28; // held at a slight angle, like an open palm
    scene.add(group);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(2.5, 3, 4);
    scene.add(key);
    const rim = new THREE.PointLight(palette.rim, 16, 14);
    rim.position.set(-3, -1.5, -2.5);
    scene.add(rim);
    const matrixFill = new THREE.PointLight(0x00ff66, 3.5, 10);
    matrixFill.position.set(0, -2.6, 2);
    scene.add(matrixFill);

    let hovered = false;
    const onEnter = () => {
      hovered = true;
    };
    const onLeave = () => {
      hovered = false;
    };
    // React to hover on the whole pill button, not just the canvas
    const hoverTarget = host.closest("button") ?? host;
    hoverTarget.addEventListener("pointerenter", onEnter);
    hoverTarget.addEventListener("pointerleave", onLeave);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const clock = new THREE.Clock();
    let spinSpeed = 0.5;
    let scale = 1;
    let animationFrame = 0;

    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      spinSpeed = THREE.MathUtils.lerp(spinSpeed, hovered ? 2.4 : 0.5, 0.08);
      scale = THREE.MathUtils.lerp(scale, hovered ? 1.16 : 1, 0.12);

      pill.rotation.y += delta * spinSpeed;
      pill.rotation.x = Math.sin(elapsed * 0.7) * 0.16;
      group.position.y = Math.sin(elapsed * 1.5) * 0.09;
      group.scale.setScalar(scale);

      renderer.render(scene, camera);
    };

    if (reduceMotion) {
      pill.rotation.y = 0.7;
      renderer.render(scene, camera);
    } else {
      animate();
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      hoverTarget.removeEventListener("pointerenter", onEnter);
      hoverTarget.removeEventListener("pointerleave", onLeave);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant]);

  return (
    <div className="relative" style={{ width: WIDTH, height: HEIGHT }}>
      <div
        className="absolute left-1/2 top-1/2 h-20 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl transition-opacity"
        style={{ background: PALETTES[variant].glow }}
        aria-hidden="true"
      />
      <div ref={hostRef} className="relative" />
    </div>
  );
}
