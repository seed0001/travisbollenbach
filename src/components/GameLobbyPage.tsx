"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type AccessRule = "free" | "subscription" | "age-gated" | "subscription-age";

type LevelDoor = {
  id: string;
  name: string;
  shortName: string;
  zone: string;
  description: string;
  access: AccessRule;
  minimumAge?: number;
  position: THREE.Vector3Tuple;
  color: number;
};

type SignalMessage =
  | { type: "joined"; peerId: string; peers: string[] }
  | { type: "peer-joined"; peerId: string }
  | { type: "peer-left"; peerId: string }
  | {
      type: "offer" | "answer" | "ice";
      from: string;
      payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
    }
  | { type: "error"; error: string };

const levelDoors: LevelDoor[] = [
  {
    id: "training-yard",
    name: "Training Yard",
    shortName: "Yard",
    zone: "starter",
    description: "Free tutorial space for movement, controls, and basic interactions.",
    access: "free",
    position: [-8, 0, -7],
    color: 0x37f2c0,
  },
  {
    id: "arcade-run",
    name: "Arcade Run",
    shortName: "Arcade",
    zone: "starter",
    description: "Free challenge level with score chasing and short loops.",
    access: "free",
    position: [0, 0, -10],
    color: 0xffc857,
  },
  {
    id: "sky-workshop",
    name: "Sky Workshop",
    shortName: "Workshop",
    zone: "premium",
    description: "Subscription area with build tools, experiments, and advanced puzzles.",
    access: "subscription",
    position: [8, 0, -7],
    color: 0x5fa8ff,
  },
  {
    id: "neon-district",
    name: "Neon District",
    shortName: "Neon",
    zone: "age gate",
    description: "Age-gated social zone for mature themes and moderated interactions.",
    access: "age-gated",
    minimumAge: 18,
    position: [10, 0, 4],
    color: 0xff4f8b,
  },
  {
    id: "deep-vault",
    name: "Deep Vault",
    shortName: "Vault",
    zone: "premium age gate",
    description: "Subscription and age-gated late-game space for mature story content.",
    access: "subscription-age",
    minimumAge: 18,
    position: [-10, 0, 4],
    color: 0xaa72ff,
  },
];

const accessLabels: Record<AccessRule, string> = {
  free: "Free",
  subscription: "Subscription",
  "age-gated": "Age gate",
  "subscription-age": "Subscription + age gate",
};

const accessDescriptions: Record<AccessRule, string> = {
  free: "Open from the lobby.",
  subscription: "Requires an active paid tier.",
  "age-gated": "Requires age confirmation before entry.",
  "subscription-age": "Requires both paid access and age confirmation.",
};

const lobbyBounds = 11.5;
const doorTriggerDistance = 2.6;

function makeRadialTexture(inner: string, outer: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  const gradient = context.createRadialGradient(512, 420, 40, 512, 512, 620);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.42, "#17242a");
  gradient.addColorStop(1, outer);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeFloorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  context.fillStyle = "#151a1f";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(137, 216, 194, 0.18)";
  context.lineWidth = 2;
  for (let index = 0; index <= 1024; index += 64) {
    context.beginPath();
    context.moveTo(index, 0);
    context.lineTo(index, 1024);
    context.stroke();
    context.beginPath();
    context.moveTo(0, index);
    context.lineTo(1024, index);
    context.stroke();
  }
  context.strokeStyle = "rgba(245, 208, 111, 0.22)";
  context.lineWidth = 5;
  context.beginPath();
  context.arc(512, 512, 330, 0, Math.PI * 2);
  context.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 2.5);
  return texture;
}

function makeLabelTexture(label: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  context.fillStyle = "rgba(17, 19, 24, 0.86)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(245, 208, 111, 0.8)";
  context.lineWidth = 6;
  context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  context.fillStyle = "#ffffff";
  context.font = "700 42px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createDoor(door: LevelDoor) {
  const group = new THREE.Group();
  group.position.set(...door.position);
  group.userData = { doorId: door.id };

  const portalMaterial = new THREE.MeshStandardMaterial({
    color: door.color,
    emissive: door.color,
    emissiveIntensity: 1.35,
    roughness: 0.18,
    metalness: 0.2,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b0f14,
    roughness: 0.28,
    metalness: 0.62,
  });

  const portal = new THREE.Mesh(new THREE.BoxGeometry(2.7, 4.1, 0.18), portalMaterial);
  portal.position.y = 2;
  group.add(portal);

  const veil = new THREE.Mesh(
    new THREE.PlaneGeometry(2.25, 3.45),
    new THREE.MeshBasicMaterial({
      color: door.color,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  veil.position.set(0, 2, 0.16);
  group.add(veil);

  const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.32, 4.7, 0.62), frameMaterial);
  leftFrame.position.set(-1.45, 2.05, 0);
  group.add(leftFrame);

  const rightFrame = leftFrame.clone();
  rightFrame.position.x = 1.45;
  group.add(rightFrame);

  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.34, 0.62), frameMaterial);
  topFrame.position.set(0, 4.38, 0);
  group.add(topFrame);

  const threshold = new THREE.Mesh(
    new THREE.CylinderGeometry(1.75, 1.75, 0.09, 48),
    new THREE.MeshBasicMaterial({
      color: door.color,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  threshold.rotation.x = Math.PI / 2;
  threshold.position.set(0, 0.08, 0.12);
  group.add(threshold);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 0.9),
    new THREE.MeshBasicMaterial({
      map: makeLabelTexture(door.shortName),
      transparent: true,
    }),
  );
  label.position.set(0, 5, 0.04);
  group.add(label);

  group.lookAt(0, 0, 0);
  return group;
}

export default function GameLobbyPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLDivElement | null>(null);
  const signalingRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const touchMoveRef = useRef({ x: 0, z: 0 });
  const touchLookRef = useRef({ x: 0, y: 0 });
  const cameraAnglesRef = useRef({ yaw: 0, pitch: -0.12 });
  const orientationBaseRef = useRef<{ alpha: number; beta: number } | null>(null);
  const motionLookEnabledRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeDoorId, setActiveDoorId] = useState(levelDoors[0].id);
  const [stick, setStick] = useState({ active: false, x: 0, y: 0 });
  const [lookStick, setLookStick] = useState({ active: false, x: 0, y: 0 });
  const [panelOpen, setPanelOpen] = useState(false);
  const [motionLookEnabled, setMotionLookEnabled] = useState(false);
  const [voiceState, setVoiceState] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [remoteSpeakers, setRemoteSpeakers] = useState<string[]>([]);

  const activeDoor = useMemo(
    () => levelDoors.find((door) => door.id === activeDoorId) ?? levelDoors[0],
    [activeDoorId],
  );

  useEffect(() => {
    motionLookEnabledRef.current = motionLookEnabled;
  }, [motionLookEnabled]);

  const updateTouchMovement = (clientX: number, clientY: number, target: Element) => {
    const bounds = target.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const maxDistance = bounds.width * 0.36;
    const deltaX = THREE.MathUtils.clamp(
      (clientX - centerX) / maxDistance,
      -1,
      1,
    );
    const deltaY = THREE.MathUtils.clamp(
      (clientY - centerY) / maxDistance,
      -1,
      1,
    );
    const vector = new THREE.Vector2(deltaX, deltaY);
    if (vector.length() > 1) vector.normalize();

    touchMoveRef.current = { x: vector.x, z: vector.y };
    setStick({ active: true, x: vector.x, y: vector.y });
  };

  const stopTouchMovement = () => {
    touchMoveRef.current = { x: 0, z: 0 };
    setStick({ active: false, x: 0, y: 0 });
  };

  const updateTouchLook = (clientX: number, clientY: number, target: Element) => {
    const bounds = target.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const maxDistance = bounds.width * 0.36;
    const deltaX = THREE.MathUtils.clamp(
      (clientX - centerX) / maxDistance,
      -1,
      1,
    );
    const deltaY = THREE.MathUtils.clamp(
      (clientY - centerY) / maxDistance,
      -1,
      1,
    );
    const vector = new THREE.Vector2(deltaX, deltaY);
    if (vector.length() > 1) vector.normalize();

    touchLookRef.current = { x: vector.x, y: vector.y };
    setLookStick({ active: true, x: vector.x, y: vector.y });
  };

  const stopTouchLook = () => {
    touchLookRef.current = { x: 0, y: 0 };
    setLookStick({ active: false, x: 0, y: 0 });
  };

  const enableMotionLook = async () => {
    const orientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<PermissionState>;
    };
    if (typeof orientationEvent.requestPermission === "function") {
      const permission = await orientationEvent.requestPermission();
      if (permission !== "granted") return;
    }
    orientationBaseRef.current = null;
    setMotionLookEnabled(true);
  };

  useEffect(() => {
    if (!isPlaying || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = makeRadialTexture("#24373f", "#07090d");
    scene.fog = new THREE.FogExp2(0x07090d, 0.035);

    const camera = new THREE.PerspectiveCamera(
      68,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 1.7, 5.2);
    camera.rotation.order = "YXZ";

    const ambient = new THREE.HemisphereLight(0x9eead8, 0x080a0f, 1.25);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    keyLight.position.set(4, 10, 5);
    scene.add(keyLight);

    const centerLight = new THREE.PointLight(0x37f2c0, 8, 12);
    centerLight.position.set(0, 2.6, 0);
    scene.add(centerLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14.5, 128),
      new THREE.MeshStandardMaterial({
        map: makeFloorTexture(),
        color: 0x8fa7a1,
        roughness: 0.62,
        metalness: 0.16,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(6.8, 0.08, 10, 128),
      new THREE.MeshBasicMaterial({
        color: 0xf5d06f,
        transparent: true,
        opacity: 0.72,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    scene.add(ring);

    const spawn = new THREE.Mesh(
      new THREE.CylinderGeometry(1.55, 1.55, 0.18, 64),
      new THREE.MeshStandardMaterial({
        color: 0x89d8c2,
        emissive: 0x89d8c2,
        emissiveIntensity: 0.65,
        roughness: 0.2,
        metalness: 0.5,
      }),
    );
    spawn.position.y = 0.09;
    scene.add(spawn);

    const spireMaterial = new THREE.MeshStandardMaterial({
      color: 0x0c1118,
      emissive: 0x18252c,
      emissiveIntensity: 0.35,
      roughness: 0.3,
      metalness: 0.55,
    });
    for (let index = 0; index < 16; index += 1) {
      const angle = (index / 16) * Math.PI * 2;
      const radius = index % 2 === 0 ? 13.2 : 12.2;
      const height = 2.5 + (index % 5) * 0.55;
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.42, height, 6),
        spireMaterial,
      );
      spire.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
      spire.rotation.y = -angle;
      scene.add(spire);
    }

    const playerPosition = new THREE.Vector3(0, 1.7, 5.2);

    const doorGroups = levelDoors.map((door) => {
      const group = createDoor(door);
      scene.add(group);
      const light = new THREE.PointLight(door.color, 13, 9);
      light.position.set(...door.position);
      light.position.y = 2.2;
      scene.add(light);
      return group;
    });

    const keys = new Set<string>();
    const onKeyDown = (event: KeyboardEvent) => keys.add(event.key.toLowerCase());
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    const onDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (
        !motionLookEnabledRef.current ||
        event.alpha === null ||
        event.beta === null
      ) {
        return;
      }
      if (!orientationBaseRef.current) {
        orientationBaseRef.current = { alpha: event.alpha, beta: event.beta };
      }
      const base = orientationBaseRef.current;
      let alphaDelta = event.alpha - base.alpha;
      if (alphaDelta > 180) alphaDelta -= 360;
      if (alphaDelta < -180) alphaDelta += 360;
      const betaDelta = event.beta - base.beta;
      cameraAnglesRef.current.yaw = -alphaDelta * 0.018;
      cameraAnglesRef.current.pitch = THREE.MathUtils.clamp(
        -0.12 - betaDelta * 0.012,
        -0.72,
        0.42,
      );
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("deviceorientation", onDeviceOrientation);

    let animationFrame = 0;
    let lastTime = performance.now();

    const resize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };

    const animate = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      resize();

      let strafe = 0;
      let forward = 0;
      if (keys.has("w") || keys.has("arrowup")) forward += 1;
      if (keys.has("s") || keys.has("arrowdown")) forward -= 1;
      if (keys.has("a") || keys.has("arrowleft")) strafe -= 1;
      if (keys.has("d") || keys.has("arrowright")) strafe += 1;
      strafe += touchMoveRef.current.x;
      forward -= touchMoveRef.current.z;

      const move = new THREE.Vector3(strafe, 0, -forward);
      if (move.lengthSq() > 0) {
        move.normalize();
        const yaw = cameraAnglesRef.current.yaw;
        const sin = Math.sin(yaw);
        const cos = Math.cos(yaw);
        const worldX = move.x * cos - move.z * sin;
        const worldZ = move.x * sin + move.z * cos;
        playerPosition.x += worldX * 5.2 * delta;
        playerPosition.z += worldZ * 5.2 * delta;
        playerPosition.x = THREE.MathUtils.clamp(playerPosition.x, -lobbyBounds, lobbyBounds);
        playerPosition.z = THREE.MathUtils.clamp(playerPosition.z, -lobbyBounds, lobbyBounds);
      }

      cameraAnglesRef.current.yaw -= touchLookRef.current.x * 2.65 * delta;
      cameraAnglesRef.current.pitch = THREE.MathUtils.clamp(
        cameraAnglesRef.current.pitch - touchLookRef.current.y * 1.65 * delta,
        -0.72,
        0.42,
      );

      let nearestDoor = levelDoors[0];
      let nearestDistance = Number.POSITIVE_INFINITY;
      const playerFlat = new THREE.Vector2(playerPosition.x, playerPosition.z);
      for (const door of levelDoors) {
        const doorFlat = new THREE.Vector2(door.position[0], door.position[2]);
        const distance = playerFlat.distanceTo(doorFlat);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestDoor = door;
        }
      }
      if (nearestDistance < doorTriggerDistance) {
        setActiveDoorId((current) =>
          current === nearestDoor.id ? current : nearestDoor.id,
        );
      }

      for (const group of doorGroups) {
        const pulse = Math.sin(time * 0.003 + group.position.x) * 0.04;
        group.scale.setScalar(1 + pulse);
      }

      camera.position.copy(playerPosition);
      camera.rotation.y = cameraAnglesRef.current.yaw;
      camera.rotation.x = cameraAnglesRef.current.pitch;
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("deviceorientation", onDeviceOrientation);
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    };
  }, [isPlaying]);

  const disconnectVoice = () => {
    for (const connection of peerConnectionsRef.current.values()) {
      connection.close();
    }
    peerConnectionsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    signalingRef.current?.close();
    signalingRef.current = null;
    if (audioRef.current) audioRef.current.replaceChildren();
    setRemoteSpeakers([]);
    setVoiceState("idle");
    setVoiceMessage("");
  };

  const sendSignal = (
    type: "offer" | "answer" | "ice",
    to: string,
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit,
  ) => {
    signalingRef.current?.send(JSON.stringify({ type, to, payload }));
  };

  const removePeer = (peerId: string) => {
    peerConnectionsRef.current.get(peerId)?.close();
    peerConnectionsRef.current.delete(peerId);
    audioRef.current
      ?.querySelectorAll(`[data-peer-id="${CSS.escape(peerId)}"]`)
      .forEach((element) => element.remove());
    setRemoteSpeakers((current) =>
      current.filter((identity) => identity !== peerId),
    );
  };

  const createPeerConnection = (peerId: string, stream: MediaStream) => {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) return existing;

    const configuredStun = process.env.NEXT_PUBLIC_STUN_URL;
    const connection = new RTCPeerConnection({
      iceServers: configuredStun
        ? [{ urls: configuredStun }]
        : [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnectionsRef.current.set(peerId, connection);

    stream.getAudioTracks().forEach((track) => {
      connection.addTrack(track, stream);
    });

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal("ice", peerId, event.candidate.toJSON());
      }
    };

    connection.ontrack = (event) => {
      if (!audioRef.current || !event.streams[0]) return;
      const existingAudio = audioRef.current.querySelector(
        `[data-peer-id="${CSS.escape(peerId)}"]`,
      );
      if (existingAudio) return;

      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("playsinline", "true");
      audio.dataset.peerId = peerId;
      audio.srcObject = event.streams[0];
      audioRef.current.appendChild(audio);
      setRemoteSpeakers((current) =>
        current.includes(peerId) ? current : [...current, peerId],
      );
    };

    connection.onconnectionstatechange = () => {
      if (
        connection.connectionState === "closed" ||
        connection.connectionState === "failed" ||
        connection.connectionState === "disconnected"
      ) {
        removePeer(peerId);
      }
    };

    return connection;
  };

  const connectVoice = async () => {
    if (voiceState === "connecting" || voiceState === "connected") return;
    setVoiceState("connecting");
    setVoiceMessage("Requesting microphone...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/voice-signaling`);
      signalingRef.current = socket;
      const peerId =
        globalThis.crypto?.randomUUID?.() ?? `player-${Date.now().toString(36)}`;

      socket.onopen = () => {
        socket.send(
          JSON.stringify({
            type: "join",
            roomId: "main-lobby",
            peerId,
          }),
        );
      };

      socket.onmessage = async (event) => {
        const message = JSON.parse(event.data) as SignalMessage;

        if (message.type === "error") {
          throw new Error(message.error);
        }

        if (message.type === "joined") {
          setVoiceState("connected");
          setVoiceMessage("Voice is live in the lobby.");
          for (const existingPeer of message.peers) {
            const connection = createPeerConnection(existingPeer, stream);
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            sendSignal("offer", existingPeer, offer);
          }
          return;
        }

        if (message.type === "peer-left") {
          removePeer(message.peerId);
          return;
        }

        if (message.type === "peer-joined") {
          setVoiceMessage("Voice is live in the lobby.");
          return;
        }

        const connection = createPeerConnection(message.from, stream);
        if (message.type === "offer") {
          await connection.setRemoteDescription(
            new RTCSessionDescription(message.payload as RTCSessionDescriptionInit),
          );
          const answer = await connection.createAnswer();
          await connection.setLocalDescription(answer);
          sendSignal("answer", message.from, answer);
          return;
        }

        if (message.type === "answer") {
          await connection.setRemoteDescription(
            new RTCSessionDescription(message.payload as RTCSessionDescriptionInit),
          );
          return;
        }

        if (message.type === "ice") {
          await connection.addIceCandidate(
            new RTCIceCandidate(message.payload as RTCIceCandidateInit),
          );
        }
      };

      socket.onerror = () => {
        setVoiceState("error");
        setVoiceMessage("Voice signaling failed.");
      };

      socket.onclose = () => {
        setVoiceState((current) => {
          if (current !== "connected") return current;
          setVoiceMessage("Voice disconnected.");
          return "idle";
        });
      };
    } catch (error) {
      disconnectVoice();
      setVoiceState("error");
      setVoiceMessage(error instanceof Error ? error.message : "Voice failed.");
    }
  };

  useEffect(() => disconnectVoice, []);

  return (
    <main className="game-shell min-h-svh bg-[#101318] text-white">
      {!isPlaying ? (
        <section className="welcome-screen mx-auto flex min-h-svh max-w-5xl flex-col items-center justify-center px-5 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#89d8c2]">
            Travis Bollenbach
          </p>
          <h1 className="mt-5 text-5xl font-black tracking-tight text-white sm:text-8xl">
            Welcome.
          </h1>
          <p className="mt-5 text-xl font-semibold text-white/78 sm:text-2xl">
            Do you want to play the game?
          </p>
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            className="mt-9 min-h-14 rounded-md bg-[#f5d06f] px-8 text-sm font-black uppercase tracking-[0.18em] text-[#15120b] shadow-[0_16px_40px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 hover:bg-[#ffe08d] focus:outline-none focus:ring-4 focus:ring-[#f5d06f]/35"
          >
            Enter lobby
          </button>
        </section>
      ) : (
        <section className="immersive-lobby relative min-h-svh overflow-hidden touch-none">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full"
            aria-label="3D multiplayer lobby"
          />
          <div ref={audioRef} className="hidden" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/28 shadow-[0_0_18px_rgba(55,242,192,0.28)]">
            <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#37f2c0]" />
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:flex sm:flex-wrap sm:items-start sm:justify-between sm:gap-4 sm:p-4">
            <button
              type="button"
              onClick={() => setPanelOpen((open) => !open)}
              className="hud-glass pointer-events-auto flex max-w-[72vw] items-center gap-2 rounded-full px-3 py-2 text-left shadow-xl shadow-black/30 sm:hidden"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#37f2c0] shadow-[0_0_14px_rgba(55,242,192,0.9)]" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">
                  {activeDoor.name}
                </span>
                <span className="block truncate text-[11px] font-bold uppercase tracking-[0.08em] text-white/54">
                  {accessLabels[activeDoor.access]}
                </span>
              </span>
            </button>

            <div className="hud-glass pointer-events-auto hidden rounded-md p-4 shadow-xl shadow-black/30 sm:block sm:max-w-md">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#89d8c2]">
                3D Lobby
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                {activeDoor.name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/68">
                {activeDoor.description}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-md border border-white/10 bg-white/[0.055] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                    Access
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {accessLabels[activeDoor.access]}
                  </p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.055] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                    Rule
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {activeDoor.minimumAge
                      ? `${activeDoor.minimumAge}+`
                      : accessDescriptions[activeDoor.access]}
                  </p>
                </div>
              </div>
            </div>

            <div className="hud-glass pointer-events-auto fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] w-[5.75rem] rounded-full p-1.5 shadow-xl shadow-black/30 sm:static sm:w-full sm:max-w-sm sm:rounded-md sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="hidden sm:block">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f5d06f]">
                    Voice
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/66 sm:text-sm">
                    {voiceMessage || "Connect your mic to talk in the lobby."}
                  </p>
                </div>
                <span
                  className={`h-3 w-3 rounded-full ${
                    voiceState === "connected"
                      ? "bg-[#89d8c2]"
                      : voiceState === "error"
                        ? "bg-[#ff6a6a]"
                        : "bg-white/28"
                  }`}
                  aria-label={`Voice state: ${voiceState}`}
                />
              </div>
              <div className="flex gap-1 sm:mt-4 sm:gap-2">
                <button
                  type="button"
                  onClick={connectVoice}
                  disabled={voiceState === "connecting" || voiceState === "connected"}
                  className="grid h-10 flex-1 place-items-center rounded-full bg-[#37f2c0] px-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#04110d] shadow-[0_0_18px_rgba(55,242,192,0.26)] transition hover:bg-[#7affdc] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-11 sm:rounded-md sm:px-4 sm:text-xs sm:tracking-[0.14em]"
                >
                  {voiceState === "connecting" ? "..." : "Mic"}
                </button>
                <button
                  type="button"
                  onClick={disconnectVoice}
                  className="hidden min-h-11 rounded-md border border-white/16 px-4 text-xs font-black uppercase tracking-[0.14em] text-white/72 transition hover:border-white/34 hover:text-white sm:block"
                >
                  Mic off
                </button>
              </div>
              <p className="mt-3 hidden text-xs leading-5 text-white/45 sm:block">
                {remoteSpeakers.length > 0
                  ? `Remote voice: ${remoteSpeakers.join(", ")}`
                  : "No remote speakers connected."}
              </p>
            </div>
          </div>

          {panelOpen && (
            <div className="hud-glass pointer-events-auto absolute inset-x-3 bottom-44 z-20 rounded-md p-3 shadow-2xl shadow-black/40 sm:hidden">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#89d8c2]">
                    Door
                  </p>
                  <h2 className="mt-1 text-xl font-black">{activeDoor.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="rounded-md border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-white/70"
                >
                  Close
                </button>
              </div>
              <p className="mt-2 text-sm leading-6 text-white/70">
                {activeDoor.description}
              </p>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#f5d06f]">
                {accessLabels[activeDoor.access]}
                {activeDoor.minimumAge ? ` · ${activeDoor.minimumAge}+` : ""}
              </p>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div
              className="hud-glass pointer-events-auto relative h-36 w-36 shrink-0 rounded-full shadow-xl shadow-black/30 sm:hidden"
              data-control
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                updateTouchMovement(event.clientX, event.clientY, event.currentTarget);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  updateTouchMovement(event.clientX, event.clientY, event.currentTarget);
                }
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                stopTouchMovement();
              }}
              onPointerCancel={stopTouchMovement}
              role="application"
              aria-label="Move"
            >
              <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-white/10" />
              <div
                className="absolute left-1/2 top-1/2 h-16 w-16 rounded-full bg-[#37f2c0] shadow-[0_0_32px_rgba(55,242,192,0.5)]"
                style={{
                  transform: `translate(calc(-50% + ${stick.x * 38}px), calc(-50% + ${stick.y * 38}px))`,
                  opacity: stick.active ? 1 : 0.82,
                }}
              />
            </div>
            <div className="flex flex-col items-end gap-3 sm:hidden">
              <button
                type="button"
                onClick={enableMotionLook}
                className={`hud-glass pointer-events-auto min-h-10 rounded-full px-3 text-[10px] font-black uppercase tracking-[0.1em] ${
                  motionLookEnabled ? "text-[#37f2c0]" : "text-white/72"
                }`}
              >
                Motion
              </button>
              <div
                className="hud-glass pointer-events-auto relative h-36 w-36 shrink-0 rounded-full shadow-xl shadow-black/30"
                data-control
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateTouchLook(event.clientX, event.clientY, event.currentTarget);
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    updateTouchLook(event.clientX, event.clientY, event.currentTarget);
                  }
                }}
                onPointerUp={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  }
                  stopTouchLook();
                }}
                onPointerCancel={stopTouchLook}
                role="application"
                aria-label="Look"
              >
                <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-white/10" />
                <div
                  className="absolute left-1/2 top-1/2 h-16 w-16 rounded-full bg-[#ffcf66] shadow-[0_0_32px_rgba(255,207,102,0.42)]"
                  style={{
                    transform: `translate(calc(-50% + ${lookStick.x * 38}px), calc(-50% + ${lookStick.y * 38}px))`,
                    opacity: lookStick.active ? 1 : 0.82,
                  }}
                />
              </div>
            </div>
            <div className="hud-glass hidden rounded-md px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white/70 shadow-xl shadow-black/30 sm:block">
              First-person lobby
            </div>
            <button
              type="button"
              onClick={() => {
                stopTouchMovement();
                stopTouchLook();
                setMotionLookEnabled(false);
                orientationBaseRef.current = null;
                disconnectVoice();
                setIsPlaying(false);
              }}
              className="hud-glass pointer-events-auto min-h-11 rounded-md px-4 text-xs font-black uppercase tracking-[0.14em] text-white/78 shadow-xl shadow-black/30 transition hover:text-white"
            >
              Exit lobby
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
