"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  GATES,
  GATE_RING_RADIUS,
  LOBBY_WATER_LEVEL,
  PLAZA_RADIUS,
  WALK_RADIUS,
  buildIslandGeometry,
  islandHeightAt,
} from "@/lib/lobby-island";
import { createGalaxySky } from "@/lib/galaxy";
import { createVoiceMesh, requestMicrophone, type VoiceMesh } from "@/lib/voice";

const EYE_HEIGHT = 2.0;
const MOVE_SPEED = 8;
const RUN_SPEED = 14;
const SKY_COLOR = 0x05060f; // horizon fog — deep space indigo
const GATE_REVEAL_RADIUS = 9;
const POS_SEND_INTERVAL_MS = 100;

// --- wire protocol (mirror of server/lobby.mjs) ------------------------------

type PeerInfo = {
  id: string;
  name: string;
  hue: number;
  p: [number, number, number];
  ry: number;
  mic: boolean;
};

type ServerMessage =
  | { t: "welcome"; id: string; peers: PeerInfo[] }
  | { t: "join"; peer: PeerInfo }
  | { t: "leave"; id: string }
  | { t: "pos"; id: string; p: [number, number, number]; ry: number }
  | { t: "mic"; id: string; on: boolean }
  | { t: "hue"; id: string; h: number }
  | { t: "rtc"; from: string; data: unknown }
  | { t: "census"; total: number; desktop: number; mobile: number };

type Me = { name: string };
type Progress = { xp: number; points: number; avatarHue: number };

// --- avatar construction ------------------------------------------------------

// glowing room-number sign that hovers over each gate
function makeRoomLabelTexture(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.font = "bold 72px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = color;
    ctx.shadowBlur = 26;
    ctx.fillStyle = color;
    // double pass thickens the glow without blurring the letterforms
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 10;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeNameTexture(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.font = "bold 44px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(190,215,255,0.85)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#f2f6ff";
    ctx.fillText(text.slice(0, 20), canvas.width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

type Avatar = {
  group: THREE.Group;
  bodyMaterial: THREE.MeshLambertMaterial;
  micRing: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  targetPos: THREE.Vector3;
  targetRy: number;
  mic: boolean;
  disposables: { dispose(): void }[];
};

function createAvatar(name: string, hue: number): Avatar {
  const group = new THREE.Group();
  const disposables: { dispose(): void }[] = [];

  const color = new THREE.Color().setHSL(hue / 360, 0.7, 0.55);
  const glow = new THREE.Color().setHSL(hue / 360, 0.9, 0.25);
  const bodyMaterial = new THREE.MeshLambertMaterial({
    color,
    emissive: glow,
    flatShading: true,
  });

  const bodyGeometry = new THREE.CapsuleGeometry(0.5, 0.85, 3, 8);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 1.1;
  group.add(body);

  const headGeometry = new THREE.IcosahedronGeometry(0.3, 1);
  const head = new THREE.Mesh(headGeometry, bodyMaterial);
  head.position.y = 2.15;
  group.add(head);

  const ringGeometry = new THREE.TorusGeometry(0.42, 0.045, 8, 24);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x9fe8ff,
    transparent: true,
    opacity: 0.9,
  });
  const micRing = new THREE.Mesh(ringGeometry, ringMaterial);
  micRing.rotation.x = Math.PI / 2;
  micRing.position.y = 2.7;
  micRing.visible = false;
  group.add(micRing);

  const nameTexture = makeNameTexture(name);
  const nameMaterial = new THREE.SpriteMaterial({
    map: nameTexture,
    transparent: true,
    depthTest: false,
  });
  const label = new THREE.Sprite(nameMaterial);
  label.scale.set(4.6, 0.86, 1);
  label.position.y = 3.25;
  group.add(label);

  disposables.push(
    bodyGeometry,
    headGeometry,
    ringGeometry,
    ringMaterial,
    bodyMaterial,
    nameTexture,
    nameMaterial,
  );

  return {
    group,
    bodyMaterial,
    micRing,
    targetPos: new THREE.Vector3(),
    targetRy: 0,
    mic: false,
    disposables,
  };
}

// --- component -----------------------------------------------------------------

export default function Lobby() {
  const hostRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef(140);
  const nameRef = useRef("visitor");
  const mutedRef = useRef(false);

  const [me, setMe] = useState<Me | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [hue, setHue] = useState(140);
  const [entered, setEntered] = useState(false);
  const [muted, setMuted] = useState(false);
  const [listenOnly, setListenOnly] = useState(false);
  const [playerCount, setPlayerCount] = useState(1);
  const [census, setCensus] = useState<{ desktop: number; mobile: number } | null>(
    null,
  );
  const [connection, setConnection] = useState<"connecting" | "open" | "lost">(
    "connecting",
  );
  const [nearGate, setNearGate] = useState<number>(-1);
  const voiceRef = useRef<VoiceMesh | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/progress").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([meData, progressData]) => {
        if (cancelled) return;
        if (meData?.user) {
          setMe({ name: meData.user.name || meData.user.email.split("@")[0] });
          nameRef.current =
            meData.user.name || meData.user.email.split("@")[0];
        }
        if (progressData?.progress) {
          setProgress(progressData.progress);
          setHue(progressData.progress.avatarHue);
          hueRef.current = progressData.progress.avatarHue;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    voiceRef.current?.setMicEnabled(!next);
  };

  const enter = async () => {
    hueRef.current = hue;
    // persist identity + stamp the visit (first visit grants arrival XP)
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarHue: hue }),
    }).catch(() => {});
    fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ joinedLobby: true }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.progress && setProgress(d.progress))
      .catch(() => {});
    setEntered(true);
  };

  useEffect(() => {
    if (!entered) return;
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;

    // --- scene ---------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY_COLOR);
    scene.fog = new THREE.Fog(SKY_COLOR, 60, 220);

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      500,
    );
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnR = PLAZA_RADIUS * 0.5;
    camera.position.set(
      Math.cos(spawnAngle) * spawnR,
      islandHeightAt(Math.cos(spawnAngle) * spawnR, Math.sin(spawnAngle) * spawnR) +
        EYE_HEIGHT,
      Math.sin(spawnAngle) * spawnR,
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

    const disposables: { dispose(): void }[] = [];

    const skyLight = new THREE.HemisphereLight(0x8895b8, 0x1b1d22, 1.0);
    scene.add(skyLight);
    const moon = new THREE.DirectionalLight(0xdfe6ff, 0.85);
    moon.position.set(-120, 200, 80);
    scene.add(moon);
    disposables.push(skyLight, moon);

    // the galaxy overhead — painted at load, wrapped on an inward sphere
    const sky = createGalaxySky(420);
    scene.add(sky.mesh);
    disposables.push(sky);

    // island
    const islandGeometry = buildIslandGeometry();
    const islandMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    scene.add(new THREE.Mesh(islandGeometry, islandMaterial));
    disposables.push(islandGeometry, islandMaterial);

    // dark water ring
    const waterGeometry = new THREE.PlaneGeometry(700, 700);
    const waterMaterial = new THREE.MeshLambertMaterial({
      color: 0x0d2137,
      transparent: true,
      opacity: 0.85,
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = LOBBY_WATER_LEVEL;
    scene.add(water);
    disposables.push(waterGeometry, waterMaterial);

    // central beacon — the heart of the nexus, moonlight made solid
    const beaconGeometry = new THREE.CylinderGeometry(0.6, 1.1, 26, 6, 1, true);
    const beaconMaterial = new THREE.MeshBasicMaterial({
      color: 0xbfe8ff,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
    });
    const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial);
    beacon.position.set(0, islandHeightAt(0, 0) + 13, 0);
    scene.add(beacon);
    // solid core so the pillar reads from anywhere on the island
    const coreGeometry = new THREE.CylinderGeometry(0.22, 0.22, 26, 6);
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xf0f7ff });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.copy(beacon.position);
    scene.add(core);
    disposables.push(coreGeometry, coreMaterial);
    const beaconLight = new THREE.PointLight(0xa8d4ff, 60, 60, 1.6);
    beaconLight.position.set(0, islandHeightAt(0, 0) + 4, 0);
    scene.add(beaconLight);
    disposables.push(beaconGeometry, beaconMaterial, beaconLight);

    // sealed gates — the escape rooms to come
    const pillarGeometry = new THREE.BoxGeometry(0.9, 7, 0.9);
    const lintelGeometry = new THREE.BoxGeometry(5.4, 0.9, 0.9);
    const sealGeometry = new THREE.PlaneGeometry(3.6, 6.1);
    const gateMaterial = new THREE.MeshLambertMaterial({ color: 0x12141c });
    const sealMaterial = new THREE.MeshBasicMaterial({
      color: 0x05060d,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
    });
    // an open gate glows like a doorway full of dawn
    const openSealMaterial = new THREE.MeshBasicMaterial({
      color: 0x9fd8ff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    });
    const gateEdgeMaterial = new THREE.LineBasicMaterial({ color: 0xc9a45e });
    const openEdgeMaterial = new THREE.LineBasicMaterial({ color: 0xd8ecff });
    const pillarEdges = new THREE.EdgesGeometry(pillarGeometry);
    const lintelEdges = new THREE.EdgesGeometry(lintelGeometry);
    disposables.push(
      pillarGeometry,
      lintelGeometry,
      sealGeometry,
      gateMaterial,
      sealMaterial,
      openSealMaterial,
      gateEdgeMaterial,
      openEdgeMaterial,
      pillarEdges,
      lintelEdges,
    );

    const gatePositions: THREE.Vector3[] = [];
    const roomSigns: { sprite: THREE.Sprite; baseY: number; phase: number }[] =
      [];
    GATES.forEach((gate, gateIndex) => {
      const gx = Math.cos(gate.angle) * GATE_RING_RADIUS;
      const gz = Math.sin(gate.angle) * GATE_RING_RADIUS;
      const gy = islandHeightAt(gx, gz);
      const group = new THREE.Group();
      group.position.set(gx, gy, gz);
      group.rotation.y = -gate.angle + Math.PI / 2; // face the beacon

      const left = new THREE.Mesh(pillarGeometry, gateMaterial);
      left.position.set(-2.25, 3.5, 0);
      const right = new THREE.Mesh(pillarGeometry, gateMaterial);
      right.position.set(2.25, 3.5, 0);
      const lintel = new THREE.Mesh(lintelGeometry, gateMaterial);
      lintel.position.set(0, 7.2, 0);
      const open = Boolean(gate.href);
      const seal = new THREE.Mesh(
        sealGeometry,
        open ? openSealMaterial : sealMaterial,
      );
      seal.position.set(0, 3.4, 0);
      group.add(left, right, lintel, seal);
      [
        [pillarEdges, left] as const,
        [pillarEdges, right] as const,
        [lintelEdges, lintel] as const,
      ].forEach(([edges, mesh]) => {
        const line = new THREE.LineSegments(
          edges,
          open ? openEdgeMaterial : gateEdgeMaterial,
        );
        line.position.copy(mesh.position);
        group.add(line);
      });
      if (open) {
        const doorLight = new THREE.PointLight(0x9fd8ff, 30, 26, 1.8);
        doorLight.position.set(0, 4, 2.5);
        group.add(doorLight);
        disposables.push(doorLight);
      }

      // the room number, hovering and glowing above the doorway
      const signText = `ROOM ${String(gateIndex + 1).padStart(2, "0")}`;
      const signColor = open ? "#b8e6ff" : "#e8b662";
      const signTexture = makeRoomLabelTexture(signText, signColor);
      const signMaterial = new THREE.SpriteMaterial({
        map: signTexture,
        transparent: true,
        depthWrite: false,
      });
      const sign = new THREE.Sprite(signMaterial);
      sign.scale.set(6.4, 1.6, 1);
      sign.position.y = 9.1; // floats above the lintel
      group.add(sign);
      disposables.push(signTexture, signMaterial);
      roomSigns.push({
        sprite: sign,
        baseY: 9.1,
        phase: gateIndex * 1.7,
      });

      scene.add(group);
      gatePositions.push(new THREE.Vector3(gx, 0, gz));
    });

    // --- remote players --------------------------------------------------------
    const avatars = new Map<string, Avatar>();

    const addAvatar = (peer: PeerInfo) => {
      if (avatars.has(peer.id)) return;
      const avatar = createAvatar(peer.name, peer.hue);
      avatar.targetPos.set(peer.p[0], peer.p[1], peer.p[2]);
      avatar.targetRy = peer.ry;
      avatar.mic = peer.mic;
      avatar.group.position.copy(avatar.targetPos);
      scene.add(avatar.group);
      avatars.set(peer.id, avatar);
      setPlayerCount(avatars.size + 1);
    };

    const removeAvatar = (id: string) => {
      const avatar = avatars.get(id);
      if (!avatar) return;
      scene.remove(avatar.group);
      avatar.disposables.forEach((d) => d.dispose());
      avatars.delete(id);
      setPlayerCount(avatars.size + 1);
    };

    // --- networking + voice ------------------------------------------------------
    let socket: WebSocket | null = null;
    let reconnectTimer = 0;
    let reconnectDelay = 2000;

    const sendJson = (obj: unknown) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(obj));
    };

    let voice: VoiceMesh | null = null;
    const voiceReady = requestMicrophone().then((stream) => {
      if (disposed) {
        stream?.getTracks().forEach((t) => t.stop());
        return null;
      }
      if (!stream) setListenOnly(true);
      voice = createVoiceMesh(stream, (to, data) =>
        sendJson({ t: "rtc", to, data }),
      );
      voice.resume();
      voice.setMicEnabled(!mutedRef.current && stream !== null);
      voiceRef.current = voice;
      if (stream) sendJson({ t: "mic", on: !mutedRef.current });
      return voice;
    });

    const connect = () => {
      if (disposed) return;
      setConnection("connecting");
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocol}://${location.host}/ws/lobby`);

      socket.onopen = () => {
        setConnection("open");
        reconnectDelay = 2000;
        if (voice?.micAvailable()) {
          sendJson({ t: "mic", on: !mutedRef.current });
        }
      };

      socket.onmessage = (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        switch (msg.t) {
          case "welcome":
            msg.peers.forEach((peer) => {
              addAvatar(peer);
              // the newcomer dials everyone already present
              voiceReady.then((v) => v?.callPeer(peer.id));
            });
            break;
          case "join":
            addAvatar(msg.peer); // they dial us
            break;
          case "leave":
            removeAvatar(msg.id);
            voice?.removePeer(msg.id);
            break;
          case "pos": {
            const avatar = avatars.get(msg.id);
            if (avatar) {
              avatar.targetPos.set(msg.p[0], msg.p[1], msg.p[2]);
              avatar.targetRy = msg.ry;
            }
            break;
          }
          case "mic": {
            const avatar = avatars.get(msg.id);
            if (avatar) avatar.mic = msg.on;
            break;
          }
          case "hue": {
            const avatar = avatars.get(msg.id);
            if (avatar) {
              avatar.bodyMaterial.color.setHSL(msg.h / 360, 0.7, 0.55);
              avatar.bodyMaterial.emissive.setHSL(msg.h / 360, 0.9, 0.25);
            }
            break;
          }
          case "rtc":
            voiceReady.then((v) => v?.handleSignal(msg.from, msg.data));
            break;
          case "census":
            setCensus({ desktop: msg.desktop, mobile: msg.mobile });
            break;
        }
      };

      socket.onclose = () => {
        if (disposed) return;
        setConnection("lost");
        // the mesh follows the room: everyone re-pairs on reconnect
        for (const id of [...avatars.keys()]) {
          removeAvatar(id);
          voice?.removePeer(id);
        }
        reconnectTimer = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 15_000);
      };
      socket.onerror = () => socket?.close();
    };
    connect();

    // position broadcast, throttled, only when something changed
    const lastSent = new THREE.Vector3(Infinity, Infinity, Infinity);
    let lastSentRy = Infinity;
    let yaw = Math.atan2(camera.position.x, camera.position.z); // face the beacon
    let pitch = 0;
    const posTimer = window.setInterval(() => {
      const feetY = camera.position.y - EYE_HEIGHT;
      if (
        Math.abs(camera.position.x - lastSent.x) > 0.02 ||
        Math.abs(feetY - lastSent.y) > 0.02 ||
        Math.abs(camera.position.z - lastSent.z) > 0.02 ||
        Math.abs(yaw - lastSentRy) > 0.02
      ) {
        lastSent.set(camera.position.x, feetY, camera.position.z);
        lastSentRy = yaw;
        sendJson({
          t: "pos",
          p: [camera.position.x, feetY, camera.position.z],
          ry: yaw,
        });
      }
    }, POS_SEND_INTERVAL_MS);

    // --- controls (desktop pointer lock + WASD, mobile dual thumb) ---------------
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => keys.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);

    const applyLook = (dx: number, dy: number, sensitivity: number) => {
      yaw -= dx * sensitivity;
      pitch -= dy * sensitivity;
      pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
    };

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      applyLook(event.movementX, event.movementY, 0.0022);
    };

    const requestLock = () => {
      if (!window.matchMedia("(pointer: coarse)").matches) {
        const result = renderer.domElement.requestPointerLock() as unknown as
          | Promise<void>
          | undefined;
        result?.catch?.(() => {});
      }
      voice?.resume();
    };

    const touchState = {
      moveId: -1,
      moveStart: new THREE.Vector2(),
      moveDelta: new THREE.Vector2(),
      lookId: -1,
      lookLast: new THREE.Vector2(),
    };

    const onTouchStart = (event: TouchEvent) => {
      event.preventDefault();
      voice?.resume();
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.clientX < window.innerWidth / 2 && touchState.moveId === -1) {
          touchState.moveId = touch.identifier;
          touchState.moveStart.set(touch.clientX, touch.clientY);
          touchState.moveDelta.set(0, 0);
        } else if (touchState.lookId === -1) {
          touchState.lookId = touch.identifier;
          touchState.lookLast.set(touch.clientX, touch.clientY);
        }
      }
    };

    const onTouchMove = (event: TouchEvent) => {
      event.preventDefault();
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === touchState.moveId) {
          touchState.moveDelta.set(
            (touch.clientX - touchState.moveStart.x) / 60,
            (touch.clientY - touchState.moveStart.y) / 60,
          );
          touchState.moveDelta.clampScalar(-1, 1);
        } else if (touch.identifier === touchState.lookId) {
          applyLook(
            touch.clientX - touchState.lookLast.x,
            touch.clientY - touchState.lookLast.y,
            0.0045,
          );
          touchState.lookLast.set(touch.clientX, touch.clientY);
        }
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      for (const touch of Array.from(event.changedTouches)) {
        if (touch.identifier === touchState.moveId) {
          touchState.moveId = -1;
          touchState.moveDelta.set(0, 0);
        } else if (touch.identifier === touchState.lookId) {
          touchState.lookId = -1;
        }
      }
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("click", requestLock);
    renderer.domElement.addEventListener("touchstart", onTouchStart, {
      passive: false,
    });
    renderer.domElement.addEventListener("touchmove", onTouchMove, {
      passive: false,
    });
    renderer.domElement.addEventListener("touchend", onTouchEnd);
    window.addEventListener("resize", onResize);
    requestLock();

    // --- animation loop -----------------------------------------------------------
    const clock = new THREE.Clock();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const velocity = new THREE.Vector3();
    const voicePos = new THREE.Vector3();
    let currentNearGate = -1;
    let animationFrame = 0;

    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      camera.rotation.set(0, 0, 0);
      camera.rotateY(yaw);
      camera.rotateX(pitch);

      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-4) forward.set(0, 0, -1);
      else forward.normalize();
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

      velocity.set(0, 0, 0);
      if (keys.has("KeyW") || keys.has("ArrowUp")) velocity.add(forward);
      if (keys.has("KeyS") || keys.has("ArrowDown")) velocity.sub(forward);
      if (keys.has("KeyD") || keys.has("ArrowRight")) velocity.add(right);
      if (keys.has("KeyA") || keys.has("ArrowLeft")) velocity.sub(right);
      if (touchState.moveId !== -1) {
        velocity.addScaledVector(forward, -touchState.moveDelta.y);
        velocity.addScaledVector(right, touchState.moveDelta.x);
      }
      if (velocity.lengthSq() > 0) {
        if (velocity.lengthSq() > 1) velocity.normalize();
        const running = keys.has("ShiftLeft") || keys.has("ShiftRight");
        camera.position.addScaledVector(
          velocity,
          (running ? RUN_SPEED : MOVE_SPEED) * delta,
        );
      }

      // the island is finite — hold everyone inside the ring
      const fromCenter = Math.hypot(camera.position.x, camera.position.z);
      if (fromCenter > WALK_RADIUS) {
        const scale = WALK_RADIUS / fromCenter;
        camera.position.x *= scale;
        camera.position.z *= scale;
      }

      const groundY = Math.max(
        islandHeightAt(camera.position.x, camera.position.z),
        LOBBY_WATER_LEVEL - 1.2,
      );
      const bob = Math.sin(elapsed * 1.4) * 0.03;
      camera.position.y = groundY + EYE_HEIGHT + bob;

      // room signs hover and breathe their glow
      for (const sign of roomSigns) {
        sign.sprite.position.y =
          sign.baseY + Math.sin(elapsed * 0.9 + sign.phase) * 0.22;
        sign.sprite.material.opacity =
          0.82 + Math.sin(elapsed * 1.6 + sign.phase) * 0.18;
      }

      // breathe the beacon
      beaconMaterial.opacity = 0.26 + Math.sin(elapsed * 1.1) * 0.08;
      beaconLight.intensity = 55 + Math.sin(elapsed * 1.1) * 15;
      water.position.x = camera.position.x;
      water.position.z = camera.position.z;

      // remote avatars glide toward their latest reported spot
      const smoothing = 1 - Math.exp(-10 * delta);
      for (const [id, avatar] of avatars) {
        avatar.group.position.lerp(avatar.targetPos, smoothing);
        let dYaw = avatar.targetRy - avatar.group.rotation.y;
        dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
        avatar.group.rotation.y += dYaw * smoothing;

        const level = voice?.peerLevel(id) ?? 0;
        avatar.micRing.visible = avatar.mic;
        if (avatar.mic) {
          const pulse = 1 + level * 1.6;
          avatar.micRing.scale.setScalar(pulse);
          avatar.micRing.material.opacity = 0.35 + level * 0.65;
        }

        // voices live at head height on the avatar
        voicePos.copy(avatar.group.position);
        voicePos.y += 2.1;
        voice?.setPeerPosition(id, voicePos);
      }
      voice?.updateListener(camera);

      // gate proximity → HUD card
      let nearest = -1;
      let nearestDistance = GATE_REVEAL_RADIUS;
      for (let i = 0; i < gatePositions.length; i += 1) {
        const distance = Math.hypot(
          gatePositions[i].x - camera.position.x,
          gatePositions[i].z - camera.position.z,
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = i;
        }
      }
      if (nearest !== currentNearGate) {
        currentNearGate = nearest;
        setNearGate(nearest);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(posTimer);
      window.cancelAnimationFrame(animationFrame);
      socket?.close();
      voiceReady.then((v) => v?.dispose());
      voiceRef.current = null;
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("click", requestLock);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", onResize);
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      }
      for (const id of [...avatars.keys()]) removeAvatar(id);
      disposables.forEach((resource) => resource.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [entered]);

  const gate = nearGate >= 0 ? GATES[nearGate] : null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div ref={hostRef} className="stage-fixed" />

      {entered && (
        <div className="pointer-events-none absolute inset-0 z-10">
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-matrix/80" />

          {/* top bar */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
            <div>
              <p className="glow-green text-xs uppercase tracking-[0.3em] text-matrix">
                the nexus
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-ink-dim">
                {playerCount} jacked in
                {census &&
                  ` — ${census.desktop} desktop · ${census.mobile} mobile`}
                {connection !== "open" && (
                  <span className="ml-2 animate-pulse text-pill-red">
                    {connection === "connecting" ? "linking…" : "re-linking…"}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {listenOnly ? (
                <span className="rounded-full border border-line px-4 py-2 text-xs uppercase tracking-[0.2em] text-ink-dim">
                  listen-only
                </span>
              ) : (
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`pointer-events-auto rounded-full border px-4 py-2 text-xs uppercase tracking-[0.2em] transition-colors ${
                    muted
                      ? "border-pill-red text-pill-red"
                      : "border-matrix-dim text-matrix hover:bg-matrix hover:text-black"
                  }`}
                >
                  {muted ? "mic muted" : "mic live"}
                </button>
              )}
              <Link
                href="/rabbit-hole/game"
                className="pointer-events-auto rounded-full border border-matrix-dim px-4 py-2 text-xs uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
              >
                the construct
              </Link>
              <Link
                href="/rabbit-hole"
                className="pointer-events-auto rounded-full border border-matrix-dim px-4 py-2 text-xs uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
              >
                jack out
              </Link>
            </div>
          </div>

          {/* identity + xp chip */}
          <div className="absolute bottom-14 left-4">
            <p className="rounded-full border border-white/15 bg-black/55 px-4 py-2 text-[11px] tracking-wide text-white/75 backdrop-blur-sm">
              <span
                className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                style={{ background: `hsl(${hue} 70% 55%)` }}
              />
              {me?.name ?? "…"} · {progress?.xp ?? 0} xp
            </p>
          </div>

          {/* controls hint */}
          <p className="absolute inset-x-0 bottom-4 px-4 text-center text-[11px] uppercase tracking-[0.25em] text-ink-dim">
            wasd: move — shift: run — mouse: look — voices carry by distance
          </p>

          {/* gate card */}
          {gate && (
            <div className="absolute inset-x-0 bottom-14 flex justify-center px-4">
              <div className="max-w-xl rounded-2xl border border-matrix-dim bg-black/85 p-5 text-center backdrop-blur-sm">
                <p className="glow-green text-sm font-bold uppercase tracking-[0.25em] text-matrix">
                  {gate.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {gate.blurb ?? "Sealed. Something is growing behind this door."}
                </p>
                {gate.href && (
                  <Link
                    href={gate.href}
                    className="pointer-events-auto mt-4 inline-block rounded-full border border-matrix px-6 py-2 text-xs font-bold uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
                  >
                    step through →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* enter overlay — identity check, then the world */}
      {!entered && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/90 px-6 text-center">
          <p className="glow-green text-2xl font-bold uppercase tracking-[0.3em] text-matrix">
            the nexus
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            The lobby of the game. Everyone who is here right now is really
            here — walk up to someone and talk. Your voice carries exactly as
            far as it should.
          </p>

          <div className="w-full max-w-xs rounded-2xl border border-line bg-surface/70 p-5 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.25em] text-ink-dim">
              your form
            </p>
            <div className="mt-3 flex items-center gap-4">
              <span
                className="inline-block h-10 w-10 shrink-0 rounded-full border border-white/20"
                style={{ background: `hsl(${hue} 70% 55%)` }}
              />
              <input
                type="range"
                min={0}
                max={360}
                value={hue}
                onChange={(e) => setHue(Number(e.target.value))}
                className="w-full accent-current"
                style={{ color: `hsl(${hue} 70% 55%)` }}
                aria-label="avatar color"
              />
            </div>
            <p className="mt-3 text-left text-[11px] leading-relaxed text-ink-dim">
              {me ? `appearing as ${me.name}` : "checking identity…"} · your
              microphone connects when you enter — mute anytime
            </p>
          </div>

          <button
            type="button"
            onClick={enter}
            disabled={!me}
            className="w-full max-w-xs rounded-full border border-matrix bg-matrix-dark/60 px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black disabled:opacity-50"
          >
            enter the nexus
          </button>
          <Link
            href="/rabbit-hole"
            className="mt-2 text-xs uppercase tracking-[0.25em] text-ink-dim underline-offset-4 transition-colors hover:text-matrix"
          >
            ← back to the rabbit hole
          </Link>
        </div>
      )}
    </div>
  );
}
