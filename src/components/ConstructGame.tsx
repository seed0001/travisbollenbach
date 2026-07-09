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
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import {
  VRMLoaderPlugin,
  VRMUtils,
  type VRM,
  VRMHumanBoneName,
} from "@pixiv/three-vrm";
import { arena, storefronts } from "@/lib/content";
import {
  LobbyClient,
  type ChatMessage,
  type LobbyStatus,
  type PeerInfo,
} from "@/lib/lobby";

const EYE_HEIGHT = 2.2;
const MOVE_SPEED = 12;
const BOUNDS = { x: 70, zMin: -108, zMax: 20 };
const REVEAL_RADIUS = 13;
// The Superdome closes off the far end of the street. Walking into this
// forecourt zone (centered on the entrance) lets the visitor press E to enter.
const ARENA_ENTRANCE = { x: 0, z: -104, radius: 12 };
const ARENA_HREF = "/rabbit-hole/arena";
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
function makeSignTexture(number: string, name: string, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0b1020";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, canvas.width, 5);
    ctx.fillRect(0, canvas.height - 5, canvas.width, 5);

    ctx.textBaseline = "middle";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 22;
    ctx.textAlign = "left";
    ctx.font = "800 96px Arial";
    ctx.fillStyle = accent;
    ctx.fillText(number, 44, canvas.height / 2 + 4);

    ctx.font = "700 74px Arial";
    ctx.fillStyle = "#dbe5ff";
    ctx.fillText(name.toUpperCase(), 210, canvas.height / 2 + 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The giant marquee over the Superdome entrance. Driven by content.arena so
// the copy can be re-lettered from one place.
function makeBillboardTexture(
  title: string,
  subtitle: string,
  accent: string,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 10;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 34;
    ctx.fillStyle = accent;
    ctx.font = "900 168px Arial";
    ctx.fillText(title.toUpperCase(), canvas.width / 2, 170, canvas.width - 60);

    ctx.shadowBlur = 12;
    ctx.fillStyle = "#dbe5ff";
    ctx.font = "600 56px Arial";
    ctx.fillText(subtitle, canvas.width / 2, 310, canvas.width - 80);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// --- Studio wall content (client-safe mirror of lib/studios) ----------------

type WallKind = "empty" | "image" | "website" | "youtube";
type WallSlot = { id: string; kind: WallKind; src: string; title: string };
type AudioMode = "none" | "speech" | "fish" | "url";
type PublicStudio = {
  unit: string;
  claimed: boolean;
  studioName: string;
  proprietor: string;
  tagline: string;
  walls: WallSlot[];
  vrmSrc: string;
  avatarScale: number;
  avatarYaw: number;
  audioMode: AudioMode;
  audioText: string;
  audioUrl: string;
  aiEnabled: boolean;
  aiName: string;
  hasVoice: boolean;
};

function parseYouTubeId(input: string): string | null {
  const s = (input ?? "").trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.slice(1, 12);
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const m = u.pathname.match(/\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  } catch {
    /* not a url */
  }
  return null;
}

// The image URL to load onto a wall: uploads are same-origin, everything else
// (external images, YouTube thumbnails) goes through our proxy to dodge CORS.
function wallImageUrl(wall: WallSlot): string | null {
  if (wall.kind === "image") {
    if (!wall.src) return null;
    return wall.src.startsWith("/api/uploads")
      ? wall.src
      : `/api/proxy?url=${encodeURIComponent(wall.src)}`;
  }
  if (wall.kind === "youtube") {
    const id = parseYouTubeId(wall.src);
    if (!id) return null;
    return `/api/proxy?url=${encodeURIComponent(
      `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    )}`;
  }
  if (wall.kind === "website") {
    if (!/^https?:\/\//i.test(wall.src)) return null;
    // A rendered snapshot of the site's front page, served as an image.
    return `/api/shot?url=${encodeURIComponent(wall.src)}`;
  }
  return null;
}

// A blank framed panel for empty wall slots.
function makeBlankPosterTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 288;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0b1019";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(143,179,255,0.16)";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A website slot renders as a poster naming the destination.
function makeWebsitePosterTexture(url: string, title: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }
  if (ctx) {
    ctx.fillStyle = "#0c1220";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(143,179,255,0.5)";
    ctx.lineWidth = 6;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
    ctx.textAlign = "center";
    ctx.fillStyle = "#dbe5ff";
    ctx.font = "800 48px Arial";
    ctx.fillText(title || host, canvas.width / 2, 170, canvas.width - 80);
    ctx.fillStyle = "#8fb3ff";
    ctx.font = "600 30px Arial";
    ctx.fillText(host, canvas.width / 2, 220, canvas.width - 80);
    ctx.fillStyle = "#8b93a7";
    ctx.font = "500 24px Arial";
    ctx.fillText("click to visit", canvas.width / 2, 290);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A translucent play triangle shown over video posters.
function makePlayBadgeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(6,10,18,0.72)";
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(50, 40);
    ctx.lineTo(50, 88);
    ctx.lineTo(92, 64);
    ctx.closePath();
    ctx.fill();
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

// --- Proximity audio playback ------------------------------------------------
// Kept at module scope (not inside the component) so mutating the <audio>
// element and juggling the speech timer stays out of the hooks graph.
type AudioRefs = {
  el: { current: HTMLAudioElement | null };
  unit: { current: string | null };
  timer: { current: number | undefined };
  soundOn: { current: boolean };
  setNowPlaying: (name: string | null) => void;
};

function stopStallAudio(r: AudioRefs) {
  r.unit.current = null;
  if (r.timer.current) {
    window.clearTimeout(r.timer.current);
    r.timer.current = undefined;
  }
  r.el.current?.pause();
  window.speechSynthesis?.cancel();
  r.setNowPlaying(null);
}

// Spoken narration via the visitor's own browser, re-announced while they
// linger, so a "come rent this studio" line repeats every so often.
function speakStall(r: AudioRefs, text: string, unit: string) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.onend = () => {
    if (r.unit.current === unit && r.soundOn.current) {
      r.timer.current = window.setTimeout(() => {
        if (r.unit.current === unit && r.soundOn.current) {
          speakStall(r, text, unit);
        }
      }, 45000);
    }
  };
  synth.cancel();
  synth.speak(utter);
}

function startStallAudio(r: AudioRefs, studio: PublicStudio) {
  stopStallAudio(r);
  r.unit.current = studio.unit;
  if (studio.audioMode === "url" && studio.audioUrl) {
    let el = r.el.current;
    if (!el) {
      el = new Audio();
      el.preload = "none";
      r.el.current = el;
    }
    el.src = studio.audioUrl;
    el.loop = true; // music keeps going while you're in the zone
    el.volume = 0.6;
    // Autoplay may be blocked until a gesture; entering the Construct is one.
    el.play().catch(() => {});
    r.setNowPlaying(studio.studioName);
  } else if (studio.audioMode === "speech" && studio.audioText.trim()) {
    speakStall(r, studio.audioText.trim(), studio.unit);
    r.setNowPlaying(studio.studioName);
  } else if (studio.audioMode === "fish" && studio.audioText.trim()) {
    // The greeting is spoken by the owner's Fish voice, synthesized server-side
    // (their key stays server-only). Falls back to the browser voice on error.
    r.setNowPlaying(studio.studioName);
    playFishGreeting(r, studio.unit, studio.audioText.trim());
  }
}

async function playFishGreeting(r: AudioRefs, unit: string, text: string) {
  try {
    const res = await fetch("/api/studio/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unit, text }),
    });
    if (r.unit.current !== unit) return; // visitor already walked off
    if (!res.ok) {
      speakStall(r, text, unit); // no voice / error → browser fallback
      return;
    }
    const blob = await res.blob();
    if (r.unit.current !== unit) return;
    let el = r.el.current;
    if (!el) {
      el = new Audio();
      el.preload = "none";
      r.el.current = el;
    }
    el.src = URL.createObjectURL(blob);
    el.loop = false;
    el.volume = 0.75;
    el.play().catch(() => {});
  } catch {
    if (r.unit.current === unit) speakStall(r, text, unit);
  }
}

// Speak an AI host's reply in the store's Fish voice. Module-scope so mutating
// the audio element stays out of the component's hooks graph.
async function synthAssistantVoice(
  elRef: { current: HTMLAudioElement | null },
  setSpeaking: (v: boolean) => void,
  unit: string,
  text: string,
) {
  try {
    const res = await fetch("/api/studio/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unit, text }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    let el = elRef.current;
    if (!el) {
      el = new Audio();
      el.preload = "none";
      el.onended = () => setSpeaking(false);
      elRef.current = el;
    }
    el.src = URL.createObjectURL(blob);
    el.volume = 0.9;
    setSpeaking(true);
    await el.play().catch(() => setSpeaking(false));
  } catch {
    setSpeaking(false);
  }
}

export default function ConstructGame() {
  const hostRef = useRef<HTMLDivElement>(null);
  const lockFnRef = useRef<(() => void) | null>(null);
  const modeRef = useRef<ControlMode>("touch");
  const lobbyRef = useRef<LobbyClient | null>(null);
  const sceneApiRef = useRef<SceneApi | null>(null);
  const sendMoveRef = useRef<
    ((x: number, z: number, yaw: number) => void) | null
  >(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef("");
  const colorRef = useRef(ORB_COLORS[0]);
  const wallApiRef = useRef<{
    applyStudios: (studios: PublicStudio[]) => void;
    applyWall: (unit: string, wall: WallSlot) => void;
    applySign: (unit: string, name: string) => void;
    applyAvatar: (
      unit: string,
      vrmSrc: string,
      avatarScale: number,
      avatarYaw: number,
    ) => void;
  } | null>(null);
  const studiosRef = useRef<Map<string, PublicStudio>>(new Map());
  const ownedRef = useRef<Set<string>>(new Set());
  const overlayOpenRef = useRef(false);

  const router = useRouter();
  const [locked, setLocked] = useState(false);
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState<ControlMode>("touch");
  const [nearStore, setNearStore] = useState<number>(-1);
  // The unit whose interior the visitor is standing in (-1 = out on the
  // street). Gates the AI host chat — you have to step inside to talk.
  const [insideStore, setInsideStore] = useState<number>(-1);
  const [nearArena, setNearArena] = useState(false);
  const [focusedWall, setFocusedWall] = useState<{
    unit: string;
    wallId: string;
  } | null>(null);
  const [viewer, setViewer] = useState<{
    kind: WallKind;
    src: string;
    title: string;
  } | null>(null);
  const [editor, setEditor] = useState<(WallSlot & { unit: string }) | null>(
    null,
  );
  const [wallBusy, setWallBusy] = useState(false);
  const [wallError, setWallError] = useState("");
  const editorFileRef = useRef<HTMLInputElement>(null);
  // Reactive copies of the studio data for the HUD (refs feed the scene/effects)
  const [studioMap, setStudioMap] = useState<Map<string, PublicStudio>>(
    new Map(),
  );
  const [ownedUnits, setOwnedUnits] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [color, setColor] = useState(ORB_COLORS[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [online, setOnline] = useState(1);
  const [lobbyStatus, setLobbyStatus] = useState<LobbyStatus>("connecting");
  // Proximity audio: a storefront's ad plays when you walk up to it.
  const [soundOn, setSoundOn] = useState(true);
  const [audioNowPlaying, setAudioNowPlaying] = useState<string | null>(null);
  // AI host chat (opens when you step inside a store that has one).
  const [chatUnit, setChatUnit] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [aiInput, setAiInput] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [aiError, setAiError] = useState("");
  const assistantAudioRef = useRef<HTMLAudioElement | null>(null);
  const aiScrollRef = useRef<HTMLDivElement>(null);
  const soundOnRef = useRef(true);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioUnitRef = useRef<string | null>(null);
  const speechTimerRef = useRef<number | undefined>(undefined);
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
    soundOnRef.current = soundOn;
  }, [soundOn]);

  // --- Proximity audio: a stall's ad/jingle plays as you walk up to it -------
  // Playback lives in module-scope helpers (start/stopStallAudio) so element
  // mutation stays out of the hooks graph; here we just react to which unit is
  // nearby. All the pieces below are stable refs + a stable setter.
  useEffect(() => {
    if (!entered) return;
    const r: AudioRefs = {
      el: audioElRef,
      unit: audioUnitRef,
      timer: speechTimerRef,
      soundOn: soundOnRef,
      setNowPlaying: setAudioNowPlaying,
    };
    const near = nearStore >= 0 ? storefronts[nearStore] : null;
    const studio = near ? studioMap.get(near.number) : undefined;
    const hasAudio =
      !!studio &&
      ((studio.audioMode === "url" && !!studio.audioUrl) ||
        (studio.audioMode === "speech" && !!studio.audioText.trim()));
    if (!soundOn || !near || !hasAudio) {
      stopStallAudio(r);
      return;
    }
    if (audioUnitRef.current === near.number) return; // already sounding here
    startStallAudio(r, studio);
  }, [entered, nearStore, studioMap, soundOn]);

  // Silence everything when the Construct unmounts.
  useEffect(() => {
    return () =>
      stopStallAudio({
        el: audioElRef,
        unit: audioUnitRef,
        timer: speechTimerRef,
        soundOn: soundOnRef,
        setNowPlaying: setAudioNowPlaying,
      });
  }, []);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: 999999 });
  }, [messages]);

  useEffect(() => {
    aiScrollRef.current?.scrollTo({ top: 999999 });
  }, [aiMessages, aiBusy]);

  // --- AI host chat --------------------------------------------------------
  const stopAssistantVoice = () => {
    assistantAudioRef.current?.pause();
    setAiSpeaking(false);
  };

  const closeChat = () => {
    stopAssistantVoice();
    setChatUnit(null);
    setAiMessages([]);
    setAiInput("");
    setAiError("");
  };

  const openChat = (unit: string) => {
    if (document.pointerLockElement) document.exitPointerLock();
    setAiError("");
    setAiMessages([]);
    setAiInput("");
    setChatUnit(unit);
  };

  // Walking out of the shop closes its host chat (position is external state
  // we're syncing UI to, so the setState here is intentional).
  useEffect(() => {
    if (!chatUnit) return;
    const insideNumber =
      insideStore >= 0 ? storefronts[insideStore].number : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (insideNumber !== chatUnit) closeChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insideStore, chatUnit]);

  // Press T to talk to the host you're standing in front of; Esc closes it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        if (event.code === "Escape" && chatUnit) {
          (el as HTMLInputElement).blur();
          closeChat();
        }
        return;
      }
      const unit = insideStore >= 0 ? storefronts[insideStore].number : null;
      const hostHere = !!unit && !!studiosRef.current.get(unit)?.aiEnabled;
      if (event.code === "KeyT" && hostHere && !chatUnit && unit) {
        openChat(unit);
      } else if (event.code === "Escape" && chatUnit) {
        closeChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatUnit, insideStore]);

  const sendAiMessage = async () => {
    const unit = chatUnit;
    const text = aiInput.trim();
    if (!unit || !text || aiBusy) return;
    const studio = studiosRef.current.get(unit);
    const nextHistory = [
      ...aiMessages,
      { role: "user" as const, content: text },
    ];
    setAiMessages(nextHistory);
    setAiInput("");
    setAiBusy(true);
    setAiError("");
    stopAssistantVoice();
    try {
      const res = await fetch("/api/studio/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit, messages: nextHistory }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The host didn't respond.");
      const reply = String(data.reply ?? "").trim();
      if (!reply) throw new Error("The host had nothing to say.");
      setAiMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      if (studio?.hasVoice) {
        void synthAssistantVoice(assistantAudioRef, setAiSpeaking, unit, reply);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAiBusy(false);
    }
  };

  // Load the studios' wall content once inside, and note which units are ours.
  useEffect(() => {
    if (!entered) return;
    let cancelled = false;
    (async () => {
      try {
        const [pub, mine] = await Promise.all([
          fetch("/api/studios/public", { cache: "no-store" }).then((r) =>
            r.ok ? r.json() : { studios: [] },
          ),
          fetch("/api/studio", { cache: "no-store" }).then((r) =>
            r.ok ? r.json() : { studios: [] },
          ),
        ]);
        if (cancelled) return;
        const map = new Map<string, PublicStudio>();
        for (const s of pub.studios ?? []) map.set(s.unit, s);
        const owned = new Set<string>(
          (mine.studios ?? []).map((s: { unit: string }) => s.unit),
        );
        studiosRef.current = map;
        ownedRef.current = owned;
        setStudioMap(map);
        setOwnedUnits(owned);
        wallApiRef.current?.applyStudios([...map.values()]);
      } catch {
        /* studios are non-critical decoration */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entered]);

  useEffect(() => {
    overlayOpenRef.current = !!(viewer || editor || chatUnit);
  }, [viewer, editor, chatUnit]);

  // Stop the host's voice if the Construct unmounts mid-reply.
  useEffect(() => {
    const el = assistantAudioRef;
    return () => el.current?.pause();
  }, []);

  // Press E to interact with the wall under the crosshair: owners edit it,
  // everyone else plays/visits its content. Falls back to a storefront action
  // (the Workshop) when not looking at a wall. Esc closes any overlay.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (event.code === "Escape") {
        if (viewer) setViewer(null);
        else if (editor) setEditor(null);
        return;
      }
      if (event.code !== "KeyE" || viewer || editor) return;
      if (focusedWall) {
        const studio = studiosRef.current.get(focusedWall.unit);
        const wall = studio?.walls.find((w) => w.id === focusedWall.wallId);
        if (wall) {
          if (document.pointerLockElement) document.exitPointerLock();
          if (ownedRef.current.has(focusedWall.unit)) {
            setEditor({ ...wall, unit: focusedWall.unit });
          } else if (wall.kind !== "empty") {
            setViewer({ kind: wall.kind, src: wall.src, title: wall.title });
          }
          return;
        }
      }
      if (nearArena) {
        if (document.pointerLockElement) document.exitPointerLock();
        router.push(ARENA_HREF);
        return;
      }
      const target = nearStore >= 0 ? storefronts[nearStore] : null;
      if (target?.action) {
        if (document.pointerLockElement) document.exitPointerLock();
        router.push(target.action.href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedWall, viewer, editor, nearStore, nearArena, router]);

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

  const uploadWallImage = async (file: File) => {
    setWallBusy(true);
    setWallError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/studio/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setEditor((e) => (e ? { ...e, kind: "image", src: data.url } : e));
    } catch (err) {
      setWallError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setWallBusy(false);
    }
  };

  const saveWall = async () => {
    if (!editor) return;
    setWallBusy(true);
    setWallError("");
    const edited: WallSlot = {
      id: editor.id,
      kind: editor.kind,
      src: editor.src,
      title: editor.title,
    };
    const current = studiosRef.current.get(editor.unit);
    const walls = (current?.walls ?? [edited]).map((w) =>
      w.id === editor.id ? edited : w,
    );
    try {
      const res = await fetch("/api/studio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit: editor.unit, walls }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      const saved = data.studio as PublicStudio;
      const entry: PublicStudio = {
        unit: saved.unit,
        // Editing walls is owner-only, so this unit is claimed; the PATCH
        // payload doesn't carry `claimed`, so keep the current flag.
        claimed: current?.claimed ?? true,
        studioName: saved.studioName,
        proprietor: saved.proprietor ?? current?.proprietor ?? "",
        tagline: saved.tagline ?? current?.tagline ?? "",
        walls: saved.walls,
        vrmSrc: saved.vrmSrc ?? current?.vrmSrc ?? "",
        avatarScale: saved.avatarScale ?? current?.avatarScale ?? 1,
        avatarYaw: saved.avatarYaw ?? current?.avatarYaw ?? 0,
        audioMode: saved.audioMode ?? current?.audioMode ?? "none",
        audioText: saved.audioText ?? current?.audioText ?? "",
        audioUrl: saved.audioUrl ?? current?.audioUrl ?? "",
        // AI config isn't edited here (wall edit); carry the current values.
        aiEnabled: current?.aiEnabled ?? false,
        aiName: current?.aiName ?? "",
        hasVoice: current?.hasVoice ?? false,
      };
      studiosRef.current.set(saved.unit, entry);
      setStudioMap((prev) => new Map(prev).set(saved.unit, entry));
      wallApiRef.current?.applySign(saved.unit, saved.studioName);
      for (const w of saved.walls) wallApiRef.current?.applyWall(saved.unit, w);
      setEditor(null);
    } catch (err) {
      setWallError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setWallBusy(false);
    }
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
    setEntered(true);
  };

  const enterDesktop = () => {
    ensureName();
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

    // The world's own surfaces are unlit (MeshBasicMaterial), but uploaded VRM
    // avatars use lit materials — give them light so they're not black.
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);
    const keyLight = new THREE.DirectionalLight(0xdbe5ff, 1.6);
    keyLight.position.set(6, 14, 8);
    scene.add(keyLight);
    const hemiLight = new THREE.HemisphereLight(0xbcd0ff, 0x0b1020, 0.8);
    scene.add(hemiLight);

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
    const posterGeo = new THREE.PlaneGeometry(6.4, 3.3);
    const posterFrameGeo = new THREE.PlaneGeometry(6.9, 3.8);
    const badgeGeo = new THREE.PlaneGeometry(1.5, 1.5);
    const sillGeo = new THREE.BoxGeometry(0.5, 0.08, STORE_W);
    const blankPosterTex = makeBlankPosterTexture();
    const playBadgeTex = makePlayBadgeTexture();
    const badgeMat = new THREE.MeshBasicMaterial({
      map: playBadgeTex,
      transparent: true,
      depthWrite: false,
    });
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
      posterGeo,
      posterFrameGeo,
      badgeGeo,
      sillGeo,
      backMat,
      sideMat,
      ceilMat,
      unitFloorMat,
      edgeMat,
      backEdges,
      sideEdges,
      blankPosterTex,
      playBadgeTex,
      badgeMat,
    );

    // Registry of every wall poster so their textures can be swapped when a
    // studio loads or its owner edits it, and so clicks can be routed.
    type Poster = {
      unit: string;
      wallId: string;
      content: THREE.Mesh;
      material: THREE.MeshBasicMaterial;
      badge: THREE.Mesh;
      ownTex: THREE.Texture | null; // texture we created for this slot (to dispose)
    };
    const posters = new Map<string, Poster>();
    // Each unit's lit sign, so an owner's name change can be re-rendered onto it.
    const signs = new Map<
      string,
      { material: THREE.MeshBasicMaterial; ownTex: THREE.Texture }
    >();
    const posterMeshes: THREE.Mesh[] = [];
    const textureLoader = new THREE.TextureLoader();
    let sceneDisposed = false;

    const posterKey = (unit: string, wallId: string) => `${unit}:${wallId}`;

    // Point a poster at a wall's current content (image / youtube / website /
    // blank), disposing whatever texture it held before.
    const applyWall = (wall: WallSlot, unit: string) => {
      const poster = posters.get(posterKey(unit, wall.id));
      if (!poster) return;
      poster.badge.visible = wall.kind === "youtube";

      const clearOwn = () => {
        if (poster.ownTex) {
          poster.ownTex.dispose();
          poster.ownTex = null;
        }
      };

      const setTex = (tex: THREE.Texture) => {
        clearOwn();
        poster.ownTex = tex;
        poster.material.map = tex;
        poster.material.needsUpdate = true;
      };
      const setBlank = () => {
        clearOwn();
        poster.material.map = blankPosterTex;
        poster.material.needsUpdate = true;
      };
      // If a website screenshot can't be fetched, fall back to a poster naming
      // the site so the wall still reads as that destination.
      const setWebsitePoster = () =>
        setTex(makeWebsitePosterTexture(wall.src, wall.title));

      if (wall.kind === "empty") {
        setBlank();
        return;
      }

      // image / youtube thumbnail / website screenshot all load as a bitmap
      const url = wallImageUrl(wall);
      if (!url) {
        if (wall.kind === "website") setWebsitePoster();
        else setBlank();
        return;
      }
      textureLoader.load(
        url,
        (tex) => {
          if (sceneDisposed) {
            tex.dispose();
            return;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          setTex(tex);
        },
        undefined,
        () => {
          if (wall.kind === "website") setWebsitePoster();
          else setBlank();
        },
      );
    };

    // Re-render a unit's awning sign with the owner's chosen studio name,
    // falling back to the static content name when none is set.
    const applySign = (unit: string, name: string) => {
      const entry = signs.get(unit);
      const store = storefronts.find((s) => s.number === unit);
      if (!entry || !store) return;
      const tex = makeSignTexture(store.number, name || store.name, store.accent);
      entry.material.map = tex;
      entry.material.needsUpdate = true;
      entry.ownTex.dispose();
      entry.ownTex = tex;
    };

    const storePositions: THREE.Vector3[] = [];
    // Interior center + orientation for each unit, so an uploaded avatar can be
    // dropped inside and paced along the frontage.
    const avatarAnchors = new Map<
      string,
      { x: number; z: number; onLeft: boolean }
    >();
    storefronts.forEach((store, i) => {
      const onLeft = i < 5;
      const rowIndex = onLeft ? i : i - 5;
      const z = ROW_START_Z - rowIndex * ROW_STEP;
      const groupX = onLeft
        ? -(STREET_HALF + STORE_D / 2)
        : STREET_HALF + STORE_D / 2;
      avatarAnchors.set(store.number, { x: groupX, z, onLeft });

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

      // Lit sign on the awning, facing the street. Registered so the owner's
      // studio name can replace the static content name once studios load.
      const signTex = makeSignTexture(store.number, store.name, store.accent);
      const signMat = new THREE.MeshBasicMaterial({
        map: signTex,
        transparent: true,
      });
      const sign = new THREE.Mesh(signGeo, signMat);
      sign.position.set(STORE_D / 2 + 0.34, STORE_H - 0.75, 0);
      sign.rotation.y = Math.PI / 2;
      group.add(sign);
      disposables.push(signTex, signMat);
      signs.set(store.number, { material: signMat, ownTex: signTex });

      // Three customizable poster walls: the back wall and the two sides.
      const posterSlots: {
        wallId: string;
        pos: [number, number, number];
        rotY: number;
      }[] = [
        {
          wallId: "center",
          pos: [-STORE_D / 2 + 0.16, STORE_H / 2 + 0.1, 0],
          rotY: Math.PI / 2,
        },
        {
          wallId: "left",
          pos: [-0.5, STORE_H / 2 + 0.1, STORE_W / 2 - 0.16],
          rotY: Math.PI,
        },
        {
          wallId: "right",
          pos: [-0.5, STORE_H / 2 + 0.1, -STORE_W / 2 + 0.16],
          rotY: 0,
        },
      ];
      for (const slot of posterSlots) {
        const posterGroup = new THREE.Group();
        posterGroup.position.set(...slot.pos);
        posterGroup.rotation.y = slot.rotY;

        const frame = new THREE.Mesh(posterFrameGeo, accentMat);
        posterGroup.add(frame);

        const material = new THREE.MeshBasicMaterial({ map: blankPosterTex });
        const content = new THREE.Mesh(posterGeo, material);
        content.position.z = 0.04;
        content.userData = { unit: store.number, wallId: slot.wallId };
        posterGroup.add(content);
        posterMeshes.push(content);

        const badge = new THREE.Mesh(badgeGeo, badgeMat);
        badge.position.z = 0.06;
        badge.visible = false;
        posterGroup.add(badge);

        group.add(posterGroup);
        disposables.push(material);
        posters.set(posterKey(store.number, slot.wallId), {
          unit: store.number,
          wallId: slot.wallId,
          content,
          material,
          badge,
          ownTex: null,
        });
      }

      scene.add(group);

      // Proximity anchor at the doorway, out on the street side
      const doorX = onLeft ? -STREET_HALF : STREET_HALF;
      storePositions.push(new THREE.Vector3(doorX, 0, z));
    });

    // --- Uploaded avatars: a host that walks around inside each unit ----------
    // Formats: VRM gets a procedural humanoid walk; GLB/glTF/FBX that ship
    // their own animation clip play that clip while pacing; anything rigless
    // just glides along the path.
    type Avatar = {
      root: THREE.Object3D; // what we add to the scene and move
      vrm: VRM | null; // set only for VRM files (drives the procedural walk)
      mixer: THREE.AnimationMixer | null; // set when the model carries clips
      baseY: number; // rest height once scaled + stood on the floor
      normScale: number; // auto-fit scale that brings it to a normal height
      ownerScale: number; // owner's size multiplier on top of normScale
      yawOffset: number; // owner's facing correction, radians
      onLeft: boolean;
      ends: [number, number]; // the two z coordinates it paces between
      targetEnd: 0 | 1;
      state: "walk" | "pause";
      pauseUntil: number;
      gait: number; // walk-cycle accumulator (procedural VRM walk)
      bones: Partial<Record<string, THREE.Object3D | null>> | null;
    };
    const avatars = new Map<string, Avatar>();
    const AVATAR_PATROL_HALF = STORE_W / 2 - 3;
    const AVATAR_WALK_SPEED = 1.6; // metres/sec
    const AVATAR_FLOOR_Y = 0.12;
    const AVATAR_TARGET_HEIGHT = 1.7; // metres — normalize every model to this
    const gltfLoader = new GLTFLoader();
    gltfLoader.register((parser) => new VRMLoaderPlugin(parser));
    const fbxLoader = new FBXLoader();

    const bone = (vrm: VRM, name: VRMHumanBoneName) =>
      vrm.humanoid?.getNormalizedBoneNode(name) ?? null;
    const idleYawFor = (onLeft: boolean) => (onLeft ? Math.PI / 2 : -Math.PI / 2);
    const avatarExt = (src: string) =>
      (src.match(/\.(vrm|glb|gltf|fbx)$/i)?.[1] ?? "").toLowerCase();

    // Prefer a locomotion clip; fall back to idle, then whatever's first.
    const pickClip = (clips: THREE.AnimationClip[]) =>
      clips.find((c) => /walk|run|move|locomo/i.test(c.name)) ??
      clips.find((c) => /idle|stand|breath/i.test(c.name)) ??
      clips[0];

    const disposeObject3D = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      });
    };

    const removeAvatar = (unit: string) => {
      const existing = avatars.get(unit);
      if (!existing) return;
      avatars.delete(unit);
      existing.mixer?.stopAllAction();
      scene.remove(existing.root);
      if (existing.vrm) VRMUtils.deepDispose(existing.vrm.scene);
      else disposeObject3D(existing.root);
    };

    // Stand a (freshly scaled) model's feet on the floor, and report the y it
    // rests at so the walk bob can offset from it.
    const restOnFloor = (root: THREE.Object3D) => {
      root.position.y = 0;
      root.updateMatrixWorld(true);
      const minY = new THREE.Box3().setFromObject(root).min.y;
      root.position.y = AVATAR_FLOOR_Y - minY;
      return root.position.y;
    };

    // Scale a freshly loaded model to a consistent height, stand it on the
    // floor at its unit's anchor, and register it as a pacing avatar.
    const placeAvatar = (
      unit: string,
      anchor: { x: number; z: number; onLeft: boolean },
      src: string,
      root: THREE.Object3D,
      vrm: VRM | null,
      clips: THREE.AnimationClip[],
      ownerScale: number,
      yawOffset: number,
    ) => {
      if (sceneDisposed) {
        if (vrm) VRMUtils.deepDispose(vrm.scene);
        else disposeObject3D(root);
        return;
      }
      removeAvatar(unit); // replace any previous avatar for this unit
      root.traverse((obj) => {
        obj.frustumCulled = false;
      });

      // Auto-fit to a sane height (FBX especially arrives in cm / huge), then
      // apply the owner's size multiplier on top.
      root.position.set(anchor.x, 0, anchor.z);
      root.rotation.y = idleYawFor(anchor.onLeft);
      root.scale.setScalar(1);
      root.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
      const height = size.y > 1e-3 ? size.y : 1;
      const normScale = AVATAR_TARGET_HEIGHT / height;
      root.scale.setScalar(normScale * ownerScale);

      // Stand its feet on the floor at the unit anchor, facing the street.
      const baseY = restOnFloor(root);
      root.userData.vrmSrc = src;
      scene.add(root);

      // Non-VRM models animate via their own clips (if any).
      let mixer: THREE.AnimationMixer | null = null;
      if (!vrm && clips.length > 0) {
        mixer = new THREE.AnimationMixer(root);
        mixer.clipAction(pickClip(clips)).play();
      }

      avatars.set(unit, {
        root,
        vrm,
        mixer,
        baseY,
        normScale,
        ownerScale,
        yawOffset,
        onLeft: anchor.onLeft,
        ends: [anchor.z - AVATAR_PATROL_HALF, anchor.z + AVATAR_PATROL_HALF],
        targetEnd: 0,
        state: "pause",
        pauseUntil: 0,
        gait: 0,
        bones: vrm
          ? {
              spine: bone(vrm, VRMHumanBoneName.Spine),
              chest: bone(vrm, VRMHumanBoneName.Chest),
              head: bone(vrm, VRMHumanBoneName.Head),
              leftUpperArm: bone(vrm, VRMHumanBoneName.LeftUpperArm),
              rightUpperArm: bone(vrm, VRMHumanBoneName.RightUpperArm),
              leftUpperLeg: bone(vrm, VRMHumanBoneName.LeftUpperLeg),
              rightUpperLeg: bone(vrm, VRMHumanBoneName.RightUpperLeg),
              leftLowerLeg: bone(vrm, VRMHumanBoneName.LeftLowerLeg),
              rightLowerLeg: bone(vrm, VRMHumanBoneName.RightLowerLeg),
            }
          : null,
      });
    };

    const loadAvatar = (
      unit: string,
      src: string,
      ownerScale: number,
      yawOffset: number,
    ) => {
      const anchor = avatarAnchors.get(unit);
      if (!anchor) return;
      // an avatar is decoration — a failed load shouldn't break the world
      const onError = () => {};
      if (avatarExt(src) === "fbx") {
        fbxLoader.load(
          src,
          (obj) =>
            placeAvatar(
              unit,
              anchor,
              src,
              obj,
              null,
              obj.animations ?? [],
              ownerScale,
              yawOffset,
            ),
          undefined,
          onError,
        );
        return;
      }
      gltfLoader.load(
        src,
        (gltf) => {
          const vrm = (gltf.userData.vrm as VRM | undefined) ?? null;
          if (vrm) VRMUtils.rotateVRM0(vrm); // VRM0 faces -Z; align it to +Z
          const root = vrm ? vrm.scene : gltf.scene;
          placeAvatar(
            unit,
            anchor,
            src,
            root,
            vrm,
            gltf.animations ?? [],
            ownerScale,
            yawOffset,
          );
        },
        undefined,
        onError,
      );
    };

    const applyAvatar = (
      unit: string,
      src: string,
      avatarScaleDeg: number,
      avatarYawDeg: number,
    ) => {
      const scale = avatarScaleDeg > 0 ? avatarScaleDeg : 1;
      const yawOffset = THREE.MathUtils.degToRad(avatarYawDeg || 0);
      const current = avatars.get(unit);
      if (!src) {
        removeAvatar(unit);
        return;
      }
      // Same model already loaded: just re-apply the owner's size/facing in
      // place instead of reloading the whole file.
      if (current && current.root.userData.vrmSrc === src) {
        if (current.ownerScale !== scale) {
          current.ownerScale = scale;
          current.root.scale.setScalar(current.normScale * scale);
          current.baseY = restOnFloor(current.root);
        }
        current.yawOffset = yawOffset;
        return;
      }
      loadAvatar(unit, src, scale, yawOffset);
    };

    // Set a normalized humanoid bone's pose (relative to its neutral rest).
    const poseBone = (node: THREE.Object3D | null | undefined, x: number) => {
      if (node) node.rotation.x = x;
    };

    const updateAvatars = (elapsed: number, delta: number) => {
      avatars.forEach((avatar) => {
        const root = avatar.root;
        const b = avatar.bones;
        let desiredYaw: number;

        if (avatar.state === "walk") {
          const targetZ = avatar.ends[avatar.targetEnd];
          const dz = targetZ - root.position.z;
          const dir = dz >= 0 ? 1 : -1;
          const step = AVATAR_WALK_SPEED * delta;
          if (Math.abs(dz) <= step) {
            root.position.z = targetZ;
            avatar.state = "pause";
            avatar.pauseUntil = elapsed + 1 + Math.random() * 2.5;
          } else {
            root.position.z += dir * step;
          }
          desiredYaw = dir > 0 ? 0 : Math.PI; // face the way we're walking
          if (b) {
            // procedural humanoid gait (VRM only)
            avatar.gait += delta * 6.5;
            const swing = Math.sin(avatar.gait) * 0.5;
            poseBone(b.leftUpperLeg, swing);
            poseBone(b.rightUpperLeg, -swing);
            poseBone(b.leftLowerLeg, -Math.max(0, -swing) * 0.6);
            poseBone(b.rightLowerLeg, -Math.max(0, swing) * 0.6);
            poseBone(b.leftUpperArm, -swing * 0.45);
            poseBone(b.rightUpperArm, swing * 0.45);
            poseBone(b.spine, Math.abs(swing) * 0.05);
            root.position.y = avatar.baseY + Math.abs(Math.sin(avatar.gait)) * 0.04;
          } else {
            root.position.y = avatar.baseY;
          }
        } else {
          if (elapsed >= avatar.pauseUntil) {
            avatar.targetEnd = avatar.targetEnd === 0 ? 1 : 0;
            avatar.state = "walk";
          }
          desiredYaw = idleYawFor(avatar.onLeft); // face the street
          if (b) {
            const breathe = Math.sin(elapsed * 1.6) * 0.04;
            poseBone(b.spine, breathe);
            poseBone(b.chest, breathe * 0.5);
            poseBone(b.head, Math.sin(elapsed * 0.9) * 0.03);
            poseBone(b.leftUpperLeg, 0);
            poseBone(b.rightUpperLeg, 0);
            poseBone(b.leftLowerLeg, 0);
            poseBone(b.rightLowerLeg, 0);
            poseBone(b.leftUpperArm, 0);
            poseBone(b.rightUpperArm, 0);
          }
          root.position.y = avatar.baseY;
        }

        // Ease toward the desired facing (plus the owner's correction) along
        // the shortest arc.
        let diff = desiredYaw + avatar.yawOffset - root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        root.rotation.y += diff * Math.min(1, delta * 6);

        avatar.mixer?.update(delta);
        avatar.vrm?.update(delta);
      });
    };

    // --- The Arena: a domed game hall closing off the end of the street ------
    {
      const arenaAccent = new THREE.Color(arena.accent);
      const FACADE_Z = -120; // front face of the frontage
      const FACADE_H = 24; // frontage height
      const OPENING_HALF = 8; // half-width of the central entrance gap
      const FACADE_HALF = 34; // half-width of the whole frontage
      const LINTEL_H = FACADE_H - 11; // billboard band height over the doorway

      const arenaGroup = new THREE.Group();

      // Dark shell + neon edge/trim, matching the storefront material language.
      const arenaWallMat = new THREE.MeshBasicMaterial({ color: 0x0c1220 });
      const arenaTrimMat = new THREE.MeshBasicMaterial({ color: arenaAccent });
      const arenaEdgeMat = new THREE.LineBasicMaterial({
        color: arenaAccent,
        transparent: true,
        opacity: 0.5,
      });
      disposables.push(arenaWallMat, arenaTrimMat, arenaEdgeMat);

      // A faceted geodesic dome rising behind the frontage.
      const domeGeo = new THREE.SphereGeometry(
        36,
        22,
        12,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      );
      const domeMat = new THREE.MeshBasicMaterial({ color: 0x0a0f1b });
      const dome = new THREE.Mesh(domeGeo, domeMat);
      dome.position.set(0, 0, -156); // base ring front sits flush with FACADE_Z
      arenaGroup.add(dome);
      const domeWireMat = new THREE.MeshBasicMaterial({
        color: arenaAccent,
        wireframe: true,
        transparent: true,
        opacity: 0.14,
      });
      const domeWire = new THREE.Mesh(domeGeo, domeWireMat);
      domeWire.position.copy(dome.position);
      arenaGroup.add(domeWire);
      disposables.push(domeGeo, domeMat, domeWireMat);

      // Two frontage pillars flanking the central entrance gap.
      const pillarW = FACADE_HALF - OPENING_HALF;
      const pillarGeo = new THREE.BoxGeometry(pillarW, FACADE_H, 4);
      const pillarEdges = new THREE.EdgesGeometry(pillarGeo);
      disposables.push(pillarGeo, pillarEdges);
      for (const sx of [-1, 1]) {
        const pillar = new THREE.Mesh(pillarGeo, arenaWallMat);
        pillar.position.set(
          sx * (OPENING_HALF + pillarW / 2),
          FACADE_H / 2,
          FACADE_Z,
        );
        arenaGroup.add(pillar);
        const edges = new THREE.LineSegments(pillarEdges, arenaEdgeMat);
        edges.position.copy(pillar.position);
        arenaGroup.add(edges);
      }

      // Lintel spanning the entrance, carrying the billboard.
      const lintelGeo = new THREE.BoxGeometry(OPENING_HALF * 2 + 2, LINTEL_H, 4);
      const lintel = new THREE.Mesh(lintelGeo, arenaWallMat);
      lintel.position.set(0, FACADE_H - LINTEL_H / 2, FACADE_Z);
      arenaGroup.add(lintel);
      disposables.push(lintelGeo);

      // Accent threshold strip on the ground under the doorway.
      const thresholdGeo = new THREE.BoxGeometry(OPENING_HALF * 2, 0.12, 3);
      const threshold = new THREE.Mesh(thresholdGeo, arenaTrimMat);
      threshold.position.set(0, 0.06, FACADE_Z + 2.4);
      arenaGroup.add(threshold);
      disposables.push(thresholdGeo);

      // A curtain of light filling the entrance — "step through here".
      const portalGeo = new THREE.PlaneGeometry(OPENING_HALF * 2, LINTEL_H);
      const portalMat = new THREE.MeshBasicMaterial({
        color: arenaAccent,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const portal = new THREE.Mesh(portalGeo, portalMat);
      portal.position.set(0, LINTEL_H / 2, FACADE_Z + 0.3);
      arenaGroup.add(portal);
      disposables.push(portalGeo, portalMat);

      // The changeable billboard (see content.arena.billboard).
      const bbFrameGeo = new THREE.PlaneGeometry(OPENING_HALF * 2 + 2, 8);
      const bbFrame = new THREE.Mesh(bbFrameGeo, arenaTrimMat);
      bbFrame.position.set(0, FACADE_H - 5, FACADE_Z + 2.0);
      arenaGroup.add(bbFrame);
      const billboardTex = makeBillboardTexture(
        arena.billboard.title,
        arena.billboard.subtitle,
        arena.accent,
      );
      const billboardMat = new THREE.MeshBasicMaterial({
        map: billboardTex,
        transparent: true,
      });
      const billboardGeo = new THREE.PlaneGeometry(OPENING_HALF * 2 + 1, 7);
      const billboard = new THREE.Mesh(billboardGeo, billboardMat);
      billboard.position.set(0, FACADE_H - 5, FACADE_Z + 2.1);
      arenaGroup.add(billboard);
      disposables.push(bbFrameGeo, billboardTex, billboardMat, billboardGeo);

      scene.add(arenaGroup);
    }

    // Let React push studio content onto the walls as it loads / is edited.
    wallApiRef.current = {
      applyStudios(studios) {
        for (const studio of studios) {
          applySign(studio.unit, studio.studioName);
          for (const wall of studio.walls) applyWall(wall, studio.unit);
          applyAvatar(
            studio.unit,
            studio.vrmSrc ?? "",
            studio.avatarScale ?? 1,
            studio.avatarYaw ?? 0,
          );
        }
      },
      applyWall(unit, wall) {
        applyWall(wall, unit);
      },
      applySign(unit, name) {
        applySign(unit, name);
      },
      applyAvatar(unit, vrmSrc, avatarScale, avatarYaw) {
        applyAvatar(unit, vrmSrc, avatarScale, avatarYaw);
      },
    };
    // If studio data already arrived before the scene built, apply it now.
    if (studiosRef.current.size > 0) {
      wallApiRef.current.applyStudios([...studiosRef.current.values()]);
    }

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
    let currentInside = -1;
    let currentNearArena = false;
    let animationFrame = 0;
    let lastBroadcast = 0;
    const lastSent = new THREE.Vector2(Infinity, Infinity);
    let lastSentYaw = 0;
    const focusRay = new THREE.Raycaster();
    const SCREEN_CENTER = new THREE.Vector2(0, 0);
    let focusKey: string | null = null;
    let focusFrame = 0;

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

      if (overlayOpenRef.current) velocity.set(0, 0, 0);

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

      // uploaded store hosts pace around their units
      updateAvatars(elapsed, delta);

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

      // Which unit is the visitor standing *inside*? (its interior footprint —
      // gates the AI host chat, so it only opens once you step in.)
      let insideNow = -1;
      for (let i = 0; i < storefronts.length; i += 1) {
        const anchor = avatarAnchors.get(storefronts[i].number);
        if (!anchor) continue;
        if (
          Math.abs(camera.position.x - anchor.x) <= STORE_D / 2 &&
          Math.abs(camera.position.z - anchor.z) <= STORE_W / 2
        ) {
          insideNow = i;
          break;
        }
      }
      if (insideNow !== currentInside) {
        currentInside = insideNow;
        setInsideStore(insideNow);
      }

      // Arena entrance proximity (its own forecourt zone at the street's end)
      const nearArenaNow =
        Math.hypot(
          camera.position.x - ARENA_ENTRANCE.x,
          camera.position.z - ARENA_ENTRANCE.z,
        ) < ARENA_ENTRANCE.radius;
      if (nearArenaNow !== currentNearArena) {
        currentNearArena = nearArenaNow;
        setNearArena(nearArenaNow);
      }

      // Which poster wall is under the crosshair (throttled, paused in overlays)
      focusFrame += 1;
      if (!overlayOpenRef.current && focusFrame % 4 === 0) {
        focusRay.setFromCamera(SCREEN_CENTER, camera);
        const hit = focusRay
          .intersectObjects(posterMeshes, false)
          .find((h) => h.distance <= 15);
        const ud = hit
          ? (hit.object.userData as { unit: string; wallId: string })
          : null;
        const key = ud ? posterKey(ud.unit, ud.wallId) : null;
        if (key !== focusKey) {
          focusKey = key;
          setFocusedWall(ud);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      sceneDisposed = true;
      wallApiRef.current = null;
      posters.forEach((p) => p.ownTex?.dispose());
      [...avatars.keys()].forEach(removeAvatar);
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
  const nearStudio = near ? studioMap.get(near.number) : undefined;
  const nearMine = near ? ownedUnits.has(near.number) : false;
  // The store the visitor is standing inside, and its AI host (if any).
  const insideNumber =
    insideStore >= 0 ? storefronts[insideStore].number : null;
  const insideStudio = insideNumber ? studioMap.get(insideNumber) : undefined;
  const canTalk = !!insideStudio?.aiEnabled;
  const chatStudio = chatUnit ? studioMap.get(chatUnit) : undefined;
  const chatHostName =
    chatStudio?.aiName || chatStudio?.studioName || "the host";
  // A unit only reads "for lease" while it's a vacant slot no owner has taken.
  // Once claimed, the owner's signage (name, proprietor, spiel) takes over.
  const nearForLease = !!near && near.status === "vacant" && !nearStudio?.claimed;
  const nearName =
    (nearStudio?.studioName && nearStudio.studioName.trim()) ||
    near?.name ||
    "";
  const nearProprietor = nearStudio?.proprietor?.trim() ?? "";
  const nearStatusLabel = nearForLease
    ? "available to rent"
    : nearStudio?.claimed
      ? "now open"
      : near?.status === "live"
        ? "open now"
        : "now open";
  const nearBlurb = nearForLease
    ? "This space is for lease — put your images, products, and brand on these walls."
    : nearStudio?.tagline?.trim() ||
      (near?.status === "vacant"
        ? "Now open — step inside and look around."
        : (near?.tagline ?? ""));

  // Resolve the wall under the crosshair for the interaction prompt.
  const focusWall = (() => {
    if (!focusedWall) return null;
    const studio = studioMap.get(focusedWall.unit);
    const wall = studio?.walls.find((w) => w.id === focusedWall.wallId);
    if (!wall) return null;
    return { ...wall, mine: ownedUnits.has(focusedWall.unit) };
  })();
  const focusPrompt = focusWall
    ? focusWall.mine
      ? "Press E to edit this wall"
      : focusWall.kind === "youtube"
        ? "Press E to play"
        : focusWall.kind === "website"
          ? "Press E to visit"
          : focusWall.kind === "image"
            ? "Press E to view"
            : ""
    : "";

  const viewerImageSrc =
    viewer?.kind === "image" ? viewer.src : "";
  const viewerYouTube =
    viewer?.kind === "youtube" ? parseYouTubeId(viewer.src) : null;

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
                <button
                  type="button"
                  onClick={() => setSoundOn((on) => !on)}
                  className={`pointer-events-auto rounded-md border px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] transition-colors ${
                    soundOn
                      ? "border-[#8fb3ff]/70 bg-[#8fb3ff]/15 text-[#8fb3ff]"
                      : "border-white/18 bg-white/[0.055] text-[#dbe5ff] hover:bg-[#dbe5ff] hover:text-[#0b1020]"
                  }`}
                >
                  {soundOn ? "sound on" : "sound off"}
                </button>
              </>
            )}
            <Link
              href="/rabbit-hole"
              className="pointer-events-auto rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
            >
              exit
            </Link>
          </div>
        </div>

        {/* now-playing cue when a stall's audio is active */}
        {entered && soundOn && audioNowPlaying && (
          <div className="absolute inset-x-0 top-16 flex justify-center px-4">
            <p className="rounded-full border border-[#8fb3ff]/40 bg-[#0b1020]/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8fb3ff] backdrop-blur-sm">
              ♪ now playing · {audioNowPlaying}
            </p>
          </div>
        )}

        {/* step-inside prompt to talk to the store's AI host */}
        {entered && canTalk && !chatUnit && insideNumber && (
          <div className="absolute inset-x-0 bottom-24 flex justify-center px-4">
            <button
              type="button"
              onClick={() => openChat(insideNumber)}
              className="pointer-events-auto rounded-md border border-[#8fb3ff]/60 bg-[#0b1020]/88 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] backdrop-blur-sm transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
            >
              Talk to {insideStudio?.aiName || insideStudio?.studioName}
              <span className="ml-2 hidden text-[10px] text-ink-dim sm:inline">
                or press T
              </span>
            </button>
          </div>
        )}

        {/* AI host chat panel */}
        {chatUnit && (
          <div className="pointer-events-auto absolute bottom-14 right-4 z-30 flex w-[min(360px,86vw)] flex-col rounded-lg border border-white/14 bg-[#0b1020]/92 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8fb3ff]">
                  {chatHostName}
                </p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink-dim">
                  {aiSpeaking
                    ? "speaking…"
                    : aiBusy
                      ? "thinking…"
                      : "shop host"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeChat}
                className="text-ink-dim transition-colors hover:text-[#dbe5ff]"
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
            <div
              ref={aiScrollRef}
              className="flex max-h-56 flex-col gap-2 overflow-y-auto p-3"
            >
              {aiMessages.length === 0 && !aiBusy && (
                <p className="text-[11px] text-ink-dim">
                  Say hello to {chatHostName}.
                </p>
              )}
              {aiMessages.map((m, i) => (
                <p
                  key={i}
                  className={
                    m.role === "user"
                      ? "max-w-[85%] self-end rounded-lg bg-[#1a2740] px-3 py-1.5 text-xs leading-snug text-[#dbe5ff]"
                      : "max-w-[85%] self-start rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs leading-snug text-ink-soft"
                  }
                >
                  {m.content}
                </p>
              ))}
              {aiBusy && (
                <p className="self-start text-[11px] italic text-ink-dim">…</p>
              )}
              {aiError && (
                <p className="text-[11px] text-pill-red">{aiError}</p>
              )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendAiMessage();
              }}
              className="border-t border-white/10 p-2"
            >
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                maxLength={2000}
                placeholder={`Message ${chatHostName}…`}
                className="w-full bg-transparent px-1 text-xs text-[#dbe5ff] outline-none placeholder:text-ink-dim"
              />
            </form>
          </div>
        )}

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
                {nearName}
              </p>
              {nearProprietor && (
                <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-dim">
                  Run by {nearProprietor}
                </p>
              )}
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                {nearBlurb}
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
              {nearMine && (
                <Link
                  href="/studio"
                  className="pointer-events-auto mt-4 inline-block rounded-md border border-[#7dffa8]/60 bg-[#121826]/72 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#7dffa8] transition-colors hover:bg-[#7dffa8] hover:text-[#0b1020]"
                >
                  Manage your studio →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* arena entrance placard (the Superdome at the street's end) */}
        {nearArena && !near && (
          <div className="absolute inset-x-0 bottom-14 flex justify-center px-4">
            <div
              className="max-w-md rounded-lg border bg-[#0b1020]/88 p-5 text-center backdrop-blur-sm"
              style={{ borderColor: `${arena.accent}66` }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-[0.28em]"
                style={{ color: arena.accent }}
              >
                the superdome
              </p>
              <p className="mt-1.5 text-lg font-black tracking-tight text-[#dbe5ff]">
                {arena.entrance.name}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                {arena.entrance.blurb}
              </p>
              <Link
                href={ARENA_HREF}
                className="pointer-events-auto mt-4 inline-block rounded-md border bg-[#121826]/72 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:text-[#0b1020]"
                style={{ borderColor: `${arena.accent}99` }}
              >
                {arena.entrance.cta}
                <span className="ml-2 hidden text-[10px] text-ink-dim sm:inline">
                  or press E
                </span>
              </Link>
            </div>
          </div>
        )}

        {/* wall interaction prompt (under the crosshair) */}
        {focusPrompt && !viewer && !editor && (
          <div className="absolute inset-x-0 top-[57%] flex justify-center px-4">
            <p className="rounded-md border border-white/14 bg-[#0b1020]/85 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#dbe5ff] backdrop-blur-sm">
              {focusPrompt}
            </p>
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

      {/* Wall content viewer — one thing plays at a time */}
      {viewer && (
        <div className="pointer-events-auto absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/92 p-4">
          <button
            type="button"
            onClick={() => setViewer(null)}
            className="absolute right-4 top-4 rounded-md border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
          >
            close ✕
          </button>
          {viewer.title && (
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#dbe5ff]">
              {viewer.title}
            </p>
          )}
          {viewer.kind === "youtube" && viewerYouTube && (
            <iframe
              title={viewer.title || "video"}
              className="aspect-video w-full max-w-4xl rounded-lg border border-white/12"
              src={`https://www.youtube.com/embed/${viewerYouTube}?autoplay=1&rel=0`}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
          )}
          {viewer.kind === "website" && (
            <>
              <iframe
                title={viewer.title || "website"}
                className="h-[70vh] w-full max-w-5xl rounded-lg border border-white/12 bg-white"
                src={viewer.src}
              />
              <a
                href={viewer.src}
                target="_blank"
                rel="noreferrer"
                className="text-xs uppercase tracking-[0.2em] text-ink-dim transition-colors hover:text-[#dbe5ff]"
              >
                open in a new tab ↗
              </a>
            </>
          )}
          {viewer.kind === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={viewerImageSrc}
              alt={viewer.title || ""}
              className="max-h-[82vh] max-w-full rounded-lg border border-white/12 object-contain"
            />
          )}
        </div>
      )}

      {/* Owner wall editor — walk up to your own wall and set what hangs there */}
      {editor && (
        <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/14 bg-[#0b1020] p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#dbe5ff]">
                edit wall · unit {editor.unit}
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditor(null);
                  setWallError("");
                }}
                className="text-ink-dim transition-colors hover:text-[#dbe5ff]"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex gap-1.5">
              {(["empty", "image", "website", "youtube"] as WallKind[]).map(
                (k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setEditor((e) => (e ? { ...e, kind: k } : e))}
                    className={`rounded-md border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                      editor.kind === k
                        ? "border-[#8fb3ff] text-[#8fb3ff]"
                        : "border-white/18 text-ink-dim hover:text-ink-soft"
                    }`}
                  >
                    {k === "empty" ? "blank" : k}
                  </button>
                ),
              )}
            </div>

            {editor.kind !== "empty" && (
              <div className="mt-4 space-y-3">
                <input
                  value={editor.src}
                  onChange={(e) =>
                    setEditor((x) => (x ? { ...x, src: e.target.value } : x))
                  }
                  placeholder={
                    editor.kind === "image"
                      ? "https://image-url… (or upload)"
                      : editor.kind === "youtube"
                        ? "https://youtube.com/watch?v=…"
                        : "https://your-site.com"
                  }
                  className="w-full rounded-lg border border-white/18 bg-black/50 px-3 py-2 text-sm text-[#dbe5ff] outline-none focus:border-[#8fb3ff]"
                />
                <input
                  value={editor.title}
                  onChange={(e) =>
                    setEditor((x) => (x ? { ...x, title: e.target.value } : x))
                  }
                  placeholder="caption (optional)"
                  maxLength={80}
                  className="w-full rounded-lg border border-white/18 bg-black/50 px-3 py-2 text-sm text-[#dbe5ff] outline-none focus:border-[#8fb3ff]"
                />
                {editor.kind === "image" && (
                  <div>
                    <button
                      type="button"
                      onClick={() => editorFileRef.current?.click()}
                      disabled={wallBusy}
                      className="rounded-md border border-white/18 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-[#8fb3ff] hover:text-[#8fb3ff] disabled:opacity-50"
                    >
                      {wallBusy ? "uploading…" : "upload image"}
                    </button>
                    <input
                      ref={editorFileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadWallImage(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {wallError && (
              <p className="mt-3 text-sm text-pill-red">{wallError}</p>
            )}

            <div className="mt-5 flex items-center gap-4">
              <button
                type="button"
                onClick={saveWall}
                disabled={wallBusy}
                className="rounded-lg border border-[#8fb3ff]/60 bg-[#121826]/72 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020] disabled:opacity-50"
              >
                {wallBusy ? "saving…" : "save wall"}
              </button>
              <Link
                href="/studio"
                className="text-xs uppercase tracking-[0.18em] text-ink-dim transition-colors hover:text-[#dbe5ff]"
              >
                full back office →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
