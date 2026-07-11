# Architecture — how the site is built and run

## Tech stack

- **[Next.js 16](https://nextjs.org)** (App Router) with **React 19** and **TypeScript**
- **Tailwind CSS v4** for the flat pages and overlays
- **Three.js** for every 3D space, with **@pixiv/three-vrm** for humanoid avatars
- **Framer Motion** for UI animation
- **`ws`** WebSocket server for the multiplayer lobby, wrapped around Next by a custom Node server

> ⚠️ This repo pins a Next.js version with breaking changes from what most tooling assumes. Before writing code, read the relevant guide in `node_modules/next/dist/docs/` (see `AGENTS.md`).

## The custom server

[`server.mjs`](../server.mjs) wraps the built Next app and adds the real-time layer:

- **The lobby** — presence, group chat relay, and WebRTC voice *signaling* for [the Construct](05-the-construct.md) (actual voice audio is peer-to-peer).
- **Presence sharing** — the server keeps a lobby snapshot (`count`, `hostOnline`) on `globalThis`, which the `/api/stats` route reads in-process. Host presence is verified by checking the socket's `tb_session` cookie against the auth store.

Consequence: `npm run dev` (plain Next dev server) renders everything, but multiplayer and live presence only exist under `npm run build && npm start`.

## The 3D engines

- **[`WalkWorld`](../src/components/WalkWorld.tsx)** — the reusable first-person stage: scene, camera, renderer, pointer-lock/touch/gyro controls, interactable walk-up prompts, and the animation loop. The [Gateway](02-the-gateway.md) and the [Portfolio Walk](03-portfolio-walk.md) are thin `build` callbacks on top of it.
- **[`ConstructGame`](../src/components/ConstructGame.tsx)** — predates `WalkWorld` and keeps its own bespoke loop because it also carries the multiplayer lobby.
- The venue rooms ([`ArenaLobby`](../src/components/ArenaLobby.tsx), [`ConcertHall`](../src/components/ConcertHall.tsx), [`MovieTheater`](../src/components/MovieTheater.tsx)) each own their scene, sharing the same unlit-neon material language and control scheme.
- The concert performer stack lives in [`src/lib/luna/`](../src/lib/luna): avatar loading, lip sync, expressions, beat/genre analysis, VRMA choreography, stem-mixed audio, and the stage menu board.

## The API surface

| Route | Purpose |
| --- | --- |
| `/api/auth/*` | Signup, login, logout, current user |
| `/api/comments` | Guestbook read/post |
| `/api/studio`, `/api/studio/upload`, `/api/studio/vrm` | Studio back office saves and uploads |
| `/api/studios/public` | Public studio content for the Construct's street |
| `/api/admin/members`, `/api/admin/studios` | Operator console management |
| `/api/workshop/chat` | Character Workshop chat (OpenRouter, rate-limited per IP) |
| `/api/track` | Analytics beacon (rate-limited per IP) |
| `/api/stats` | Public live stats (feeds the Gateway scoreboard) |
| `/api/stems/split`, `/api/stems/check`, `/api/stems/cache/…` | Custom-song stem splitting (Demucs) for the Concert Hall |
| `/api/proxy` | Same-origin proxy for external images (SSRF-guarded, size-capped) |
| `/api/shot` | Weekly-refreshed website screenshot snapshots for storefront wall posters |

## Data & configuration

All persistent data — accounts, sessions, studios, comments, analytics, uploads, VRM files — is JSON/files on disk under the data directory. No external database.

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAIL` | The account that owns the site — always admin, never lockable-out |
| `OPENROUTER_API_KEY` | Enables the Character Workshop chat |
| `OPENROUTER_MODEL` | Overrides the default chat model |
| `DATA_DIR` | Where data and uploads live (falls back to `COMMENTS_DIR`, then `./data`) |
| `PORT` | Server port (default `3000`) |

The Concert Hall's custom-song uploads additionally need Python: `pip install -r requirements-server.txt` (Demucs; first split is slow on CPU). The built-in setlist works without it.

## Deployment

Built for **Railway**, or anywhere that runs a long-lived Node process: `npm run build`, then `npm start` (which runs `server.mjs`). Set the env vars above and mount a volume at `DATA_DIR` so data survives redeploys. The working convention for this repo is push-to-deploy: changes land on `main`, GitHub triggers Railway, and verification happens on the deployed site rather than a local server.

## Project structure

```
src/
  app/                    Routes (see docs/README.md for the visitor-facing map)
  components/             PortalHub, PortfolioWalk, ConstructGame, ArenaLobby,
                          ConcertHall, MovieTheater, Workshop, StudioBackOffice,
                          AdminConsole, AccountPanel, Guestbook, WalkWorld, …
  lib/                    content (most site copy), auth, studios, analytics,
                          lobby (WebRTC client), persona, openrouter, luna/ …
server.mjs                Custom Next + WebSocket server (the multiplayer lobby)
server/split_stems.py     The Demucs stem-split worker
```
