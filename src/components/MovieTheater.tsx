"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import {
  CSS3DRenderer,
  CSS3DObject,
} from "three/examples/jsm/renderers/CSS3DRenderer.js";

// ============================================================================
// The Movie Theater — the third room in The Colossus.
//
// A single-screen cinema: a giant screen flanked by curtains at the front,
// stepped rows of seats climbing toward the back, a center aisle with strip
// lights, and a starfield ceiling. The big screen streams YouTube — paste a
// link or pick a saved bookmark, and a real YouTube player is mounted onto the
// screen in 3D (via CSS3DRenderer) so it plays right there in the room, house
// trim lights dimming while the film runs.
//
// Everything uses the site's unlit neon material language (MeshBasicMaterial)
// so it matches the Arena and the Concert Hall next door.
// ============================================================================

const ACCENT = "#f43f5e"; // marquee red
const RIM = "#22d3ee"; // cool trim
const EYE_HEIGHT = 1.7;
const MOVE_SPEED = 9;

// --- Room dimensions ---------------------------------------------------------
const HALF_W = 20; // room half-width (x)
const WALL_FRONT = -26; // screen wall (z)
const WALL_BACK = 26; // entrance wall (z)
const CEIL_Y = 17;

// Stepped seating: flat floor in front, then rows rising toward the back.
const ROWS = 10;
const ROW_DEPTH = 3.2;
const ROW_RISE = 0.55;
const ROWS_START_Z = -6; // first step begins here

const SCREEN_W = 30;
const SCREEN_H = 12.5;
const SCREEN_Y = 7.6; // screen center height

// The YouTube player is a real iframe mounted in 3D. It's authored at this
// pixel size (16:9) and scaled down into world units to fit the screen.
const PLAYER_PX_W = 1280;
const PLAYER_PX_H = 720;
const PLAYER_WORLD_H = 12.0; // a touch inside the screen frame
const PLAYER_SCALE = PLAYER_WORLD_H / PLAYER_PX_H;

type Bookmark = { id: string; url: string };

// Seed bookmarks — offered on first visit so there's always something to play.
const DEFAULT_BOOKMARKS: Bookmark[] = [
  { id: "velDW1330Zc", url: "https://www.youtube.com/watch?v=velDW1330Zc" },
  { id: "inVXK6gFX-U", url: "https://www.youtube.com/watch?v=inVXK6gFX-U" },
  { id: "tK1w3VYkPjw", url: "https://www.youtube.com/watch?v=tK1w3VYkPjw" },
];

const BOOKMARKS_KEY = "theater-bookmarks";

// Pull the 11-char video id out of any common YouTube link (or a bare id).
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
    const m = u.pathname.match(/\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  } catch {
    /* not a url */
  }
  return null;
}

const embedUrl = (id: string) =>
  `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&enablejsapi=1&playsinline=1&modestbranding=1`;
const thumbUrl = (id: string) =>
  `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

function floorHeightAt(z: number): number {
  if (z < ROWS_START_Z) return 0;
  const row = Math.min(ROWS - 1, Math.floor((z - ROWS_START_Z) / ROW_DEPTH));
  return (row + 1) * ROW_RISE;
}

function subscribeToPointerType(callback: () => void) {
  const query = window.matchMedia("(pointer: coarse)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function makeTextTexture(
  lines: { text: string; size: number; color: string }[],
  width = 1024,
  height = 512,
  background = "#04050c",
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const total = lines.reduce((s, l) => s + l.size * 1.7, 0);
  let y = height / 2 - total / 2;
  for (const line of lines) {
    y += (line.size * 1.7) / 2;
    ctx.fillStyle = line.color;
    ctx.font = `900 ${line.size}px system-ui, sans-serif`;
    ctx.fillText(line.text, width / 2, y, width * 0.92);
    y += (line.size * 1.7) / 2;
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type TheaterApi = {
  play: (id: string, title: string) => void;
  stop: () => void;
  togglePlay: () => void;
  isPlaying: () => boolean;
};

export default function MovieTheater() {
  const hostRef = useRef<HTMLDivElement>(null);
  const lockFnRef = useRef<(() => void) | null>(null);
  const apiRef = useRef<TheaterApi | null>(null);
  const enteredRef = useRef(false);
  const overlayOpenRef = useRef(true);

  const [entered, setEntered] = useState(false);
  const [locked, setLocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasFilm, setHasFilm] = useState(false);
  const [screenStatus, setScreenStatus] = useState(
    "No film loaded — open the screen menu.",
  );
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(DEFAULT_BOOKMARKS);
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState("");
  const isTouch = useSyncExternalStore(
    subscribeToPointerType,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );

  useEffect(() => {
    enteredRef.current = entered;
  }, [entered]);
  useEffect(() => {
    overlayOpenRef.current = !entered || menuOpen;
  }, [entered, menuOpen]);

  // Load saved bookmarks (localStorage is client-only, so this can't be an
  // initializer); fall back to the seed list on first visit.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Bookmark[];
        if (Array.isArray(parsed) && parsed.length) {
          /* eslint-disable-next-line react-hooks/set-state-in-effect */
          setBookmarks(parsed.filter((b) => b && typeof b.id === "string"));
        }
      }
    } catch {
      /* keep defaults */
    }
  }, []);

  const persistBookmarks = useCallback((next: Bookmark[]) => {
    setBookmarks(next);
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
    } catch {
      /* private mode — keep in memory */
    }
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // --- Scene / camera / renderer ----------------------------------------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03040a);
    scene.fog = new THREE.Fog(0x03040a, 60, 160);

    const camera = new THREE.PerspectiveCamera(
      66,
      window.innerWidth / window.innerHeight,
      0.1,
      400,
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    host.appendChild(renderer.domElement);

    // A second, transparent layer for the CSS3D YouTube player, mounted over
    // the WebGL canvas and driven by the same camera so the iframe tracks the
    // screen as you look around the room.
    const css3d = new CSS3DRenderer();
    css3d.setSize(window.innerWidth, window.innerHeight);
    css3d.domElement.style.position = "absolute";
    css3d.domElement.style.inset = "0";
    css3d.domElement.style.pointerEvents = "none"; // clicks fall through to canvas
    css3d.domElement.style.zIndex = "5"; // above canvas, below the HUD (z-10)
    host.appendChild(css3d.domElement);
    const css3dScene = new THREE.Scene();

    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(d: T): T => {
      disposables.push(d);
      return d;
    };

    const mat = (color: string | number, opts: THREE.MeshBasicMaterialParameters = {}) =>
      track(new THREE.MeshBasicMaterial({ color, ...opts }));

    // House trims that dim when the film plays.
    const houseMats: { m: THREE.MeshBasicMaterial; bright: THREE.Color }[] = [];
    const house = (color: string, opts: THREE.MeshBasicMaterialParameters = {}) => {
      const m = mat(color, opts);
      houseMats.push({ m, bright: new THREE.Color(color) });
      return m;
    };
    const dimColor = new THREE.Color();
    const setHouseLights = (dim: boolean) => {
      for (const { m, bright } of houseMats) {
        dimColor.copy(bright).multiplyScalar(dim ? 0.22 : 1);
        m.color.copy(dimColor);
      }
    };

    // --- The room ----------------------------------------------------------
    const roomDepth = WALL_BACK - WALL_FRONT;
    const roomCenterZ = (WALL_BACK + WALL_FRONT) / 2;

    const wallMat = mat("#0a0e1c", { side: THREE.BackSide });
    const room = new THREE.Mesh(
      track(new THREE.BoxGeometry(HALF_W * 2, CEIL_Y + ROWS * ROW_RISE + 6, roomDepth)),
      wallMat,
    );
    room.position.set(0, (CEIL_Y + ROWS * ROW_RISE + 6) / 2 - 1, roomCenterZ);
    scene.add(room);

    // Flat front floor
    const frontFloor = new THREE.Mesh(
      track(new THREE.BoxGeometry(HALF_W * 2, 0.2, ROWS_START_Z - WALL_FRONT)),
      mat("#0d1224"),
    );
    frontFloor.position.set(0, -0.1, (WALL_FRONT + ROWS_START_Z) / 2);
    scene.add(frontFloor);

    // Stepped rows + seats
    const stepGeo = track(new THREE.BoxGeometry(HALF_W * 2, 1, ROW_DEPTH));
    const stepMat = mat("#0d1224");
    const seatGeo = track(new THREE.BoxGeometry(0.92, 0.5, 0.85));
    const backGeo = track(new THREE.BoxGeometry(0.92, 0.75, 0.16));
    const seatMat = mat("#3b0d1c");
    const backMat = mat("#57122a");

    const seatXs: number[] = [];
    for (let x = 2.4; x <= HALF_W - 3.2; x += 1.18) seatXs.push(x, -x);
    const seatCount = ROWS * seatXs.length;
    const seats = new THREE.InstancedMesh(seatGeo, seatMat, seatCount);
    const backs = new THREE.InstancedMesh(backGeo, backMat, seatCount);
    const m4 = new THREE.Matrix4();
    let si = 0;
    for (let r = 0; r < ROWS; r++) {
      const rowZ = ROWS_START_Z + r * ROW_DEPTH;
      const stepY = (r + 1) * ROW_RISE;
      const step = new THREE.Mesh(stepGeo, stepMat);
      step.position.set(0, stepY - 0.5, rowZ + ROW_DEPTH / 2);
      scene.add(step);

      // rim light on each step edge
      const lip = new THREE.Mesh(
        track(new THREE.BoxGeometry(HALF_W * 2, 0.06, 0.08)),
        house(RIM),
      );
      lip.position.set(0, stepY + 0.03, rowZ + 0.04);
      scene.add(lip);

      for (const sx of seatXs) {
        m4.setPosition(sx, stepY + 0.25, rowZ + ROW_DEPTH / 2 + 0.35);
        seats.setMatrixAt(si, m4);
        m4.setPosition(sx, stepY + 0.85, rowZ + ROW_DEPTH / 2 + 0.72);
        backs.setMatrixAt(si, m4);
        si++;
      }
    }
    scene.add(seats, backs);

    // Center-aisle strip lights
    const stripGeo = track(new THREE.BoxGeometry(0.1, 0.05, roomDepth - 4));
    for (const sx of [-1.9, 1.9]) {
      const strip = new THREE.Mesh(stripGeo, house(ACCENT));
      strip.position.set(sx, floorHeightAt(roomCenterZ) * 0 + 0.03, roomCenterZ + 1);
      strip.rotation.x = -Math.atan2(ROWS * ROW_RISE, roomDepth - 4);
      strip.position.y = (ROWS * ROW_RISE) / 2 + 0.03;
      scene.add(strip);
    }

    // Wall sconces
    for (let i = 0; i < 6; i++) {
      const z = WALL_FRONT + 8 + i * 7.4;
      for (const sx of [-HALF_W + 0.3, HALF_W - 0.3]) {
        const sconce = new THREE.Mesh(
          track(new THREE.BoxGeometry(0.14, 1.6, 0.5)),
          house("#8b5cf6"),
        );
        sconce.position.set(sx, 4.6 + floorHeightAt(z) * 0.5, z);
        scene.add(sconce);
      }
    }

    // Starfield ceiling
    const starGeo = track(new THREE.BufferGeometry());
    const starPos = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      starPos[i * 3] = (Math.random() * 2 - 1) * (HALF_W - 1);
      starPos[i * 3 + 1] = CEIL_Y - 0.4 - Math.random() * 1.2;
      starPos[i * 3 + 2] = WALL_FRONT + 2 + Math.random() * (roomDepth - 4);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      track(new THREE.PointsMaterial({ color: "#dbe5ff", size: 0.09 })),
    );
    scene.add(stars);

    // --- The screen ----------------------------------------------------------
    const idleTexture = track(
      makeTextTexture([
        { text: "COLOSSUS CINEMA", size: 92, color: ACCENT },
        { text: "open the screen menu to pick a YouTube video", size: 36, color: "#8fa3c8" },
      ]),
    );
    const screenMat = track(
      new THREE.MeshBasicMaterial({ map: idleTexture, toneMapped: false }),
    );
    const screen = new THREE.Mesh(
      track(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H)),
      screenMat,
    );
    screen.position.set(0, SCREEN_Y, WALL_FRONT + 0.35);
    scene.add(screen);

    // screen frame + curtains
    const frame = new THREE.Mesh(
      track(new THREE.BoxGeometry(SCREEN_W + 1.2, SCREEN_H + 1.2, 0.2)),
      mat("#05070d"),
    );
    frame.position.set(0, SCREEN_Y, WALL_FRONT + 0.18);
    scene.add(frame);
    const curtainGeo = track(new THREE.BoxGeometry(3.2, SCREEN_H + 3.4, 0.5));
    for (const cx of [-(SCREEN_W / 2 + 2.4), SCREEN_W / 2 + 2.4]) {
      const curtain = new THREE.Mesh(curtainGeo, mat("#4c0519"));
      curtain.position.set(cx, SCREEN_Y + 0.6, WALL_FRONT + 0.45);
      scene.add(curtain);
    }

    // marquee above the screen
    const marquee = new THREE.Mesh(
      track(new THREE.PlaneGeometry(16, 2.2)),
      track(
        new THREE.MeshBasicMaterial({
          map: track(
            makeTextTexture(
              [{ text: "NOW SHOWING", size: 110, color: "#ffd166" }],
              1024,
              160,
              "#0a0206",
            ),
          ),
          toneMapped: false,
        }),
      ),
    );
    marquee.position.set(0, SCREEN_Y + SCREEN_H / 2 + 2.4, WALL_FRONT + 0.4);
    scene.add(marquee);

    // --- The YouTube player, mounted onto the screen in 3D -------------------
    const iframe = document.createElement("iframe");
    iframe.width = String(PLAYER_PX_W);
    iframe.height = String(PLAYER_PX_H);
    iframe.style.border = "0";
    iframe.style.background = "#000";
    iframe.style.pointerEvents = "auto"; // the player itself stays clickable
    iframe.allow =
      "autoplay; encrypted-media; picture-in-picture; fullscreen";
    iframe.setAttribute("allowfullscreen", "true");
    iframe.title = "Theater screen";

    const screenObject = new CSS3DObject(iframe);
    screenObject.position.set(0, SCREEN_Y, WALL_FRONT + 0.4);
    screenObject.scale.setScalar(PLAYER_SCALE); // px → world units
    // Front face points +z toward the audience by default; no rotation needed.

    let sceneDisposed = false;
    let playing = false;
    let currentTitle = "";
    const setStatus = (s: string) => {
      if (!sceneDisposed) setScreenStatus(s);
    };
    const post = (func: string) =>
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args: [] }),
        "*",
      );

    apiRef.current = {
      play: (id, title) => {
        iframe.src = embedUrl(id);
        if (!screenObject.parent) css3dScene.add(screenObject);
        screen.visible = false; // hide the idle plate behind the player
        setHouseLights(true);
        playing = true;
        currentTitle = title;
        if (!sceneDisposed) {
          setIsPlaying(true);
          setHasFilm(true);
        }
        setStatus(`Now showing · ${title}`);
      },
      stop: () => {
        iframe.src = "about:blank";
        if (screenObject.parent) css3dScene.remove(screenObject);
        screen.visible = true;
        setHouseLights(false);
        playing = false;
        if (!sceneDisposed) {
          setIsPlaying(false);
          setHasFilm(false);
        }
        setStatus("Screen cleared — pick a video.");
      },
      togglePlay: () => {
        if (!screenObject.parent) return;
        playing = !playing;
        post(playing ? "playVideo" : "pauseVideo");
        if (!sceneDisposed) setIsPlaying(playing);
        setStatus(playing ? `Now showing · ${currentTitle}` : `Intermission · ${currentTitle}`);
      },
      isPlaying: () => playing,
    };

    // --- Controls — pointer-lock + WASD, or dual-thumb touch ------------------
    const keys = new Set<string>();
    let yaw = 0; // yaw 0 faces -Z: straight at the screen
    let pitch = -0.06;
    const pos = new THREE.Vector3(0, 0, WALL_BACK - 4.5);
    pos.y = floorHeightAt(pos.z) + EYE_HEIGHT;

    const isTyping = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA");
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e) || overlayOpenRef.current) return;
      keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      yaw -= e.movementX * 0.0023;
      pitch -= e.movementY * 0.0023;
      pitch = Math.max(-1.35, Math.min(1.35, pitch));
    };
    const requestLock = () => {
      if (!enteredRef.current) return;
      renderer.domElement.requestPointerLock();
    };
    lockFnRef.current = requestLock;
    const onLockChange = () => {
      setLocked(document.pointerLockElement === renderer.domElement);
    };
    const onCanvasClick = () => {
      if (enteredRef.current && !overlayOpenRef.current) requestLock();
    };

    // touch: left half = move stick, right half = look
    let moveTouch: { id: number; x: number; y: number } | null = null;
    let lookTouch: { id: number; x: number; y: number } | null = null;
    const moveVec = { x: 0, y: 0 };
    const onTouchStart = (e: TouchEvent) => {
      if (overlayOpenRef.current) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX < window.innerWidth / 2 && !moveTouch) {
          moveTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
        } else if (!lookTouch) {
          lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
        }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (moveTouch && t.identifier === moveTouch.id) {
          moveVec.x = Math.max(-1, Math.min(1, (t.clientX - moveTouch.x) / 60));
          moveVec.y = Math.max(-1, Math.min(1, (t.clientY - moveTouch.y) / 60));
        } else if (lookTouch && t.identifier === lookTouch.id) {
          yaw -= (t.clientX - lookTouch.x) * 0.005;
          pitch = Math.max(
            -1.35,
            Math.min(1.35, pitch - (t.clientY - lookTouch.y) * 0.005),
          );
          lookTouch.x = t.clientX;
          lookTouch.y = t.clientY;
        }
      }
      if (enteredRef.current && !overlayOpenRef.current) e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (moveTouch && t.identifier === moveTouch.id) {
          moveTouch = null;
          moveVec.x = 0;
          moveVec.y = 0;
        }
        if (lookTouch && t.identifier === lookTouch.id) lookTouch = null;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onLockChange);
    renderer.domElement.addEventListener("click", onCanvasClick);
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: true });
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });
    renderer.domElement.addEventListener("touchend", onTouchEnd);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      css3d.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    // --- Loop ----------------------------------------------------------------
    const clock = new THREE.Clock();
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const delta = Math.min(clock.getDelta(), 0.05);

      let mx = 0;
      let mz = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) mz -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) mz += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) mx -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) mx += 1;
      mx += moveVec.x;
      mz += moveVec.y;

      if (mx !== 0 || mz !== 0) {
        fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        right.set(fwd.z, 0, -fwd.x);
        pos.addScaledVector(fwd, -mz * MOVE_SPEED * delta);
        pos.addScaledVector(right, -mx * MOVE_SPEED * delta);
        pos.x = Math.max(-HALF_W + 1.2, Math.min(HALF_W - 1.2, pos.x));
        pos.z = Math.max(WALL_FRONT + 4.5, Math.min(WALL_BACK - 1.4, pos.z));
      }

      // ride the steps smoothly
      const targetY = floorHeightAt(pos.z) + EYE_HEIGHT;
      pos.y += (targetY - pos.y) * Math.min(1, delta * 12);

      camera.position.copy(pos);
      camera.rotation.set(0, 0, 0);
      camera.rotateY(yaw);
      camera.rotateX(pitch);

      renderer.render(scene, camera);
      css3d.render(css3dScene, camera); // keep the player glued to the screen
    };
    loop();

    return () => {
      sceneDisposed = true;
      cancelAnimationFrame(raf);
      apiRef.current = null;
      iframe.src = "about:blank";
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onLockChange);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchmove", onTouchMove);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("resize", onResize);
      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      }
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      css3d.domElement.remove();
    };
  }, []);

  const enter = useCallback(() => {
    enteredRef.current = true;
    setEntered(true);
    // Open the picker straight away so there's always something to start with.
    setMenuOpen(true);
  }, []);

  const playId = useCallback((id: string, title: string) => {
    apiRef.current?.play(id, title);
    setMenuOpen(false);
  }, []);

  const submitLink = useCallback(
    (alsoSave: boolean) => {
      const id = parseYouTubeId(linkInput);
      if (!id) {
        setLinkError("That doesn't look like a YouTube link.");
        return;
      }
      setLinkError("");
      if (alsoSave && !bookmarks.some((b) => b.id === id)) {
        persistBookmarks([{ id, url: linkInput.trim() }, ...bookmarks]);
      }
      if (!alsoSave) {
        playId(id, id);
        setLinkInput("");
      }
    },
    [linkInput, bookmarks, persistBookmarks, playId],
  );

  const removeBookmark = useCallback(
    (id: string) => persistBookmarks(bookmarks.filter((b) => b.id !== id)),
    [bookmarks, persistBookmarks],
  );

  const showOverlay = !entered;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div ref={hostRef} className="stage-fixed" />

      {/* screen menu */}
      {menuOpen && (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border bg-[#0b1020]/95 p-5 shadow-2xl"
            style={{ borderColor: `${ACCENT}88` }}
            role="dialog"
            aria-label="Screen menu"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p
                  className="text-xs font-bold uppercase tracking-[0.24em]"
                  style={{ color: ACCENT }}
                >
                  Screen menu
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  Stream a YouTube video on the big screen.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded border border-white/20 px-3 py-1 text-xs uppercase tracking-wider text-ink-soft hover:bg-white/10"
              >
                close
              </button>
            </div>

            <section className="mb-5 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-dim">
                Paste a YouTube link
              </p>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitLink(false);
                }}
              >
                <input
                  value={linkInput}
                  onChange={(e) => {
                    setLinkInput(e.target.value);
                    if (linkError) setLinkError("");
                  }}
                  type="text"
                  inputMode="url"
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-[#dbe5ff] outline-none focus:border-[#f43f5e]"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-md border px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
                  style={{ borderColor: `${ACCENT}99` }}
                >
                  play
                </button>
                <button
                  type="button"
                  onClick={() => submitLink(true)}
                  className="shrink-0 rounded-md border border-white/25 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft transition-colors hover:bg-white/10"
                >
                  save
                </button>
              </form>
              {linkError && (
                <p className="text-[11px] text-[#f43f5e]">{linkError}</p>
              )}
            </section>

            <section className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-dim">
                Bookmarks
              </p>
              {bookmarks.length === 0 ? (
                <p className="text-[11px] text-ink-dim">
                  No bookmarks yet — save a link above to keep it here.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {bookmarks.map((b) => (
                    <div key={b.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => playId(b.id, b.id)}
                        className="relative block aspect-video w-full overflow-hidden rounded-md border border-white/15 bg-[#05070d] transition-colors hover:border-[#f43f5e]"
                      >
                        {/* play glyph shows through if the thumbnail can't load */}
                        <span
                          className="absolute inset-0 flex items-center justify-center text-2xl"
                          style={{ color: ACCENT }}
                        >
                          ▶
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbUrl(b.id)}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBookmark(b.id)}
                        aria-label="Remove bookmark"
                        className="absolute right-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] leading-none text-ink-soft opacity-0 transition-opacity hover:text-[#f43f5e] group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="mt-4 text-center text-[10px] uppercase tracking-[0.18em] text-ink-dim">
              {screenStatus}
            </p>
          </div>
        </div>
      )}

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#dbe5ff]/80" />

        <div className="absolute inset-x-0 top-0 flex flex-wrap items-center justify-between gap-2 p-4">
          <p
            className="text-xs font-bold uppercase tracking-[0.24em]"
            style={{ color: ACCENT }}
          >
            The Colossus · Movie Theater
          </p>
          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            {entered && (
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
                style={{ borderColor: `${ACCENT}66` }}
              >
                screen menu
              </button>
            )}
            {entered && hasFilm && (
              <button
                type="button"
                onClick={() => apiRef.current?.togglePlay()}
                className="rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
                style={{ borderColor: `${ACCENT}66` }}
              >
                {isPlaying ? "pause film" : "play film"}
              </button>
            )}
            {entered && (
              <Link
                href="/rabbit-hole/venue"
                className="rounded-md border border-white/18 bg-white/[0.055] px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
              >
                leave the theater
              </Link>
            )}
          </div>
        </div>

        {entered && (
          <p className="absolute inset-x-0 top-[4.5rem] px-4 text-center text-[11px] uppercase tracking-[0.2em] text-ink-soft sm:top-20">
            {screenStatus}
          </p>
        )}

        <p className="absolute inset-x-0 bottom-4 px-4 text-center text-[11px] uppercase tracking-[0.25em] text-ink-dim">
          {isTouch
            ? "left thumb: walk — right thumb: look — leave the theater up top"
            : locked
              ? "wasd / arrows: move — mouse: look — esc: free the cursor for the screen & buttons"
              : "cursor released — click the scene to look around, or use the screen & buttons"}
        </p>
      </div>

      {/* enter overlay */}
      {showOverlay && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-black/80 px-6 py-10 text-center">
          <p
            className="text-2xl font-black uppercase tracking-[0.24em]"
            style={{ color: ACCENT }}
          >
            The Movie Theater
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            A single-screen cinema inside The Colossus: stepped rows under a
            starfield ceiling, curtains framing a giant screen. Take any seat —
            then stream a YouTube video on the big screen. Paste a link or pick
            a saved bookmark; house lights dim when it rolls.
          </p>
          <button
            type="button"
            onClick={enter}
            className="w-full max-w-xs rounded-md border bg-[#121826]/72 px-6 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#dbe5ff] transition-colors hover:bg-[#dbe5ff] hover:text-[#0b1020]"
            style={{ borderColor: `${ACCENT}99` }}
          >
            enter the theater
          </button>
          <Link
            href="/rabbit-hole/venue"
            className="text-xs uppercase tracking-[0.22em] text-ink-dim underline-offset-4 transition-colors hover:text-[#dbe5ff] hover:underline"
          >
            back to The Colossus doors
          </Link>
        </div>
      )}
    </div>
  );
}
