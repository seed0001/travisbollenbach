import { createHash, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { WebSocketServer } from "ws";

// ---------------------------------------------------------------------------
// The lobby backend. One WebSocket room where every signed-in player appears.
// The server is deliberately thin: it authenticates the session cookie,
// tracks who is present, relays position updates, and passes WebRTC
// signaling messages between peers so their voices can connect directly.
// Audio never touches this server — it flows peer to peer.
//
// This file runs outside the Next.js compiler (plain Node), so it reads the
// same JSON files as src/lib/auth.ts rather than importing it.
// ---------------------------------------------------------------------------

const DATA_DIR =
  process.env.DATA_DIR ??
  process.env.COMMENTS_DIR ??
  path.join(process.cwd(), "data");

const SESSION_COOKIE = "tb_session";
const MAX_PLAYERS = 32;
const MAX_MESSAGE_BYTES = 64 * 1024; // SDP offers are a few KB; leave headroom
const MAX_MESSAGES_PER_SECOND = 80;
const WORLD_LIMIT = 400; // positions beyond this are garbage — drop them

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, file), "utf8"));
  } catch {
    return fallback;
  }
}

function parseCookies(header) {
  const jar = {};
  if (!header) return jar;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    jar[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return jar;
}

/** Resolve the session cookie to a user, or null. */
async function authenticate(req) {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const sessions = await readJson("sessions.json", []);
  const session = sessions.find(
    (s) => s.tokenHash === tokenHash && Date.parse(s.expiresAt) > Date.now(),
  );
  if (!session) return null;
  const users = await readJson("users.json", []);
  const user = users.find((u) => u.id === session.userId);
  if (!user) return null;
  const progress = await readJson("progress.json", {});
  const hue = progress[user.id]?.avatarHue;
  return {
    userId: user.id,
    name: user.name || user.email.split("@")[0],
    // no saved hue yet — derive a stable one from the user id
    hue:
      typeof hue === "number"
        ? hue
        : parseInt(createHash("sha256").update(user.id).digest("hex").slice(0, 4), 16) % 360,
  };
}

export function createLobby() {
  const wss = new WebSocketServer({ noServer: true });
  /** peerId -> { ws, userId, name, hue, p, ry, mic, alive, msgCount } */
  const players = new Map();

  const send = (ws, obj) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  };

  const broadcast = (obj, exceptId) => {
    const raw = JSON.stringify(obj);
    for (const [id, p] of players) {
      if (id !== exceptId && p.ws.readyState === p.ws.OPEN) p.ws.send(raw);
    }
  };

  const publicPeer = (id, p) => ({
    id,
    name: p.name,
    hue: p.hue,
    p: p.p,
    ry: p.ry,
    mic: p.mic,
  });

  wss.on("connection", (ws, identity) => {
    const id = randomUUID();
    const player = {
      ws,
      userId: identity.userId,
      name: identity.name,
      hue: identity.hue,
      p: [0, 0, 0],
      ry: 0,
      mic: false,
      alive: true,
      msgCount: 0,
    };
    players.set(id, player);

    send(ws, {
      t: "welcome",
      id,
      peers: [...players]
        .filter(([pid]) => pid !== id)
        .map(([pid, p]) => publicPeer(pid, p)),
    });
    broadcast({ t: "join", peer: publicPeer(id, player) }, id);

    ws.on("pong", () => {
      player.alive = true;
    });

    ws.on("message", (raw) => {
      if (raw.length > MAX_MESSAGE_BYTES) return ws.terminate();
      player.msgCount += 1;
      if (player.msgCount > MAX_MESSAGES_PER_SECOND) return ws.terminate();

      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (msg.t) {
        case "pos": {
          const { p, ry } = msg;
          if (
            !Array.isArray(p) ||
            p.length !== 3 ||
            p.some((v) => typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > WORLD_LIMIT) ||
            typeof ry !== "number" ||
            !Number.isFinite(ry)
          ) {
            return;
          }
          player.p = p;
          player.ry = ry;
          broadcast({ t: "pos", id, p, ry }, id);
          break;
        }
        case "mic": {
          player.mic = msg.on === true;
          broadcast({ t: "mic", id, on: player.mic }, id);
          break;
        }
        case "hue": {
          const h = msg.h;
          if (typeof h !== "number" || h < 0 || h > 360) return;
          player.hue = Math.round(h);
          broadcast({ t: "hue", id, h: player.hue }, id);
          break;
        }
        case "rtc": {
          // voice signaling relay: deliver to the addressed peer only
          const target = players.get(msg.to);
          if (target && msg.data && typeof msg.data === "object") {
            send(target.ws, { t: "rtc", from: id, data: msg.data });
          }
          break;
        }
      }
    });

    ws.on("close", () => {
      players.delete(id);
      broadcast({ t: "leave", id });
    });
    ws.on("error", () => ws.terminate());
  });

  // reap dead connections; reset the per-second message budget
  const heartbeat = setInterval(() => {
    for (const [, p] of players) {
      p.msgCount = 0;
      if (!p.alive) {
        p.ws.terminate();
        continue;
      }
      p.alive = false;
      p.ws.ping();
    }
  }, 15_000);
  wss.on("close", () => clearInterval(heartbeat));

  const handleUpgrade = async (req, socket, head) => {
    let identity = null;
    try {
      identity = await authenticate(req);
    } catch {
      identity = null;
    }
    if (!identity) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    if (players.size >= MAX_PLAYERS) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, identity);
    });
  };

  return { handleUpgrade };
}
