"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { Water } from "three/examples/jsm/objects/Water.js";

function makeWaterNormals() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.Texture();
  }

  const image = context.createImageData(size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const swell =
        Math.sin(x * 0.08) * 0.5 +
        Math.cos(y * 0.11) * 0.35 +
        Math.sin((x + y) * 0.035) * 0.45 +
        Math.cos((x - y) * 0.055) * 0.35;
      const chop = Math.sin(x * 0.31 + y * 0.17) * 0.18;
      const value = Math.max(0, Math.min(255, 128 + (swell + chop) * 45));

      image.data[i] = value;
      image.data[i + 1] = 128 + Math.sin(y * 0.09) * 34;
      image.data[i + 2] = 255;
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
    camera.position.set(0, 58, 170);
    camera.rotation.x = THREE.MathUtils.degToRad(-10);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.58;
    host.appendChild(renderer.domElement);

    const sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;
    skyUniforms.turbidity.value = 6.8;
    skyUniforms.rayleigh.value = 1.7;
    skyUniforms.mieCoefficient.value = 0.0042;
    skyUniforms.mieDirectionalG.value = 0.86;

    const sun = new THREE.Vector3();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);

    const updateSun = () => {
      const phi = THREE.MathUtils.degToRad(89.2 - 7.2);
      const theta = THREE.MathUtils.degToRad(205);
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
      sunColor: 0xf1d6aa,
      waterColor: 0x071725,
      distortionScale: 5.7,
      fog: false,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.y = -7;
    scene.add(water);
    updateSun();

    const hazeGeometry = new THREE.RingGeometry(4200, 8800, 128);
    const hazeMaterial = new THREE.MeshBasicMaterial({
      color: 0xd7e7ee,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const haze = new THREE.Mesh(hazeGeometry, hazeMaterial);
    haze.rotation.x = -Math.PI / 2;
    haze.position.y = 7;
    scene.add(haze);

    const streakMaterial = new THREE.MeshBasicMaterial({
      color: 0x9fd6ef,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const streaks = new THREE.Group();
    for (let i = 0; i < 22; i += 1) {
      const geometry = new THREE.PlaneGeometry(
        18 + Math.random() * 90,
        0.18 + Math.random() * 0.5,
      );
      const mesh = new THREE.Mesh(geometry, streakMaterial.clone());
      mesh.position.set(
        (Math.random() - 0.5) * 1800,
        -5.2 + Math.random() * 0.45,
        -300 - Math.random() * 2100,
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = (Math.random() - 0.5) * 0.18;
      streaks.add(mesh);
    }
    scene.add(streaks);

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
      water.material.uniforms.time.value = elapsed * 0.62;

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointer.x * 18, 0.035);
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        54 + -pointer.y * 7 + Math.sin(elapsed * 0.8) * 1.2,
        0.04,
      );
      camera.position.z = 170 - ((elapsed * 32) % 120);
      camera.lookAt(pointer.x * 8, 0, -780);

      streaks.children.forEach((child, index) => {
        child.position.z += 3.6 + index * 0.035;
        if (child.position.z > 180) {
          child.position.z = -2300 - Math.random() * 800;
          child.position.x = (Math.random() - 0.5) * 1800;
        }
      });

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
      hazeGeometry.dispose();
      hazeMaterial.dispose();
      streakMaterial.dispose();
      streaks.children.forEach((child) => {
        const mesh = child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      water.material.dispose();
      sky.material.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className="ocean-stage" aria-hidden="true" />;
}
