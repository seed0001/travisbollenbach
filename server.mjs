import { createServer } from "http";
import next from "next";
import { createLobby } from "./server/lobby.mjs";

// Custom server: Next.js plus the lobby WebSocket endpoint in one process.
// `next start` can't host WebSockets, so `npm run dev` and `npm start` both
// boot this file instead — see node_modules/next/dist/docs/01-app/02-guides/custom-server.md

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const upgrade = app.getUpgradeHandler();
  const lobby = createLobby();

  const server = createServer((req, res) => handle(req, res));

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    if (pathname === "/ws/lobby") {
      lobby.handleUpgrade(req, socket, head);
    } else {
      // everything else (dev HMR etc.) belongs to Next
      upgrade(req, socket, head);
    }
  });

  server.listen(port, () => {
    console.log(
      `> Ready on http://localhost:${port} (${dev ? "dev" : "production"})`,
    );
  });
});
