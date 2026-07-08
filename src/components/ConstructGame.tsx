"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import * as THREE from "three";
import { storefronts, type Storefront } from "@/lib/content";
import {
  LobbyClient,
  type ChatMessage,
  type LobbyStatus,
  type PeerInfo,
} from "@/lib/lobby";

const EYE_HEIGHT = 2.2;
const MOVE_SPEED = 12;
const BOUNDS = { x: 70, zMin: -140, zMax: 20 };
const REVEAL_RADIUS = 13;
const RAIN_COUNT = 2200;

const ORB_COLORS = [
  "#8fb3ff",
  "#66e0ff",
  "#7dffa8",
  "#f0c36a",
  "#ff8fd6",
  "#ff6b6b",
  "#b28dff",
  "#e8ecff",
];

type ControlMode = "touch" | "gyro";

type SceneApi = {
  upsertPeer(peer: PeerInfo): void;
  movePeer(id: string, x: number, z: number): void;
  removePeer(id: string): void;
  recolorPeer(id: string, color: string): void;
  clearPeers(): void;
};

function subscribeToPointerType(callback: () => void) {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

// The lit sign band over each storefront: unit number + name in its accent.
function makeSignTexture(store: Storefront) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = store.accent;
    ctx.fillRect(0, 0, canvas.width, 5);
    ctx.fillRect(0, canvas.height - 5, canvas.width, 5);

    ctx.textBaseline = "middle";
    ctx.shadowColor = store.accent;
    ctx.shadowBlur = 22;
    ctx.textAlign = "left";
    ctx.font = "800 96px Arial";
    ctx.fillStyle = store.accent;
    ctx.fillText(store.number, 44, canvas.height / 2 + 4);

    ctx.font = "700 74px Arial";
    ctx.fillStyle = "#dbe5ff";
    ctx.fillText(store.name.toUpperCase(), 210, canvas.height / 2 + 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The customizable back-wall panel — a tenant's art today is a placeholder;
// this is the surface renters will drop their own images onto.
function makeArtTexture(store: Storefront) {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0c1119";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = store.accent;
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    ctx.textAlign = "center";
    ctx.shadowColor = store.accent;
    ctx.shadowBlur = 24;

    if (store.status === "vacant") {
      ctx.fillStyle = store.accent;
      ctx.font = "800 120px Arial";
      ctx.fillText("FOR LEASE", canvas.width / 2, 250);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#8b93a7";
      ctx.font = "600 40px Arial";
      ctx.fillText(`SPACE ${store.number}`, canvas.width / 2, 340);
      ctx.font = "400 34px Arial";
      ctx.fillText("Your images. Your products.", canvas.width / 2, 420);
      ctx.fillText("Your brand, on this wall.", canvas.width / 2, 470);
    } else {
      ctx.fillStyle = "#dbe5ff";
      ctx.font = "800 92px Arial";
      ctx.fillText(store.name.toUpperCase(), canvas.width / 2, 270);
      ctx.shadowBlur = 0;
      ctx.fillStyle = store.accent;
      ctx.font = "600 44px Arial";
      ctx.fillText(store.tagline, canvas.width / 2, 350);
      ctx.fillStyle = "#8b93a7";
      ctx.font = "400 32px Arial";
      ctx.fillText(
        store.status === "live" ? "Open — step inside" : "Now leasing this space",
        canvas.width / 2,
        430,
      );
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePeerLabelTexture(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.font = "700 40px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#0b1020";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#e8ecff";
    ctx.fillText(text, 256, 48);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255,255,255,0.85)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.28)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(canvas);
}

// --- Procedural ambience (no audio files needed) ---------------------------

type Ambience = {
  setProximity(v: number): void;
  setMuted(m: boolean): void;
  dispose(): void;
};

function createAmbience(startMuted: boolean): Ambience | null {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    if (!startMuted) {
      master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2.5);
    }

    // Low detuned drone — the hum of the machine
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.16;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = "lowpass";
    droneFilter.frequency.value = 240;
    droneGain.connect(droneFilter);
    droneFilter.connect(master);
    [
      { freq: 46, type: "sine" as const, level: 1 },
      { freq: 46.6, type: "sine" as const, level: 1 },
      { freq: 92.5, type: "triangle" as const, level: 0.35 },
    ].forEach((voice) => {
      const osc = ctx.createOscillator();
      osc.type = voice.type;
      osc.frequency.value = voice.freq;
      const gain = ctx.createGain();
      gain.gain.value = voice.level;
      osc.connect(gain);
      gain.connect(droneGain);
      osc.start();
    });

    // Airy shimmer — filtered noise drifting overhead like the rain
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i += 1) {
      channel[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const shimmerFilter = ctx.createBiquadFilter();
    shimmerFilter.type = "bandpass";
    shimmerFilter.frequency.value = 1500;
    shimmerFilter.Q.value = 8;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.02;
    noise.connect(shimmerFilter);
    shimmerFilter.connect(shimmerGain);
    shimmerGain.connect(master);
    noise.start();
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 600;
    lfo.connect(lfoDepth);
    lfoDepth.connect(shimmerFilter.frequency);
    lfo.start();

    // Proximity chord — swells as you approach a storefront
    const proxGain = ctx.createGain();
    proxGain.gain.value = 0;
    proxGain.connect(master);
    [196, 294].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(proxGain);
      osc.start();
    });

    return {
      setProximity(v: number) {
        proxGain.gain.setTargetAtTime(v * 0.06, ctx.currentTime, 0.25);
      },
      setMuted(m: boolean) {
        master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.15);
      },
      dispose() {
        ctx.close().catch(() => {});
      },
    };
  } catch {
    return null;
  }
}

// --- Device-orientation camera quaternion (AR-style look) -------------------

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const ZEE = new THREE.Vector3(0, 0, 1);
const orientEuler = new THREE.Euler();
const qScreen = new THREE.Quaternion();
const Q_FLIP = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

function setQuaternionFromOrientation(
  quaternion: THREE.Quaternion,
  alpha: number,
  beta: number,
  gamma: number,
  screenAngle: number,
) {
  orientEuler.set(beta, alpha, -gamma, "YXZ");
  quaternion.setFromEuler(orientEuler);
  quaternion.multiply(Q_FLIP); // camera looks out the back of the device
  quaternion.multiply(qScreen.setFromAxisAngle(ZEE, -screenAngle));
}

export default function ConstructGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const lockFnRef = useRef<(() => void) | null>(null);
  const modeRef = useRef<ControlMode>("touch");
  const ambienceRef = useRef<Ambience | null>(null);
  const mutedRef = useRef(false);
  const lobbyRef = useRef<LobbyClient | null>(null);
  const sceneApiRef = useRef<SceneApi | null>(null);
  const sendMoveRef = useRef<
    ((x: number, z: number, yaw: number) => void) | null
  >(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef("");
  const colorRef = useRef(ORB_COLORS[0]);

  const router = useRouter();
  const [locked, setLocked] = useState(false);
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState<ControlMode>("touch");
  const [muted, setMuted] = useState(false);
  const [nearStore, setNearStore] = useState<number>(-1);
  const [name, setName] = useState("");
  const [color, setColor] = useState(ORB_COLORS[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [online, setOnline] = useState(1);
  const [lobbyStatus, setLobbyStatus] = useState<LobbyStatus>("connecting");
  const isTouch = useSyncExternalStore(
    subscribeToPointerType,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );

  // saved identity + default chat visibility (desktop open, mobile closed);
  // localStorage is client-only, so this can't be a state initializer
  useEffect(() => {
    const savedName = localStorage.getItem("construct-name");
    const savedColor = localStorage.getItem("construct-color");
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(savedName || `guest-${Math.floor(1000 + Math.random() * 9000)}`);
    if (savedColor && ORB_COLORS.includes(savedColor)) setColor(savedColor);
    setChatOpen(!window.matchMedia("(pointer: coarse)").matches);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: 999999 });
  }, [messages]);

  // Press E inside a storefront that has an action (e.g. the Workshop) to open
  // it — the FPS "press E to interact" convention, alongside the button.
  useEffect(() => {
    const target = nearStore >= 0 ? storefronts[nearStore] : null;
    if (!target?.action) return;
    const href = target.action.href;
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (event.code === "KeyE") {
        if (document.pointerLockElement) document.exitPointerLock();
        router.push(href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nearStore, router]);

  const startAudio = () => {
    if (!ambienceRef.current) {
      ambienceRef.current = createAmbience(mutedRef.current);
    }
  };

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    ambienceRef.current?.setMuted(next);
  };

  const toggleMic = async () => {
    const client = lobbyRef.current;
    if (!client) return;
    if (client.micEnabled) {
      client.disableMic();
      setMicOn(false);
    } else {
      setMicOn(await client.enableMic());
    }
  };

  const pickColor = (value: string) => {
    setColor(value);
    localStorage.setItem("construct-color", value);
    lobbyRef.current?.setColor(value);
  };

  const ensureName = () => {
    const finalName =
      name.trim() || `guest-${Math.floor(1000 + Math.random() * 9000)}`;
    if (finalName !== name) setName(finalName);
    nameRef.current = finalName;
    localStorage.setItem("construct-name", finalName);
  };

  const submitChat = (event: FormEvent) => {
    event.preventDefault();
    const text = chatText.trim();
    if (text) lobbyRef.current?.sendChat(text);
    setChatText("");
  };

  const enterTouch = async (wantGyro: boolean) => {
    let nextMode: ControlMode = "touch";
    if (wantGyro) {
      // iOS requires an explicit permission grant from a user gesture
      const OrientationEvent = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      };
      try {
        if (typeof OrientationEvent.requestPermission === "function") {
          const result = await OrientationEvent.requestPermission();
          if (result === "granted") nextMode = "gyro";
        } else {
          nextMode = "gyro";
        }
      } catch {
        nextMode = "touch";
      }
    }
    modeRef.current = nextMode;
    setMode(nextMode);
    ensureName();
    startAudio();
    setEntered(true);
  };

  const enterDesktop = () => {
    ensureName();
    startAudio();
    setEntered(true);
    lockFnRef.current?.();
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // --- Scene -------------------------------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090b10);
    scene.fog = new THREE.Fog(0x090b10, 24, 145);

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      400,
    );
    camera.position.set(0, EYE_HEIGHT, 10);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

    const disposables: { dispose(): void }[] = [];

    // --- Floor grid ----------------------------------------------------------
    const grid = new THREE.GridHelper(400, 200, 0x8fb3ff, 0x26324a);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    scene.add(grid);
    disposables.push(grid.geometry, grid.material as THREE.Material);

    const floorGeometry = new THREE.PlaneGeometry(400, 400);
    const floorMaterial = new THREE.MeshBasicMaterial({
      color: 0x10141d,
      transparent: true,
      opacity: 0.9,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    scene.add(floor);
    disposables.push(floorGeometry, floorMaterial);

    // --- City block: rentable storefronts along a street ---------------------
    const STREET_HALF = 9; // half the street width between the two rows
    const STORE_W = 16; // unit frontage (runs along the street / z axis)
    const STORE_D = 13; // unit depth (into the building / x axis)
    const STORE_H = 7; // wall height
    const ROW_START_Z = -14; // first unit's center
    const ROW_STEP = STORE_W + 4; // frontage + gap between units

    // A darker roadway down the middle, with a dashed center line.
    const roadGeometry = new THREE.PlaneGeometry(STREET_HALF * 2, 150);
    const roadMaterial = new THREE.MeshBasicMaterial({ color: 0x0b0e15 });
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, -55);
    scene.add(road);
    disposables.push(roadGeometry, roadMaterial);

    const dashGeometry = new THREE.PlaneGeometry(0.35, 2.4);
    const dashMaterial = new THREE.MeshBasicMaterial({
      color: 0x2a3450,
      transparent: true,
      opacity: 0.8,
    });
    disposables.push(dashGeometry, dashMaterial);
    for (let z = 5; z > -115; z -= 6) {
      const dash = new THREE.Mesh(dashGeometry, dashMaterial);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.02, z);
      scene.add(dash);
    }

    // Shared geometry across all ten units (built with the opening facing +x).
    const backWallGeo = new THREE.BoxGeometry(0.3, STORE_H, STORE_W);
    const sideWallGeo = new THREE.BoxGeometry(STORE_D, STORE_H, 0.3);
    const ceilGeo = new THREE.BoxGeometry(STORE_D, 0.3, STORE_W);
    const unitFloorGeo = new THREE.BoxGeometry(STORE_D, 0.12, STORE_W);
    const postGeo = new THREE.BoxGeometry(0.5, STORE_H, 0.5);
    const awningGeo = new THREE.BoxGeometry(0.6, 1.5, STORE_W);
    const signGeo = new THREE.PlaneGeometry(STORE_W - 1.4, 1.3);
    const artGeo = new THREE.PlaneGeometry(STORE_W - 4, STORE_H - 3);
    const sillGeo = new THREE.BoxGeometry(0.5, 0.08, STORE_W);
    const backMat = new THREE.MeshBasicMaterial({ color: 0x161d2b });
    const sideMat = new THREE.MeshBasicMaterial({ color: 0x121826 });
    const ceilMat = new THREE.MeshBasicMaterial({ color: 0x0d121b });
    const unitFloorMat = new THREE.MeshBasicMaterial({ color: 0x0e131d });
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x2c3852,
      transparent: true,
      opacity: 0.7,
    });
    const backEdges = new THREE.EdgesGeometry(backWallGeo);
    const sideEdges = new THREE.EdgesGeometry(sideWallGeo);
    disposables.push(
      backWallGeo,
      sideWallGeo,
      ceilGeo,
      unitFloorGeo,
      postGeo,
      awningGeo,
      signGeo,
      artGeo,
      sillGeo,
      backMat,
      sideMat,
      ceilMat,
      unitFloorMat,
      edgeMat,
      backEdges,
      sideEdges,
    );

    const storePositions: THREE.Vector3[] = [];
    storefronts.forEach((store, i) => {
      const onLeft = i < 5;
      const rowIndex = onLeft ? i : i - 5;
      const z = ROW_START_Z - rowIndex * ROW_STEP;
      const groupX = onLeft
        ? -(STREET_HALF + STORE_D / 2)
        : STREET_HALF + STORE_D / 2;

      const group = new THREE.Group();
      group.position.set(groupX, 0, z);
      if (!onLeft) group.rotation.y = Math.PI; // opening faces the street

      const accent = new THREE.Color(store.accent);
      const accentMat = new THREE.MeshBasicMaterial({ color: accent });
      disposables.push(accentMat);

      // Shell
      const back = new THREE.Mesh(backWallGeo, backMat);
      back.position.set(-STORE_D / 2, STORE_H / 2, 0);
      group.add(back);
      const backLine = new THREE.LineSegments(backEdges, edgeMat);
      backLine.position.copy(back.position);
      group.add(backLine);

      for (const sz of [-STORE_W / 2, STORE_W / 2]) {
        const side = new THREE.Mesh(sideWallGeo, sideMat);
        side.position.set(0, STORE_H / 2, sz);
        group.add(side);
        const sideLine = new THREE.LineSegments(sideEdges, edgeMat);
        sideLine.position.copy(side.position);
        group.add(sideLine);
      }

      const ceil = new THREE.Mesh(ceilGeo, ceilMat);
      ceil.position.set(0, STORE_H, 0);
      group.add(ceil);

      const unitFloor = new THREE.Mesh(unitFloorGeo, unitFloorMat);
      unitFloor.position.set(0, 0.06, 0);
      group.add(unitFloor);

      // Storefront frame: posts, awning band, threshold sill (accent)
      for (const pz of [-STORE_W / 2, STORE_W / 2]) {
        const post = new THREE.Mesh(postGeo, accentMat);
        post.position.set(STORE_D / 2, STORE_H / 2, pz);
        group.add(post);
      }
      const awning = new THREE.Mesh(awningGeo, accentMat);
      awning.position.set(STORE_D / 2, STORE_H - 0.75, 0);
      group.add(awning);

      const sill = new THREE.Mesh(sillGeo, accentMat);
      sill.position.set(STORE_D / 2, 0.05, 0);
      group.add(sill);

      // Lit sign on the awning, facing the street
      const signTex = makeSignTexture(store);
      const signMat = new THREE.MeshBasicMaterial({
        map: signTex,
        transparent: true,
      });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(STORE_D / 2 + 0.34, STORE_H - 0.75, 0);
      sign.rotation.y = Math.PI / 2;
      group.add(sign);
      disposables.push(signTex, signMat);

      // Customizable back-wall art panel, facing the customer inside
      const artTex = makeArtTexture(store);
      const artMat = new THREE.MeshBasicMaterial({ map: artTex });
      const art = new THREE.Mesh(artGeo, artMat);
      art.position.set(-STORE_D / 2 + 0.18, STORE_H / 2 - 0.15, 0);
      art.rotation.y = Math.PI / 2;
      group.add(art);
      disposables.push(artTex, artMat);

      scene.add(group);

      // Proximity anchor at the doorway, out on the street side
      const doorX = onLeft ? -STREET_HALF : STREET_HALF;
      storePositions.push(new THREE.Vector3(doorX, 0, z));
    });

    // --- Falling code rain (3D points) ----------------------------------------
    const rainGeometry = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(RAIN_COUNT * 3);
    const rainSpeeds = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i += 1) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 300;
      rainPositions[i * 3 + 1] = Math.random() * 60;
      rainPositions[i * 3 + 2] = -140 + Math.random() * 180;
      rainSpeeds[i] = 2 + Math.random() * 7;
    }
    rainGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(rainPositions, 3),
    );
    const rainMaterial = new THREE.PointsMaterial({
      color: 0x8fb3ff,
      size: 0.22,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    });
    const rain = new THREE.Points(rainGeometry, rainMaterial);
    scene.add(rain);
    disposables.push(rainGeometry, rainMaterial);

    // --- Other visitors: glowing orbs -----------------------------------------
    type RemoteOrb = {
      group: THREE.Group;
      material: THREE.MeshBasicMaterial;
      glowMaterial: THREE.SpriteMaterial;
      labelTexture: THREE.CanvasTexture;
      labelMaterial: THREE.SpriteMaterial;
      target: THREE.Vector2;
      phase: number;
    };
    const remoteOrbs = new Map<string, RemoteOrb>();
    const orbGeometry = new THREE.SphereGeometry(0.5, 24, 24);
    const glowTexture = makeGlowTexture();
    disposables.push(orbGeometry, glowTexture);

    const removeOrb = (id: string) => {
      const orb = remoteOrbs.get(id);
      if (!orb) return;
      remoteOrbs.delete(id);
      scene.remove(orb.group);
      orb.material.dispose();
      orb.glowMaterial.dispose();
      orb.labelTexture.dispose();
      orb.labelMaterial.dispose();
    };

    sceneApiRef.current = {
      upsertPeer(peer) {
        removeOrb(peer.id);
        const group = new THREE.Group();
        group.position.set(peer.x, 1.6, peer.z);

        const material = new THREE.MeshBasicMaterial({ color: peer.color });
        group.add(new THREE.Mesh(orbGeometry, material));

        const glowMaterial = new THREE.SpriteMaterial({
          map: glowTexture,
          color: peer.color,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.9,
        });
        const glow = new THREE.Sprite(glowMaterial);
        glow.scale.set(3.2, 3.2, 1);
        group.add(glow);

        const labelTexture = makePeerLabelTexture(peer.name);
        const labelMaterial = new THREE.SpriteMaterial({
          map: labelTexture,
          transparent: true,
          depthWrite: false,
        });
        const label = new THREE.Sprite(labelMaterial);
        label.scale.set(4.5, 0.85, 1);
        label.position.y = 1.2;
        group.add(label);

        scene.add(group);
        remoteOrbs.set(peer.id, {
          group,
          material,
          glowMaterial,
          labelTexture,
          labelMaterial,
          target: new THREE.Vector2(peer.x, peer.z),
          phase: Math.random() * Math.PI * 2,
        });
      },
      movePeer(id, x, z) {
        remoteOrbs.get(id)?.target.set(x, z);
      },
      removePeer: removeOrb,
      recolorPeer(id, value) {
        const orb = remoteOrbs.get(id);
        if (!orb) return;
        orb.material.color.set(value);
        orb.glowMaterial.color.set(value);
      },
      clearPeers() {
        for (const id of [...remoteOrbs.keys()]) removeOrb(id);
      },
    };

    // --- Controls state ---------------------------------------------------------
    const keys = new Set<string>();
    let yaw = 0; // spawn facing down the -z street of storefronts
    let pitch = 0;
    let gyroYawOffset = 0; // swipe-to-turn on top of device orientation
    const yawOffsetQ = new THREE.Quaternion();

    const gyro = { alpha: 0, beta: 0, gamma: 0, has: false };
    let screenAngle = THREE.MathUtils.degToRad(
      window.screen.orientation?.angle ?? 0,
    );

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha === null) return;
      gyro.alpha = THREE.MathUtils.degToRad(event.alpha);
      gyro.beta = THREE.MathUtils.degToRad(event.beta ?? 0);
      gyro.gamma = THREE.MathUtils.degToRad(event.gamma ?? 0);
      gyro.has = true;
    };

    const onScreenRotate = () => {
      screenAngle = THREE.MathUtils.degToRad(
        window.screen.orientation?.angle ?? 0,
      );
    };

    const isTyping = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      return (
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event)) return;
      if (event.code === "Enter" || event.code === "NumpadEnter") {
        // jump to the group chat: free the cursor, open + focus the box
        if (document.pointerLockElement === renderer.domElement) {
          document.exitPointerLock();
        }
        setChatOpen(true);
        window.setTimeout(() => chatInputRef.current?.focus(), 50);
        return;
      }
      keys.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (isTyping(event)) return;
      keys.delete(event.code);
    };

    const applyLook = (dx: number, dy: number, sensitivity: number) => {
      yaw -= dx * sensitivity;
      pitch -= dy * sensitivity;
      pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
    };

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      applyLook(event.movementX, event.movementY, 0.0022);
    };

    const onPointerLockChange = () => {
      setLocked(document.pointerLockElement === renderer.domElement);
    };

    const requestLock = () => {
      if (!window.matchMedia("(pointer: coarse)").matches) {
        renderer.domElement.requestPointerLock();
      }
    };
    lockFnRef.current = requestLock;

    // --- Touch controls: left half = move stick, right half = look/turn ----------
    const touchState = {
      moveId: -1,
      moveStart: new THREE.Vector2(),
      moveDelta: new THREE.Vector2(),
      lookId: -1,
      lookLast: new THREE.Vector2(),
    };

    const onTouchStart = (event: TouchEvent) => {
      event.preventDefault();
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
          if (modeRef.current === "gyro") {
            // device handles pitch/roll; swiping turns the body
            gyroYawOffset -= (touch.clientX - touchState.lookLast.x) * 0.004;
            touchState.lookLast.set(touch.clientX, touch.clientY);
          } else {
            applyLook(
              touch.clientX - touchState.lookLast.x,
              touch.clientY - touchState.lookLast.y,
              0.0045,
            );
            touchState.lookLast.set(touch.clientX, touch.clientY);
          }
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
    document.addEventListener("pointerlockchange", onPointerLockChange);
    window.addEventListener("deviceorientation", onOrientation);
    window.screen.orientation?.addEventListener("change", onScreenRotate);
    renderer.domElement.addEventListener("click", requestLock);
    renderer.domElement.addEventListener("touchstart", onTouchStart, {
      passive: false,
    });
    renderer.domElement.addEventListener("touchmove", onTouchMove, {
      passive: false,
    });
    renderer.domElement.addEventListener("touchend", onTouchEnd);
    window.addEventListener("resize", onResize);

    // --- Animation loop ------------------------------------------------------------
    const clock = new THREE.Clock();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const velocity = new THREE.Vector3();
    let currentNear = -1;
    let animationFrame = 0;
    let lastBroadcast = 0;
    const lastSent = new THREE.Vector2(Infinity, Infinity);
    let lastSentYaw = 0;

    const animate = () => {
      animationFrame = window.requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      // orientation: AR-style from device sensors, or yaw/pitch from input
      if (modeRef.current === "gyro" && gyro.has) {
        setQuaternionFromOrientation(
          camera.quaternion,
          gyro.alpha,
          gyro.beta,
          gyro.gamma,
          screenAngle,
        );
        camera.quaternion.premultiply(
          yawOffsetQ.setFromAxisAngle(WORLD_UP, gyroYawOffset),
        );
      } else {
        camera.rotation.set(0, 0, 0);
        camera.rotateY(yaw);
        camera.rotateX(pitch);
      }

      // movement basis: where the camera faces, flattened to the floor
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() < 1e-4) {
        forward.set(0, 0, -1);
      } else {
        forward.normalize();
      }
      right.crossVectors(forward, WORLD_UP); // forward × up = right-hand side

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
        camera.position.addScaledVector(velocity, MOVE_SPEED * delta);
        camera.position.x = Math.max(
          -BOUNDS.x,
          Math.min(BOUNDS.x, camera.position.x),
        );
        camera.position.z = Math.max(
          BOUNDS.zMin,
          Math.min(BOUNDS.zMax, camera.position.z),
        );
      }

      // subtle idle bob (skip in gyro mode — the sensor already moves)
      if (modeRef.current !== "gyro") {
        camera.position.y = EYE_HEIGHT + Math.sin(elapsed * 1.4) * 0.035;
      } else {
        camera.position.y = EYE_HEIGHT;
      }

      // rain fall + wrap
      const positions = rainGeometry.attributes.position
        .array as Float32Array;
      for (let i = 0; i < RAIN_COUNT; i += 1) {
        positions[i * 3 + 1] -= rainSpeeds[i] * delta;
        if (positions[i * 3 + 1] < 0) {
          positions[i * 3 + 1] = 60;
        }
      }
      rainGeometry.attributes.position.needsUpdate = true;

      // remote orbs drift toward their latest reported spot and bob gently
      const smoothing = 1 - Math.exp(-8 * delta);
      remoteOrbs.forEach((orb) => {
        orb.group.position.x +=
          (orb.target.x - orb.group.position.x) * smoothing;
        orb.group.position.z +=
          (orb.target.y - orb.group.position.z) * smoothing;
        orb.group.position.y = 1.6 + Math.sin(elapsed * 1.8 + orb.phase) * 0.14;
      });

      // share our own position with the lobby ~10x/sec, only when it changed
      if (elapsed - lastBroadcast > 0.1) {
        const dx = camera.position.x - lastSent.x;
        const dz = camera.position.z - lastSent.y;
        if (dx * dx + dz * dz > 0.0004 || Math.abs(yaw - lastSentYaw) > 0.02) {
          sendMoveRef.current?.(camera.position.x, camera.position.z, yaw);
          lastSent.set(camera.position.x, camera.position.z);
          lastSentYaw = yaw;
        }
        lastBroadcast = elapsed;
      }

      // proximity check
      let nearest = -1;
      let nearestDistance = REVEAL_RADIUS;
      for (let i = 0; i < storePositions.length; i += 1) {
        const distance = Math.hypot(
          storePositions[i].x - camera.position.x,
          storePositions[i].z - camera.position.z,
        );
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = i;
        }
      }
      if (nearest !== currentNear) {
        currentNear = nearest;
        setNearStore(nearest);
      }
      ambienceRef.current?.setProximity(
        nearest === -1 ? 0 : 1 - nearestDistance / REVEAL_RADIUS,
      );

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      window.removeEventListener("deviceorientation", onOrientation);
      window.screen.orientation?.removeEventListener("change", onScreenRotate);
      renderer.domElement.removeEventListener("click", requestLock);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", onResize);
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      }
      sceneApiRef.current?.clearPeers();
      sceneApiRef.current = null;
      disposables.forEach((resource) => resource.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      ambienceRef.current?.dispose();
      ambienceRef.current = null;
    };
  }, []);

  // --- Join the shared lobby once the visitor enters ------------------------
  useEffect(() => {
    if (!entered) return;

    const pushSystem = (text: string) => {
      setMessages((prev) => [
        ...prev.slice(-80),
        {
          id: `sys-${Date.now()}-${Math.random()}`,
          name: "",
          color: "#8fb3ff",
          text,
          ts: Date.now(),
          system: true,
        },
      ]);
    };

    const client = new LobbyClient({
      onStatus: setLobbyStatus,
      onWelcome: (_selfId, peers) => {
        setOnline(peers.length + 1);
        peers.forEach((peer) => sceneApiRef.current?.upsertPeer(peer));
      },
      onPeerJoined: (peer) => {
        setOnline((count) => count + 1);
        sceneApiRef.current?.upsertPeer(peer);
        pushSystem(`${peer.name} entered the construct`);
      },
      onPeerLeft: (id, peerName) => {
        setOnline((count) => Math.max(1, count - 1));
        sceneApiRef.current?.removePeer(id);
        pushSystem(`${peerName} left`);
      },
      onPeerMoved: (id, x, z) => sceneApiRef.current?.movePeer(id, x, z),
      onPeerColor: (id, value) => sceneApiRef.current?.recolorPeer(id, value),
      onChat: (message) =>
        setMessages((prev) => [...prev.slice(-80), message]),
      onReset: () => {
        setOnline(1);
        sceneApiRef.current?.clearPeers();
      },
    });

    client.connect(nameRef.current, colorRef.current, 0, 10, 0);
    lobbyRef.current = client;
    sendMoveRef.current = (x, z, yaw) => client.sendMove(x, z, yaw);

    return () => {
      sendMoveRef.current = null;
      lobbyRef.current = null;
      client.dispose();
      setMicOn(false);
    };
  }, [entered]);

  const near = nearStore >= 0 ? storefronts[nearStore] : null;
  const nearStatusLabel =
    near?.status === "vacant"
      ? "available to rent"
      : near?.status === "live"
        ? "open now"
        : "now open";
  const showTouchOverlay = isTouch && !entered;
  const showDesktopOverlay = !isTouch && !entered;

  const identityControls = (
    <div className="flex w-full max-w-xs flex-col gap-4">
      <label className="flex flex-col gap-2 text-left">
        <span className="text-[10px] uppercase tracking-[0.25em] text-ink-dim">
          your name
        </span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={24}
          className="rounded-md border border-white/18 bg-white/[0.055] px-3 py-2 text-sm text-[#dbe5ff] outline-none focus:border-[#8fb3ff]/60"
        />
      </label>
      <div className="flex flex-col gap-2 text-left">
        <span className="text-[10px] uppercase tracking-[0.25em] text-ink-dim">
          your orb
        </span>
        <div className="flex flex-wrap gap-2.5">
          {ORB_COLORS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => pickColor(value)}
              aria-label={`orb color ${value}`}
              className={`h-8 w-8 rounded-full transition-transform ${
                color === value
                  ? "scale-110 ring-2 ring-white/80 ring-offset-2 ring-offset-black"
                  : "opacity-70 hover:opacity-100"
              }`}
              style={{ backgroundColor: value, boxShadow: `0 0 16px ${value}` }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div ref={hostRef} className="stage-fixed" />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {/* crosshair */}
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#dbe5ff]/80" />

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-2 p-4">
          <div className="flex items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#dbe5ff]">
              the construct
            </p>
            {entered && (
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink-dim">
                {lobbyStatus === "connected"
                  ? `${online} online`
                  : lobbyStatus === "connecting"
                    ? "connecting…"
                    : "reconnecting…"}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {entered && (
              <>
                <button
                  type="button"
                  onClick={toggleMic}
                  className={`pointer-events-auto rounded-md border px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] transition-colors ${
                    micOn
                      ? "border-[#7dffa8]/70 bg-[#7dffa8]/15 text-[#7dffa8]"
                      : "border-white/18 bg-white/[0.055] text-[#dbe5ff] hover:bg-[#dbe5ff] hover:text-[#0b1020]"
                  }`}
                >
                  {micOn ? "mic live" : "mic off"}
                </button>
                <button
                  type="button"
                  onClick={() => setChatOpen((open) => !open)}
                  className="pointer-events-auto rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
                >
                  chat
                </button>
              </>
            )}
            <button
              type="button"
              onClick={toggleMute}
              className="pointer-events-auto rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
            >
              {muted ? "sound off" : "sound on"}
            </button>
            <Link
              href="/rabbit-hole"
              className="pointer-events-auto rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
            >
              exit
            </Link>
          </div>
        </div>

        {/* controls hint */}
        <p className="absolute inset-x-0 bottom-4 px-4 text-center text-[11px] uppercase tracking-[0.25em] text-ink-dim">
          {isTouch
            ? mode === "gyro"
              ? "move your phone to look — left thumb: walk — swipe right side: turn"
              : "left thumb: walk — right thumb: look"
            : locked
              ? "wasd / arrows: move — mouse: look — enter: chat — esc: release cursor"
              : "cursor released — click the scene to look around again"}
        </p>

        {/* group chat */}
        {entered && chatOpen && (
          <div className="pointer-events-auto absolute bottom-14 left-4 flex w-[min(320px,78vw)] flex-col rounded-lg border border-white/14 bg-[#0b1020]/85 backdrop-blur-sm">
            <div
              ref={chatScrollRef}
              className="flex max-h-44 flex-col gap-1.5 overflow-y-auto p-3"
            >
              {messages.length === 0 && (
                <p className="text-[11px] text-ink-dim">
                  group chat — anyone in the construct can read this
                </p>
              )}
              {messages.map((message, index) =>
                message.system ? (
                  <p
                    key={`${message.ts}-${index}`}
                    className="text-[11px] italic text-ink-dim"
                  >
                    {message.text}
                  </p>
                ) : (
                  <p
                    key={`${message.ts}-${index}`}
                    className="break-words text-xs leading-snug text-ink-soft"
                  >
                    <span className="font-bold" style={{ color: message.color }}>
                      {message.name}
                    </span>{" "}
                    {message.text}
                  </p>
                ),
              )}
            </div>
            <form onSubmit={submitChat} className="border-t border-white/10 p-2">
              <input
                ref={chatInputRef}
                value={chatText}
                onChange={(event) => setChatText(event.target.value)}
                maxLength={280}
                placeholder="type to chat…"
                className="w-full bg-transparent px-1 text-xs text-[#dbe5ff] outline-none placeholder:text-ink-dim"
              />
            </form>
          </div>
        )}

        {/* storefront placard */}
        {near && (
          <div className="absolute inset-x-0 bottom-14 flex justify-center px-4">
            <div className="max-w-md rounded-lg border border-white/14 bg-[#0b1020]/88 p-5 text-center backdrop-blur-sm">
              <p
                className="text-[11px] font-bold uppercase tracking-[0.28em]"
                style={{ color: near.accent }}
              >
                unit {near.number} · {nearStatusLabel}
              </p>
              <p className="mt-1.5 text-lg font-black tracking-tight text-[#dbe5ff]">
                {near.name}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                {near.status === "vacant"
                  ? "This space is for lease — put your images, products, and brand on these walls."
                  : near.tagline}
              </p>
              {near.action && (
                <Link
                  href={near.action.href}
                  className="pointer-events-auto mt-4 inline-block rounded-md border border-[#8fb3ff]/60 bg-[#121826]/72 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
                >
                  {near.action.label}
                  <span className="ml-2 hidden text-[10px] text-ink-dim sm:inline">
                    or press E
                  </span>
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* enter overlay (desktop) */}
      {showDesktopOverlay && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-black/80 px-6 py-10 text-center">
          <p className="text-2xl font-black uppercase tracking-[0.24em] text-[#dbe5ff]">
            the construct
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            A virtual city block. Walk the street, step into the storefronts,
            and claim a space of your own. Anyone else inside appears as a
            glowing orb — talk, or type in the group chat.
          </p>
          {identityControls}
          <button
            type="button"
            onClick={enterDesktop}
            className="w-full max-w-xs rounded-md border border-[#8fb3ff]/60 bg-[#121826]/72 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
          >
            enter the construct
          </button>
          <Link
            href="/rabbit-hole"
            className="text-xs uppercase tracking-[0.22em] text-ink-dim underline-offset-4 transition-colors hover:text-[#dbe5ff] hover:underline"
          >
            back to the environment page
          </Link>
        </div>
      )}

      {/* tap-to-enter overlay (mobile) — pick control style */}
      {showTouchOverlay && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 overflow-y-auto bg-black/85 px-6 py-10 text-center">
          <p className="text-2xl font-black uppercase tracking-[0.24em] text-[#dbe5ff]">
            the construct
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            A virtual city block of storefronts. Walk in, look around, and claim
            a space. Anyone else inside appears as a glowing orb — talk, or type
            in the group chat.
          </p>
          {identityControls}
          <button
            type="button"
            onClick={() => enterTouch(true)}
            className="w-full max-w-xs rounded-md border border-[#8fb3ff]/60 bg-[#121826]/72 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors active:bg-[#dbe5ff] active:text-[#0b1020]"
          >
            enter with motion controls
            <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-ink-soft">
              move your phone to look around, AR style
            </span>
          </button>
          <button
            type="button"
            onClick={() => enterTouch(false)}
            className="w-full max-w-xs rounded-md border border-white/18 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-ink-soft transition-colors active:bg-[#dbe5ff] active:text-[#0b1020]"
          >
            enter with touch controls
            <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-ink-dim">
              drag to look, thumb to walk
            </span>
          </button>
          <Link
            href="/rabbit-hole"
            className="mt-2 text-xs uppercase tracking-[0.22em] text-ink-dim underline-offset-4 transition-colors hover:text-[#dbe5ff]"
          >
            back to the environment page
          </Link>
        </div>
      )}
    </div>
  );
}
