"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Water } from "three/examples/jsm/objects/Water.js";

function makeWaterNormals() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.Texture();
  }

  const image = context.createImageData(size, size);
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      heights[y * size + x] =
        Math.sin((nx * 2.1 + ny * 0.35) * Math.PI * 2) * 0.56 +
        Math.sin((nx * 0.48 - ny * 1.28) * Math.PI * 2) * 0.34 +
        Math.cos((nx * 1.1 + ny * 1.65) * Math.PI * 2) * 0.24 +
        Math.sin((nx * 3.4 - ny * 1.9) * Math.PI * 2) * 0.08;
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const left = heights[y * size + ((x - 1 + size) % size)];
      const right = heights[y * size + ((x + 1) % size)];
      const up = heights[((y - 1 + size) % size) * size + x];
      const down = heights[((y + 1) % size) * size + x];
      const normal = new THREE.Vector3((left - right) * 0.72, (up - down) * 0.72, 1);
      normal.normalize();

      const i = (y * size + x) * 4;
      image.data[i] = Math.round((normal.x * 0.5 + 0.5) * 255);
      image.data[i + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
      image.data[i + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
      image.data[i + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;

  return texture;
}

export default function OceanIntro() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      47,
      host.clientWidth / host.clientHeight,
      1,
      22000,
    );
    camera.position.set(0, 44, 155);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.72;
    host.appendChild(renderer.domElement);

    scene.fog = new THREE.FogExp2(0xb8d7e3, 0.000055);

    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;
    skyUniforms.turbidity.value = 4.8;
    skyUniforms.rayleigh.value = 2.15;
    skyUniforms.mieCoefficient.value = 0.0028;
    skyUniforms.mieDirectionalG.value = 0.78;

    const sun = new THREE.Vector3();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);

    const updateSun = () => {
      const phi = THREE.MathUtils.degToRad(89.2 - 9.5);
      const theta = THREE.MathUtils.degToRad(195);
      sun.setFromSphericalCoords(1, phi, theta);
      sky.material.uniforms.sunPosition.value.copy(sun);
      water.material.uniforms.sunDirection.value.copy(sun).normalize();

      const renderTarget = pmremGenerator.fromScene(sky as unknown as THREE.Scene);
      scene.environment = renderTarget.texture;
    };

    const waterGeometry = new THREE.PlaneGeometry(18000, 18000, 256, 256);
    const waterNormals = makeWaterNormals();
    const water = new Water(waterGeometry, {
      textureWidth: 1024,
      textureHeight: 1024,
      waterNormals,
      sunDirection: new THREE.Vector3(),
      sunColor: 0xffddb8,
      waterColor: 0x0a2635,
      distortionScale: 2.35,
      fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = -5;
    scene.add(water);
    updateSun();

    const pointer = new THREE.Vector2();
    const clock = new THREE.Clock();
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
      water.material.uniforms.time.value = elapsed * 0.16;

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 5, 0.018);
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        44 + -pointer.y * 2.5 + Math.sin(elapsed * 0.22) * 0.55,
        0.018,
      );
      camera.position.z = 155 + Math.sin(elapsed * 0.12) * 2.4;
      camera.lookAt(pointer.x * 4, -3, -950);

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };

    render();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      host.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      waterGeometry.dispose();
      waterNormals.dispose();
      water.material.dispose();
      sky.material.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="ocean-stage" aria-hidden="true" />;
}
