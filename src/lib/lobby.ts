// Client for the construct lobby: presence + chat over WebSocket,
// voice over a WebRTC mesh (the socket doubles as the signaling channel).

export type PeerInfo = {
  id: string;
  name: string;
  color: string;
  x: number;
  z: number;
  yaw: number;
};

export type ChatMessage = {
  id: string;
  name: string;
  color: string;
  text: string;
  ts: number;
  system?: boolean;
};

export type LobbyStatus = "connecting" | "connected" | "disconnected";

export type LobbyEvents = {
  onStatus(status: LobbyStatus): void;
  onWelcome(selfId: string, peers: PeerInfo[]): void;
  onPeerJoined(peer: PeerInfo): void;
  onPeerLeft(id: string, name: string): void;
  onPeerMoved(id: string, x: number, z: number, yaw: number): void;
  onPeerColor(id: string, color: string): void;
  onChat(message: ChatMessage): void;
  onReset(): void;
};

type SignalData = {
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export class LobbyClient {
  private events: LobbyEvents;
  private socket: WebSocket | null = null;
  private selfId: string | null = null;
  private name = "";
  private color = "#8fb3ff";
  private spawn = { x: 0, z: 10, yaw: 0 };
  private peers = new Map<string, PeerInfo>();
  private disposed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private pcs = new Map<string, RTCPeerConnection>();
  private audioSenders = new Map<string, RTCRtpSender>();
  private audioElements = new Map<string, HTMLAudioElement>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private micStream: MediaStream | null = null;

  constructor(events: LobbyEvents) {
    this.events = events;
  }

  connect(name: string, color: string, x: number, z: number, yaw: number) {
    this.name = name;
    this.color = color;
    this.spawn = { x, z, yaw };
    this.open();
  }

  private open() {
    if (this.disposed) return;
    this.events.onStatus("connecting");
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${protocol}://${window.location.host}/lobby-ws`);
    this.socket = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "join",
          name: this.name,
          color: this.color,
          ...this.spawn,
        }),
      );
    };

    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      this.handleMessage(message);
    };

    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.teardownSession();
      if (!this.disposed) {
        this.events.onStatus("disconnected");
        this.reconnectTimer = setTimeout(() => this.open(), 2500);
      }
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleMessage(message: any) {
    switch (message.type) {
      case "welcome": {
        this.selfId = message.id;
        this.peers.clear();
        for (const peer of message.peers as PeerInfo[]) {
          this.peers.set(peer.id, peer);
          // The newcomer initiates voice with everyone already inside;
          // existing peers just answer, so offers never collide.
          void this.createPeerConnection(peer.id, true);
        }
        this.events.onStatus("connected");
        this.events.onWelcome(message.id, [...this.peers.values()]);
        return;
      }
      case "peer-joined": {
        const peer = message.peer as PeerInfo;
        this.peers.set(peer.id, peer);
        this.events.onPeerJoined(peer);
        return;
      }
      case "peer-left": {
        const peer = this.peers.get(message.id);
        this.peers.delete(message.id);
        this.closePeerConnection(message.id);
        this.events.onPeerLeft(message.id, peer?.name ?? "someone");
        return;
      }
      case "peer-moved":
        this.events.onPeerMoved(message.id, message.x, message.z, message.yaw);
        return;
      case "peer-color": {
        const peer = this.peers.get(message.id);
        if (peer) peer.color = message.color;
        this.events.onPeerColor(message.id, message.color);
        return;
      }
      case "chat":
        this.events.onChat({
          id: message.id,
          name: message.name,
          color: message.color,
          text: message.text,
          ts: message.ts,
        });
        return;
      case "signal":
        void this.handleSignal(message.from, message.data);
        return;
    }
  }

  private send(message: object) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  sendMove(x: number, z: number, yaw: number) {
    this.spawn = { x, z, yaw }; // rejoin where you stood if we reconnect
    this.send({ type: "move", x, z, yaw });
  }

  sendChat(text: string) {
    this.send({ type: "chat", text });
  }

  setColor(color: string) {
    this.color = color;
    this.send({ type: "color", color });
  }

  // --- Voice -----------------------------------------------------------------

  async enableMic(): Promise<boolean> {
    if (this.micStream) return true;
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch {
      return false;
    }
    const track = this.micStream.getAudioTracks()[0] ?? null;
    for (const sender of this.audioSenders.values()) {
      void sender.replaceTrack(track);
    }
    return true;
  }

  disableMic() {
    if (!this.micStream) return;
    this.micStream.getTracks().forEach((track) => track.stop());
    this.micStream = null;
    for (const sender of this.audioSenders.values()) {
      void sender.replaceTrack(null);
    }
  }

  get micEnabled() {
    return this.micStream !== null;
  }

  private async createPeerConnection(peerId: string, initiator: boolean) {
    let pc = this.pcs.get(peerId);
    if (pc) return pc;

    pc = new RTCPeerConnection(RTC_CONFIG);
    this.pcs.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.send({
          type: "signal",
          to: peerId,
          data: { candidate: event.candidate.toJSON() },
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.attachAudio(peerId, stream);
    };

    // Always keep an audio slot open both ways so turning the mic on later
    // is just a track swap — no renegotiation needed.
    const transceiver = pc.addTransceiver("audio", { direction: "sendrecv" });
    this.audioSenders.set(peerId, transceiver.sender);
    const micTrack = this.micStream?.getAudioTracks()[0];
    if (micTrack) void transceiver.sender.replaceTrack(micTrack);

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.send({
        type: "signal",
        to: peerId,
        data: { sdp: pc.localDescription },
      });
    }
    return pc;
  }

  private async handleSignal(from: string, data: SignalData) {
    try {
      const pc = await this.createPeerConnection(from, false);
      if (data.sdp) {
        await pc.setRemoteDescription(data.sdp);
        const queued = this.pendingCandidates.get(from) ?? [];
        this.pendingCandidates.delete(from);
        for (const candidate of queued) {
          await pc.addIceCandidate(candidate).catch(() => {});
        }
        if (data.sdp.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.send({
            type: "signal",
            to: from,
            data: { sdp: pc.localDescription },
          });
        }
      } else if (data.candidate) {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(data.candidate).catch(() => {});
        } else {
          const queue = this.pendingCandidates.get(from) ?? [];
          queue.push(data.candidate);
          this.pendingCandidates.set(from, queue);
        }
      }
    } catch {
      // A failed handshake with one peer shouldn't take down the lobby
    }
  }

  private attachAudio(peerId: string, stream: MediaStream) {
    let element = this.audioElements.get(peerId);
    if (!element) {
      element = document.createElement("audio");
      element.autoplay = true;
      element.setAttribute("playsinline", "");
      element.style.display = "none";
      document.body.appendChild(element);
      this.audioElements.set(peerId, element);
    }
    element.srcObject = stream;
    element.play().catch(() => {});
  }

  private closePeerConnection(peerId: string) {
    this.pcs.get(peerId)?.close();
    this.pcs.delete(peerId);
    this.audioSenders.delete(peerId);
    this.pendingCandidates.delete(peerId);
    const element = this.audioElements.get(peerId);
    if (element) {
      element.srcObject = null;
      element.remove();
      this.audioElements.delete(peerId);
    }
  }

  private teardownSession() {
    for (const peerId of [...this.pcs.keys()]) {
      this.closePeerConnection(peerId);
    }
    this.peers.clear();
    this.selfId = null;
    this.events.onReset();
  }

  dispose() {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.disableMic();
    this.teardownSession();
    this.socket?.close();
    this.socket = null;
  }
}
