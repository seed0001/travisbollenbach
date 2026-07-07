import * as THREE from "three";

// ---------------------------------------------------------------------------
// Proximity voice. A full mesh of WebRTC peer connections — every player
// connects directly to every other player in the lobby, audio never touches
// our server. The lobby WebSocket only carries the signaling (offers,
// answers, ICE candidates).
//
// Spatialization: each remote voice runs through a WebAudio PannerNode
// positioned at that player's avatar, and the listener follows the camera —
// so voices sit in the world, get quieter with distance, and pan as you
// turn your head.
//
// Pairing rule: the newcomer initiates. When you join you receive the peer
// list and offer to everyone on it; players already present simply wait for
// your offer. Exactly one side dials, no glare.
// ---------------------------------------------------------------------------

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

type SignalData =
  | { sdp: RTCSessionDescriptionInit }
  | { candidate: RTCIceCandidateInit | null };

type VoicePeer = {
  pc: RTCPeerConnection;
  panner: PannerNode | null;
  gain: GainNode | null;
  analyser: AnalyserNode | null;
  levelBuffer: Uint8Array<ArrayBuffer> | null;
  /** hidden element: Chrome only pumps WebRTC audio that is attached to one */
  sink: HTMLAudioElement | null;
  pendingCandidates: RTCIceCandidateInit[];
  hasRemoteDescription: boolean;
};

export type VoiceMesh = {
  /** dial a peer (call for every peer in the welcome list) */
  callPeer(id: string): void;
  /** incoming signaling from the lobby socket */
  handleSignal(from: string, data: unknown): void;
  removePeer(id: string): void;
  /** move a remote voice to its avatar's position */
  setPeerPosition(id: string, position: THREE.Vector3): void;
  /** how loud a peer is right now, 0..1 — drives the speaking glow */
  peerLevel(id: string): number;
  /** point the audio listener where the camera looks */
  updateListener(camera: THREE.Camera): void;
  setMicEnabled(on: boolean): void;
  micAvailable(): boolean;
  /** resume the AudioContext after a user gesture */
  resume(): void;
  dispose(): void;
};

export async function requestMicrophone(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch {
    return null; // no mic permission — enter listen-only
  }
}

export function createVoiceMesh(
  localStream: MediaStream | null,
  sendSignal: (to: string, data: SignalData) => void,
): VoiceMesh {
  const ctx: AudioContext | null =
    typeof AudioContext !== "undefined" ? new AudioContext() : null;
  const peers = new Map<string, VoicePeer>();
  const listenerPos = new THREE.Vector3();
  const listenerFwd = new THREE.Vector3();

  const attachRemoteStream = (peer: VoicePeer, stream: MediaStream) => {
    // keep-alive sink, muted — actual playback goes through WebAudio
    const sink = document.createElement("audio");
    sink.srcObject = stream;
    sink.muted = true;
    sink.autoplay = true;
    peer.sink = sink;

    if (!ctx) return;
    const source = ctx.createMediaStreamSource(stream);
    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 3; // full volume within arm's reach
    panner.maxDistance = 60;
    panner.rolloffFactor = 1.6;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    source.connect(panner);
    panner.connect(gain);
    gain.connect(ctx.destination);
    source.connect(analyser); // level meter taps the dry signal

    peer.panner = panner;
    peer.gain = gain;
    peer.analyser = analyser;
    peer.levelBuffer = new Uint8Array(analyser.frequencyBinCount);
  };

  const createPeer = (id: string): VoicePeer => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peer: VoicePeer = {
      pc,
      panner: null,
      gain: null,
      analyser: null,
      levelBuffer: null,
      sink: null,
      pendingCandidates: [],
      hasRemoteDescription: false,
    };

    if (localStream) {
      for (const track of localStream.getAudioTracks()) {
        pc.addTrack(track, localStream);
      }
    }

    pc.onicecandidate = (event) => {
      sendSignal(id, { candidate: event.candidate?.toJSON() ?? null });
    };
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      attachRemoteStream(peer, stream);
    };

    peers.set(id, peer);
    return peer;
  };

  const callPeer = (id: string) => {
    if (peers.has(id)) return;
    const peer = createPeer(id);
    if (!localStream) {
      // still dial to hear them, just with nothing to send
      peer.pc.addTransceiver("audio", { direction: "recvonly" });
    }
    peer.pc
      .createOffer()
      .then(async (offer) => {
        await peer.pc.setLocalDescription(offer);
        sendSignal(id, { sdp: offer });
      })
      .catch(() => {});
  };

  const handleSignal = (from: string, data: unknown) => {
    const signal = data as SignalData;
    const peer = peers.get(from) ?? createPeer(from);

    if ("sdp" in signal && signal.sdp) {
      const description = signal.sdp;
      peer.pc
        .setRemoteDescription(description)
        .then(async () => {
          peer.hasRemoteDescription = true;
          for (const candidate of peer.pendingCandidates) {
            await peer.pc.addIceCandidate(candidate).catch(() => {});
          }
          peer.pendingCandidates = [];
          if (description.type === "offer") {
            const answer = await peer.pc.createAnswer();
            await peer.pc.setLocalDescription(answer);
            sendSignal(from, { sdp: answer });
          }
        })
        .catch(() => {});
    } else if ("candidate" in signal) {
      if (!signal.candidate) return;
      if (peer.hasRemoteDescription) {
        peer.pc.addIceCandidate(signal.candidate).catch(() => {});
      } else {
        peer.pendingCandidates.push(signal.candidate);
      }
    }
  };

  const removePeer = (id: string) => {
    const peer = peers.get(id);
    if (!peer) return;
    peer.pc.close();
    if (peer.sink) {
      peer.sink.srcObject = null;
      peer.sink.remove();
    }
    peers.delete(id);
  };

  const setPeerPosition = (id: string, position: THREE.Vector3) => {
    const panner = peers.get(id)?.panner;
    if (!panner || !ctx) return;
    if (panner.positionX) {
      panner.positionX.setTargetAtTime(position.x, ctx.currentTime, 0.05);
      panner.positionY.setTargetAtTime(position.y, ctx.currentTime, 0.05);
      panner.positionZ.setTargetAtTime(position.z, ctx.currentTime, 0.05);
    } else {
      panner.setPosition(position.x, position.y, position.z);
    }
  };

  const peerLevel = (id: string) => {
    const peer = peers.get(id);
    if (!peer?.analyser || !peer.levelBuffer) return 0;
    peer.analyser.getByteTimeDomainData(peer.levelBuffer);
    let sum = 0;
    for (let i = 0; i < peer.levelBuffer.length; i += 1) {
      const v = (peer.levelBuffer[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / peer.levelBuffer.length) * 4);
  };

  const updateListener = (camera: THREE.Camera) => {
    if (!ctx) return;
    const { listener } = ctx;
    camera.getWorldPosition(listenerPos);
    camera.getWorldDirection(listenerFwd);
    if (listener.positionX) {
      const t = ctx.currentTime;
      listener.positionX.setTargetAtTime(listenerPos.x, t, 0.05);
      listener.positionY.setTargetAtTime(listenerPos.y, t, 0.05);
      listener.positionZ.setTargetAtTime(listenerPos.z, t, 0.05);
      listener.forwardX.setTargetAtTime(listenerFwd.x, t, 0.05);
      listener.forwardY.setTargetAtTime(listenerFwd.y, t, 0.05);
      listener.forwardZ.setTargetAtTime(listenerFwd.z, t, 0.05);
      listener.upX.setTargetAtTime(0, t, 0.05);
      listener.upY.setTargetAtTime(1, t, 0.05);
      listener.upZ.setTargetAtTime(0, t, 0.05);
    } else {
      listener.setPosition(listenerPos.x, listenerPos.y, listenerPos.z);
      listener.setOrientation(listenerFwd.x, listenerFwd.y, listenerFwd.z, 0, 1, 0);
    }
  };

  const setMicEnabled = (on: boolean) => {
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = on;
    });
  };

  return {
    callPeer,
    handleSignal,
    removePeer,
    setPeerPosition,
    peerLevel,
    updateListener,
    setMicEnabled,
    micAvailable: () => localStream !== null,
    resume: () => {
      ctx?.resume().catch(() => {});
    },
    dispose: () => {
      for (const id of [...peers.keys()]) removePeer(id);
      localStream?.getTracks().forEach((track) => track.stop());
      ctx?.close().catch(() => {});
    },
  };
}
