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
    color: 0x89d8c2,
  },
  {
    id: "arcade-run",
    name: "Arcade Run",
    shortName: "Arcade",
    zone: "starter",
    description: "Free challenge level with score chasing and short loops.",
    access: "free",
    position: [0, 0, -10],
    color: 0xf5d06f,
  },
  {
    id: "sky-workshop",
    name: "Sky Workshop",
    shortName: "Workshop",
    zone: "premium",
    description: "Subscription area with build tools, experiments, and advanced puzzles.",
    access: "subscription",
    position: [8, 0, -7],
    color: 0x7da7ff,
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
    color: 0xff6aa2,
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
    color: 0xb58cff,
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
    emissiveIntensity: 0.75,
    roughness: 0.35,
    metalness: 0.12,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0x17191f,
    roughness: 0.55,
    metalness: 0.25,
  });

  const portal = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.9, 0.22), portalMaterial);
  portal.position.y = 2;
  group.add(portal);

  const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.4, 0.45), frameMaterial);
  leftFrame.position.set(-1.45, 2.05, 0);
  group.add(leftFrame);

  const rightFrame = leftFrame.clone();
  rightFrame.position.x = 1.45;
  group.add(rightFrame);

  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.25, 0.45), frameMaterial);
  topFrame.position.set(0, 4.2, 0);
  group.add(topFrame);

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeDoorId, setActiveDoorId] = useState(levelDoors[0].id);
  const [stick, setStick] = useState({ active: false, x: 0, y: 0 });
  const [panelOpen, setPanelOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [remoteSpeakers, setRemoteSpeakers] = useState<string[]>([]);

  const activeDoor = useMemo(
    () => levelDoors.find((door) => door.id === activeDoorId) ?? levelDoors[0],
    [activeDoorId],
  );

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
    scene.background = new THREE.Color(0x101318);
    scene.fog = new THREE.Fog(0x101318, 15, 36);

    const camera = new THREE.PerspectiveCamera(
      68,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 5.8, 8);
    camera.lookAt(0, 1, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.48);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(5, 9, 7);
    scene.add(keyLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(13.2, 80),
      new THREE.MeshStandardMaterial({
        color: 0x202a2d,
        roughness: 0.82,
        metalness: 0.08,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(6.6, 0.08, 10, 96),
      new THREE.MeshStandardMaterial({
        color: 0xf5d06f,
        emissive: 0xf5d06f,
        emissiveIntensity: 0.22,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    scene.add(ring);

    const spawn = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.45, 0.18, 48),
      new THREE.MeshStandardMaterial({
        color: 0x89d8c2,
        emissive: 0x89d8c2,
        emissiveIntensity: 0.25,
      }),
    );
    spawn.position.y = 0.09;
    scene.add(spawn);

    const player = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.5, 1.25, 8, 16),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.38,
      }),
    );
    body.position.y = 1.12;
    player.add(body);
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0x89d8c2,
        emissive: 0x89d8c2,
        emissiveIntensity: 0.6,
      }),
    );
    visor.position.set(0, 1.72, -0.38);
    player.add(visor);
    player.position.set(0, 0, 0);
    scene.add(player);

    const doorGroups = levelDoors.map((door) => {
      const group = createDoor(door);
      scene.add(group);
      const light = new THREE.PointLight(door.color, 8, 8);
      light.position.set(...door.position);
      light.position.y = 2.2;
      scene.add(light);
      return group;
    });

    const keys = new Set<string>();
    const onKeyDown = (event: KeyboardEvent) => keys.add(event.key.toLowerCase());
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

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

      const move = new THREE.Vector3();
      if (keys.has("w") || keys.has("arrowup")) move.z -= 1;
      if (keys.has("s") || keys.has("arrowdown")) move.z += 1;
      if (keys.has("a") || keys.has("arrowleft")) move.x -= 1;
      if (keys.has("d") || keys.has("arrowright")) move.x += 1;
      move.x += touchMoveRef.current.x;
      move.z += touchMoveRef.current.z;
      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(5.4 * delta);
        player.position.add(move);
        player.position.x = THREE.MathUtils.clamp(player.position.x, -lobbyBounds, lobbyBounds);
        player.position.z = THREE.MathUtils.clamp(player.position.z, -lobbyBounds, lobbyBounds);
        player.rotation.y = Math.atan2(move.x, move.z);
      }

      let nearestDoor = levelDoors[0];
      let nearestDistance = Number.POSITIVE_INFINITY;
      const playerFlat = new THREE.Vector2(player.position.x, player.position.z);
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

      const isPortrait = canvas.clientHeight > canvas.clientWidth;
      const cameraHeight = isPortrait ? 5.2 : 7.4;
      const cameraDistance = isPortrait ? 7.3 : 9.5;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x, 0.08);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraHeight, 0.08);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, player.position.z + cameraDistance, 0.08);
      camera.lookAt(player.position.x, 1.3, player.position.z);
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
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

          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:flex sm:flex-wrap sm:items-start sm:justify-between sm:gap-4 sm:p-4">
            <button
              type="button"
              onClick={() => setPanelOpen((open) => !open)}
              className="pointer-events-auto flex max-w-[72vw] items-center gap-2 rounded-full border border-white/12 bg-[#101318]/76 px-3 py-2 text-left shadow-xl shadow-black/30 backdrop-blur sm:hidden"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#89d8c2]" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">
                  {activeDoor.name}
                </span>
                <span className="block truncate text-[11px] font-bold uppercase tracking-[0.08em] text-white/54">
                  {accessLabels[activeDoor.access]}
                </span>
              </span>
            </button>

            <div className="pointer-events-auto hidden rounded-md border border-white/12 bg-[#101318]/84 p-4 shadow-xl shadow-black/30 backdrop-blur sm:block sm:max-w-md">
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
                <div className="rounded-md border border-white/10 bg-white/[0.045] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                    Access
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {accessLabels[activeDoor.access]}
                  </p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.045] p-3">
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

            <div className="pointer-events-auto fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] w-[5.75rem] rounded-full border border-white/12 bg-[#101318]/76 p-1.5 shadow-xl shadow-black/30 backdrop-blur sm:static sm:w-full sm:max-w-sm sm:rounded-md sm:p-4">
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
                  className="grid h-10 flex-1 place-items-center rounded-full bg-[#89d8c2] px-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#08110f] transition hover:bg-[#a3f1dd] disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-11 sm:rounded-md sm:px-4 sm:text-xs sm:tracking-[0.14em]"
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
            <div className="pointer-events-auto absolute inset-x-3 bottom-40 z-20 rounded-md border border-white/12 bg-[#101318]/90 p-3 shadow-2xl shadow-black/40 backdrop-blur sm:hidden">
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
                  className="rounded-md border border-white/12 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-white/70"
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
              className="pointer-events-auto relative h-36 w-36 shrink-0 rounded-full border border-white/14 bg-[#101318]/48 shadow-xl shadow-black/30 backdrop-blur sm:hidden"
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
                event.currentTarget.releasePointerCapture(event.pointerId);
                stopTouchMovement();
              }}
              onPointerCancel={stopTouchMovement}
              role="application"
              aria-label="Move"
            >
              <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-white/10" />
              <div
                className="absolute left-1/2 top-1/2 h-16 w-16 rounded-full bg-[#89d8c2] shadow-[0_0_28px_rgba(137,216,194,0.34)]"
                style={{
                  transform: `translate(calc(-50% + ${stick.x * 38}px), calc(-50% + ${stick.y * 38}px))`,
                  opacity: stick.active ? 1 : 0.82,
                }}
              />
            </div>
            <div className="hidden rounded-md border border-white/12 bg-[#101318]/82 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white/70 shadow-xl shadow-black/30 backdrop-blur sm:block">
              Lobby online
            </div>
            <button
              type="button"
              onClick={() => {
                stopTouchMovement();
                disconnectVoice();
                setIsPlaying(false);
              }}
              className="pointer-events-auto min-h-11 rounded-md border border-white/16 bg-[#101318]/82 px-4 text-xs font-black uppercase tracking-[0.14em] text-white/72 shadow-xl shadow-black/30 backdrop-blur transition hover:border-white/34 hover:text-white"
            >
              Exit lobby
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
