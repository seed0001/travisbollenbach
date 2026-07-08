import { createServer } from "node:http";
import next from "next";
import { WebSocketServer } from "ws";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const dev = process.env.NODE_ENV === "development";
const app = next({ dev, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();

const rooms = new Map();

function send(socket, message) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function leaveRoom(socket) {
  const roomId = socket.roomId;
  const peerId = socket.peerId;
  if (!roomId || !peerId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  room.delete(peerId);
  for (const peer of room.values()) {
    send(peer, { type: "peer-left", peerId });
  }
  if (room.size === 0) rooms.delete(roomId);

  socket.roomId = undefined;
  socket.peerId = undefined;
}

app.prepare().then(() => {
  const server = createServer((request, response) => {
    handle(request, response);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (url.pathname !== "/voice-signaling") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (socket) => {
    socket.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(String(raw));
      } catch {
        send(socket, { type: "error", error: "Bad signaling message." });
        return;
      }

      if (message.type === "join") {
        const roomId =
          typeof message.roomId === "string" && message.roomId.length <= 64
            ? message.roomId
            : "main-lobby";
        const peerId =
          typeof message.peerId === "string" && message.peerId.length <= 96
            ? message.peerId
            : crypto.randomUUID();

        leaveRoom(socket);
        socket.roomId = roomId;
        socket.peerId = peerId;

        const room = rooms.get(roomId) ?? new Map();
        rooms.set(roomId, room);
        const peers = [...room.keys()];
        room.set(peerId, socket);

        send(socket, { type: "joined", peerId, peers });
        for (const [otherPeerId, peer] of room) {
          if (otherPeerId !== peerId) {
            send(peer, { type: "peer-joined", peerId });
          }
        }
        return;
      }

      if (!socket.roomId || !socket.peerId) {
        send(socket, { type: "error", error: "Join a room before signaling." });
        return;
      }

      const room = rooms.get(socket.roomId);
      const target =
        room && typeof message.to === "string" ? room.get(message.to) : null;
      if (!target) return;

      send(target, {
        type: message.type,
        from: socket.peerId,
        payload: message.payload,
      });
    });

    socket.on("close", () => leaveRoom(socket));
    socket.on("error", () => leaveRoom(socket));
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`> Server listening on http://0.0.0.0:${port}`);
  });
});
