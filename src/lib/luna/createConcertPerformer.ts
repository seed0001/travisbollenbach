import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTFParser } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRMHumanBoneName, VRMLoaderPlugin } from "@pixiv/three-vrm";
import { VRMAnimationLoaderPlugin } from "@pixiv/three-vrm-animation";
import {
  DEFAULT_AVATAR_NAME,
  DEFAULT_VRM_URL,
  VRMAvatarController,
  type AvatarSource,
} from "./avatar/VRMAvatarController";
import { ALL_DANCE_URLS, IDLE_ANIMATION_URL } from "./animation/danceAnimations";
import type { MotionCatalog } from "./avatar/avatarMotionCatalog";
import { analyzeMusicGenre } from "./audio/genreAnalysis";
import type { StemPerformance } from "./audio/StemPerformance";
import {
  LUNA_BASE_HEIGHT,
  LUNA_SCALE_DEFAULT,
  type ConcertAudioSource,
  type ConcertTrack,
} from "./concertConfig";

/** Full VRMA dance cycle for the concert stage (not procedural sway-only mode). */
const CONCERT_MOTION_CATALOG: MotionCatalog = {
  idleUrl: IDLE_ANIMATION_URL,
  playlistUrls: ALL_DANCE_URLS,
  label: "concert VRMA dances",
  proceduralPerformance: false,
};

const LUNA_LAYER = 1;
const TARGET_HEIGHT = LUNA_BASE_HEIGHT;
const STAGE_FLOOR_Y = 0.02;
/** VRM model forward offset baked into the anchor child (see normalizeVrmInAnchor). */
const LUNA_MODEL_YAW = Math.PI / 2;
/** Half-gap between duet singers, metres at 1× scale (clamped in world units). */
const DUET_SPACING = 1.6;
const DUET_SPACING_MAX = 14;

export type ConcertPerformer = {
  update: (delta: number) => void;
  dispose: () => void;
  play: () => Promise<void>;
  pause: () => void;
  togglePlayPause: () => Promise<void>;
  loadTrack: (track: ConcertTrack, autoplay?: boolean) => Promise<void>;
  loadAvatar: (source: AvatarSource) => Promise<void>;
  getAvatarName: () => string;
  setScale: (multiplier: number) => void;
  getScale: () => number;
  setDuetPartner: (partner: { url: string; name: string } | null) => Promise<void>;
  getDuetPartnerName: () => string | null;
  /** Tap on the music stem for stage visuals — lasers, crowd lights. */
  getMusicAnalyser: () => AnalyserNode;
  setAudienceTarget: (position: THREE.Vector3 | null) => void;
  getHeadWorldPosition: (target: THREE.Vector3) => boolean;
  isPlaying: () => boolean;
  getTrackId: () => string;
  getStatus: () => string;
};

async function fetchBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${url} (${res.status})`);
  }
  return res.blob();
}

async function resolveMusicBlob(
  source: ConcertAudioSource,
): Promise<Blob | null> {
  if (typeof source === "string") {
    try {
      return await fetchBlob(source);
    } catch {
      return null;
    }
  }
  return source;
}

async function loadTrackStems(
  controller: VRMAvatarController,
  stemPerformance: StemPerformance,
  track: ConcertTrack,
  setStatus: (next: string) => void,
): Promise<void> {
  setStatus(`Loading ${track.title}…`);
  await stemPerformance.loadStems({
    music: track.music,
    vocals: track.vocals,
  });

  try {
    const musicBlob = await resolveMusicBlob(track.music);
    if (musicBlob) {
      const genre = await analyzeMusicGenre(musicBlob);
      controller.animationDirector?.setPlaylist(genre.danceUrls);
      setStatus(`Ready · ${track.title} · ${genre.label}`);
      return;
    }
  } catch {
    // fall through
  }
  setStatus(`Ready · ${track.title}`);
}

/** Normalize VRM height inside the anchor; feet sit at the anchor origin. */
function normalizeVrmInAnchor(vrmRoot: THREE.Object3D): void {
  vrmRoot.scale.set(1, 1, 1);
  vrmRoot.position.set(0, 0, 0);
  vrmRoot.rotation.set(0, LUNA_MODEL_YAW, 0);
  vrmRoot.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(vrmRoot);
  const size = box.getSize(new THREE.Vector3());
  const normalize = TARGET_HEIGHT / (size.y > 1e-3 ? size.y : TARGET_HEIGHT);
  vrmRoot.scale.setScalar(normalize);
  vrmRoot.updateMatrixWorld(true);

  const minY = new THREE.Box3().setFromObject(vrmRoot).min.y;
  vrmRoot.position.set(0, -minY, 0);
  vrmRoot.traverse((obj) => {
    obj.layers.enable(LUNA_LAYER);
  });
}

function lerpAngle(current: number, target: number, t: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * t;
}

function applyAnchorScale(
  stageAnchor: THREE.Group,
  userScale: number,
  offsetX = 0,
): void {
  stageAnchor.scale.setScalar(userScale);
  stageAnchor.position.set(offsetX, STAGE_FLOOR_Y, 0);
}

export async function createConcertPerformer(
  scene: THREE.Scene,
  track: ConcertTrack,
  onStatus?: (status: string) => void,
  getUserScale?: () => number,
): Promise<ConcertPerformer> {
  const loader = new GLTFLoader();
  loader.register((parser: GLTFParser) => new VRMLoaderPlugin(parser));
  loader.register((parser: GLTFParser) => new VRMAnimationLoaderPlugin(parser));

  const stageAnchor = new THREE.Group();
  stageAnchor.name = "LunaStageAnchor";
  scene.add(stageAnchor);

  const anchorWorld = new THREE.Vector3();
  const AUDIENCE_TURN_SPEED = 10;
  let audienceTarget: THREE.Vector3 | null = null;
  let vrmRoot: THREE.Object3D | null = null;

  // Optional second singer for duet mode — shares the lead's stem mixer so
  // both lip-sync the same vocals.
  let duetController: VRMAvatarController | null = null;
  let duetAnchor: THREE.Group | null = null;
  let duetRoot: THREE.Object3D | null = null;
  let duetSwapping = false;
  const anchorSnapped = [false, false];

  const controller = new VRMAvatarController(scene, loader);
  let status = "Loading Luna…";
  let currentTrack = track;
  let userScale = getUserScale?.() ?? LUNA_SCALE_DEFAULT;
  let appliedScale = -1;
  let avatarSwapping = false;

  const setStatus = (next: string) => {
    status = next;
    onStatus?.(next);
  };

  const syncScale = () => {
    const next = getUserScale?.() ?? userScale;
    userScale = next;
    if (Math.abs(next - appliedScale) < 1e-4) return;
    appliedScale = next;
    const spacing = duetController
      ? Math.min(DUET_SPACING * userScale, DUET_SPACING_MAX)
      : 0;
    applyAnchorScale(stageAnchor, userScale, -spacing);
    if (duetAnchor) applyAnchorScale(duetAnchor, userScale, spacing);
  };

  const faceAnchor = (anchor: THREE.Group, delta: number, idx: number) => {
    if (!audienceTarget) return;

    anchor.updateMatrixWorld(true);
    anchor.getWorldPosition(anchorWorld);

    const dx = audienceTarget.x - anchorWorld.x;
    const dz = audienceTarget.z - anchorWorld.z;
    if (dx * dx + dz * dz < 0.25) return;

    const targetY = Math.atan2(dx, dz) - LUNA_MODEL_YAW + Math.PI;
    if (!anchorSnapped[idx]) {
      anchor.rotation.y = targetY;
      anchorSnapped[idx] = true;
      return;
    }

    const t = 1 - Math.exp(-AUDIENCE_TURN_SPEED * delta);
    anchor.rotation.y = lerpAngle(anchor.rotation.y, targetY, t);
  };

  const syncAudienceFacing = (delta: number) => {
    faceAnchor(stageAnchor, delta, 0);
    if (duetAnchor) faceAnchor(duetAnchor, delta, 1);
  };

  const pinModelOrientation = () => {
    if (vrmRoot) vrmRoot.rotation.set(0, LUNA_MODEL_YAW, 0);
    if (duetRoot) duetRoot.rotation.set(0, LUNA_MODEL_YAW, 0);
  };

  let stemPerformance!: StemPerformance;

  // Re-parent the controller's freshly loaded VRM into the stage anchor and
  // re-grab the per-avatar performance drivers. Runs on first load and again
  // after every avatar swap.
  const adoptLoadedAvatar = () => {
    vrmRoot = controller.vrm?.scene ?? null;
    if (vrmRoot) {
      // Parent to our anchor so slider scale does not fight VRM animation updates.
      if (vrmRoot.parent) {
        vrmRoot.parent.remove(vrmRoot);
      }
      stageAnchor.add(vrmRoot);
      normalizeVrmInAnchor(vrmRoot);
      appliedScale = -1;
      syncScale();
    }

    const performance = controller.stemPerformance;
    if (!performance) {
      throw new Error(`${controller.displayName} stem performance not ready.`);
    }
    stemPerformance = performance;
  };

  await controller.loadDefault();
  await controller.applyMotionCatalog(CONCERT_MOTION_CATALOG);
  adoptLoadedAvatar();

  const resetDrivers = (c: VRMAvatarController) => {
    c.animationDirector?.startIdle();
    c.lipsync?.reset();
    c.emotion?.reset();
    c.phonetics?.reset();
    c.singingPerformance?.reset();
  };

  // One master end-of-song handler on the shared mixer. Constructing the duet
  // controller against the same mixer would otherwise steal it (last wins), so
  // it is re-asserted after every duet construction.
  const onMixerEnded = () => {
    resetDrivers(controller);
    if (duetController) resetDrivers(duetController);
    setStatus(`Finished · ${currentTrack.title}`);
  };
  controller.mixer.onEnded = onMixerEnded;

  const reconnectDuetDrivers = () => {
    if (!duetController) return;
    duetController.lipsync?.connectVocalsStem(controller.mixer);
    duetController.emotion?.connectVocalsStem(controller.mixer);
  };

  await loadTrackStems(controller, stemPerformance, track, setStatus);

  const startPlayback = async () => {
    await stemPerformance.play();
    controller.animationDirector?.startDance();
    if (duetController) {
      reconnectDuetDrivers();
      duetController.animationDirector?.startDance();
    }
    setStatus(`Playing · ${currentTrack.title}`);
  };

  return {
    update: (delta) => {
      syncScale();
      controller.update(delta);
      duetController?.update(delta);
      pinModelOrientation();
      syncAudienceFacing(delta);
    },
    dispose: () => {
      stemPerformance.dispose();
      controller.unloadAvatar();
      duetController?.unloadAvatar();
      if (duetAnchor) scene.remove(duetAnchor);
      scene.remove(stageAnchor);
    },
    play: startPlayback,
    pause: () => {
      stemPerformance.pause();
      controller.animationDirector?.startIdle();
      if (duetController) resetDrivers(duetController);
      setStatus(`Paused · ${currentTrack.title}`);
    },
    togglePlayPause: async () => {
      if (stemPerformance.mixer.mixerState === "playing") {
        stemPerformance.pause();
        controller.animationDirector?.startIdle();
        if (duetController) resetDrivers(duetController);
        setStatus(`Paused · ${currentTrack.title}`);
      } else {
        await startPlayback();
      }
    },
    loadAvatar: async (source) => {
      if (avatarSwapping) return;
      avatarSwapping = true;

      // The mixer survives avatar swaps, so the song keeps playing while the
      // new model loads and its lip sync / dance rigs reconnect.
      const wasPlaying = stemPerformance.mixer.mixerState === "playing";
      const incomingName =
        source.kind === "file"
          ? source.file.name.replace(/\.vrm$/i, "")
          : source.name;
      setStatus(`Loading performer · ${incomingName}…`);

      const wireUp = async () => {
        await controller.applyMotionCatalog(CONCERT_MOTION_CATALOG);
        adoptLoadedAvatar();
        if (wasPlaying) {
          controller.animationDirector?.startDance();
        }
      };

      try {
        await controller.load(source);
        await wireUp();
        setStatus(
          wasPlaying
            ? `Playing · ${currentTrack.title}`
            : `${controller.displayName} ready · ${currentTrack.title}`,
        );
      } catch (err) {
        // The old avatar is already unloaded by controller.load — bring the
        // default performer back so the stage is never left empty.
        await controller.load({
          kind: "url",
          url: DEFAULT_VRM_URL,
          name: DEFAULT_AVATAR_NAME,
        });
        await wireUp();
        setStatus(
          `Avatar failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      } finally {
        avatarSwapping = false;
      }
    },
    getAvatarName: () => controller.displayName,
    loadTrack: async (nextTrack, autoplay = false) => {
      const wasPlaying = stemPerformance.mixer.mixerState === "playing";
      stemPerformance.pause();
      controller.animationDirector?.startIdle();
      if (duetController) resetDrivers(duetController);

      currentTrack = nextTrack;
      await loadTrackStems(controller, stemPerformance, nextTrack, setStatus);
      reconnectDuetDrivers();

      if (autoplay || wasPlaying) {
        await startPlayback();
      }
    },
    setScale: (multiplier) => {
      userScale = multiplier;
      appliedScale = -1;
      syncScale();
    },
    setAudienceTarget: (position) => {
      if (!position) {
        anchorSnapped[0] = false;
        anchorSnapped[1] = false;
      }
      audienceTarget = position;
    },
    setDuetPartner: async (partner) => {
      if (duetSwapping) return;
      duetSwapping = true;
      try {
        if (!partner) {
          if (duetController) {
            duetController.unloadAvatar();
            duetController = null;
            duetRoot = null;
            if (duetAnchor) {
              scene.remove(duetAnchor);
              duetAnchor = null;
            }
            anchorSnapped[1] = false;
            appliedScale = -1;
            syncScale();
          }
          return;
        }
        if (duetController?.displayName === partner.name) return;

        setStatus(`Loading duet partner · ${partner.name}…`);
        const wasPlaying = stemPerformance.mixer.mixerState === "playing";

        if (!duetAnchor) {
          duetAnchor = new THREE.Group();
          duetAnchor.name = "DuetStageAnchor";
          scene.add(duetAnchor);
        }
        if (!duetController) {
          duetController = new VRMAvatarController(
            scene,
            loader,
            controller.mixer,
          );
          controller.mixer.onEnded = onMixerEnded;
        }
        await duetController.load({
          kind: "url",
          url: partner.url,
          name: partner.name,
        });
        await duetController.applyMotionCatalog(CONCERT_MOTION_CATALOG);

        duetRoot = duetController.vrm?.scene ?? null;
        if (duetRoot) {
          duetRoot.parent?.remove(duetRoot);
          duetAnchor.add(duetRoot);
          normalizeVrmInAnchor(duetRoot);
        }
        anchorSnapped[1] = false;
        appliedScale = -1;
        syncScale();
        reconnectDuetDrivers();
        if (wasPlaying) {
          duetController.animationDirector?.startDance();
          setStatus(`Playing · ${currentTrack.title}`);
        } else {
          duetController.animationDirector?.startIdle();
          setStatus(
            `${controller.displayName} + ${partner.name} ready · ${currentTrack.title}`,
          );
        }
      } catch (err) {
        duetController?.unloadAvatar();
        duetController = null;
        duetRoot = null;
        if (duetAnchor) {
          scene.remove(duetAnchor);
          duetAnchor = null;
        }
        appliedScale = -1;
        syncScale();
        setStatus(
          `Duet failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw err;
      } finally {
        duetSwapping = false;
      }
    },
    getDuetPartnerName: () => duetController?.displayName ?? null,
    getMusicAnalyser: () => controller.mixer.musicAnalyser,
    getScale: () => userScale,
    getHeadWorldPosition: (target) => {
      const head =
        controller.vrm?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Head) ??
        null;
      if (!head) return false;
      head.getWorldPosition(target);
      return true;
    },
    isPlaying: () => stemPerformance.mixer.mixerState === "playing",
    getTrackId: () => currentTrack.id,
    getStatus: () => status,
  };
}

export { LUNA_LAYER };
