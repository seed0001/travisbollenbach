import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import next from "next";
import { WebSocketServer } from "ws";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const dev = process.env.NODE_ENV === "development";
const app = next({ dev, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

const MAX_LOBBY_SIZE = 32;
const MAX_CHAT_LENGTH = 280;
const MAX_NAME_LENGTH = 24;

/** @type {Map<string, { socket: import("ws").WebSocket, name: string, color: string, x: number, z: number, yaw: number }>} */
const lobby = new Map();

function send(socket, message) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(message, exceptId) {
  for (const [id, peer] of lobby) {
    if (id !== exceptId) send(peer.socket, message);
  }
}

function cleanName(value) {
  const name = String(value ?? "")
    .replace(/[\r\n\t]/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return name || `guest-${Math.floor(1000 + Math.random() * 9000)}`;
}

function cleanColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? value : "#8fb3ff";
}

function publicPeer(id, peer) {
  return {
    id,
    name: peer.name,
    color: peer.color,
    x: peer.x,
    z: peer.z,
    yaw: peer.yaw,
  };
}

function leaveLobby(socket) {
  const id = socket.lobbyId;
  if (!id || !lobby.has(id)) return;
  lobby.delete(id);
  socket.lobbyId = undefined;
  broadcast({ type: "peer-left", id });
}

app.prepare().then(() => {
  const server = createServer((request, response) => {
    handle(request, response);
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (url.pathname !== "/lobby-ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (socket) => {
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }

      if (message.type === "join") {
        if (lobby.size >= MAX_LOBBY_SIZE) {
          send(socket, { type: "full" });
          return;
        }
        leaveLobby(socket);
        const id = randomUUID();
        const peer = {
          socket,
          name: cleanName(message.name),
          color: cleanColor(message.color),
          x: Number.isFinite(message.x) ? message.x : 0,
          z: Number.isFinite(message.z) ? message.z : 10,
          yaw: Number.isFinite(message.yaw) ? message.yaw : 0,
        };
        socket.lobbyId = id;
        lobby.set(id, peer);
        send(socket, {
          type: "welcome",
          id,
          peers: [...lobby]
            .filter(([peerId]) => peerId !== id)
            .map(([peerId, other]) => publicPeer(peerId, other)),
        });
        broadcast({ type: "peer-joined", peer: publicPeer(id, peer) }, id);
        return;
      }

      const id = socket.lobbyId;
      const self = id ? lobby.get(id) : undefined;
      if (!id || !self) return;

      switch (message.type) {
        case "move": {
          if (
            !Number.isFinite(message.x) ||
            !Number.isFinite(message.z) ||
            !Number.isFinite(message.yaw)
          ) {
            return;
          }
          self.x = message.x;
          self.z = message.z;
          self.yaw = message.yaw;
          broadcast(
            { type: "peer-moved", id, x: self.x, z: self.z, yaw: self.yaw },
            id,
          );
          return;
        }
        case "chat": {
          const text = String(message.text ?? "")
            .trim()
            .slice(0, MAX_CHAT_LENGTH);
          if (!text) return;
          broadcast({
            type: "chat",
            id,
            name: self.name,
            color: self.color,
            text,
            ts: Date.now(),
          });
          return;
        }
        case "color": {
          self.color = cleanColor(message.color);
          broadcast({ type: "peer-color", id, color: self.color }, id);
          return;
        }
        case "signal": {
          // WebRTC voice signaling: relay offers/answers/ICE to one peer
          const target = lobby.get(String(message.to ?? ""));
          if (target && message.data) {
            send(target.socket, { type: "signal", from: id, data: message.data });
          }
          return;
        }
      }
    });

    socket.on("close", () => leaveLobby(socket));
    socket.on("error", () => leaveLobby(socket));
  });

  // Drop connections that stop responding so ghost orbs don't linger
  const heartbeat = setInterval(() => {
    for (const client of wss.clients) {
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 30000);
  wss.on("close", () => clearInterval(heartbeat));

  server.listen(port, () => {
    console.log(`> Ready on http://0.0.0.0:${port} (dev: ${dev})`);
  });
});
