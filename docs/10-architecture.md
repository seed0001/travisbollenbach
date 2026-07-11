# Architecture — how the site is built and run

## Tech stack

- **[Next.js 16](https://nextjs.org)** (App Router) with **React 19** and **TypeScript**
- **Tailwind CSS v4** for the flat pages and overlays
- **Three.js** for every 3D space, with **@pixiv/three-vrm** (+ **three-vrm-animation** for VRMA clips) for humanoid avatars, and **wawa-lipsync** for viseme detection
- **Framer Motion** for UI animation on the flat pages
- **`ws`** WebSocket server for the multiplayer lobby, wrapped around Next by a custom Node server

> ⚠️ This repo pins a Next.js version with breaking changes from what most tooling assumes. Before writing code, read the relevant guide in `node_modules/next/dist/docs/` (see `AGENTS.md`).

## The custom server

[`server.mjs`](../server.mjs) wraps the built Next app and adds the real-time layer on the `/lobby-ws` upgrade path:

- **The lobby** — presence (join/move/leave), group chat relay, orb color changes, and WebRTC voice *signaling* for [the Construct](04-the-construct.md) (actual voice audio is peer-to-peer). Capacity 32; names capped at 24 chars, chat at 280; a 30-second ping heartbeat drops dead connections so ghost orbs don't linger.
- **Presence sharing** — the server keeps a lobby snapshot (`count`, `hostOnline`) on `globalThis`, which the `/api/stats` route reads in-process. Host presence is verified by checking the socket's `tb_session` cookie against the auth store on disk.

Consequence: `npm run dev` (plain Next dev server) renders everything, but multiplayer and live presence only exist under `npm run build && npm start`.

## The 3D engines

- **[`WalkWorld`](../src/components/WalkWorld.tsx)** — the reusable first-person stage: scene, camera, renderer, pointer-lock/touch/gyro controls, walk-up interactables with placards, a cinematic pre-entry camera drift, and the animation loop. The [Gateway](02-the-gateway.md) and the [Portfolio Walk](03-portfolio-walk.md) are `build` callbacks on top of it.
- **[`ConstructGame`](../src/components/ConstructGame.tsx)** — predates `WalkWorld` and keeps its own bespoke loop because it also carries the multiplayer lobby, the wall-poster raycaster, and the shopkeeper avatars.
- The venue rooms — [`ArenaLobby`](../src/components/ArenaLobby.tsx), [`ConcertHall`](../src/components/ConcertHall.tsx), [`MovieTheater`](../src/components/MovieTheater.tsx) — each own their scene, sharing the same unlit-neon material language and control scheme. The Concert Hall adds multi-level floor logic (tier/ramp height lookup); the Theater adds stepped-floor riding and a live `VideoTexture` screen.

## The Luna performer stack (`src/lib/luna/`)

The Concert Hall's performer is assembled by `createConcertPerformer` from small drivers:

- **`StemMixer`** — plays a song's instrumental + vocal stems in sync (re-syncing on drift), with two analyser taps: vocals (for the face) and music (for the stage visuals).
- **`VRMVisemeDriver` + `vowelBlend`** — wawa-lipsync viseme detection on the vocal stem, shaped into one dominant VRM vowel (A/E/I/O/U) per syllable; **`VRMPhoneticBoneDriver`** adds jaw opening and small head-pitch nudges per phoneme class.
- **`VRMEmotionDriver`** — facial expressions inferred from vocal features (level, spectral centroid, attack, variance), optionally blended with lyric keyword sentiment and timed emotion cues; sustained shouts squeeze the eyes.
- **`VRMAnimationDirector` + `VRMBoneTransitionBridge`** — loads VRMA clips (idle + a dance catalog), cycles dances while playing, and when a clip's motion stops, slerps the skeleton into the next clip's start pose instead of snapping.
- **`genreAnalysis`** — decodes the music stem, estimates BPM/energy/spectral balance, classifies the song (hip-hop / jazz / belly / pop), and picks a matching dance playlist.
- **`concertCrowd` / `concertLasers`** (in `src/lib/`) — the instanced swaying audience and the beat-reactive laser rig, both driven off the music analyser.
- Also present but not wired to a route in this app: `LunaTTS` (a speech driver that expects an `/api/tts/speak` endpoint) and the `SingingPerformanceDriver` procedural mode used by alternate motion catalogs. Don't document these as visitor-facing features — they're library code.

## The API surface

| Route | Purpose |
| --- | --- |
| `/api/auth/*` | Signup, login, logout, current user |
| `/api/comments` | Guestbook read/post |
| `/api/studio`, `/api/studio/upload`, `/api/studio/vrm` | Studio back office saves, image uploads, avatar upload + serving |
| `/api/studios/public` | Public studio content for the Construct's street (no owner identity) |
| `/api/admin/members`, `/api/admin/studios` | Operator console: roles, removal, unit assignment |
| `/api/workshop/chat` | Character Workshop chat (OpenRouter, 30 msgs/hour/IP) |
| `/api/track` | Analytics beacon (100 views/10 min/IP) |
| `/api/stats` | Public live stats (feeds the Gateway scoreboard) |
| `/api/stems/split`, `/api/stems/check`, `/api/stems/cache/…` | Custom-song stem splitting (Demucs) for the Concert Hall |
| `/api/proxy` | Same-origin image proxy for wall textures (SSRF-guarded, 8 MB cap) |
| `/api/shot` | Weekly-cached website screenshots for storefront wall posters (via an external screenshot service) |
| `/api/uploads` | Serves uploaded studio images from the data volume |

## Data & configuration

All persistent data is JSON/files on disk under the data directory: `users.json`, `sessions.json`, `studios.json`, `comments.json`, `analytics.json`, plus `uploads/`, `vrm/`, and `shots/`. Stem-split results cache under `.cache/luna-stems/`. No external database.

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAIL` | The account that owns the site — always admin, never lockable-out |
| `OPENROUTER_API_KEY` | Enables the Character Workshop chat |
| `OPENROUTER_MODEL` | Overrides the default chat model (`openai/gpt-4o-mini`) |
| `DATA_DIR` | Where data and uploads live (falls back to `COMMENTS_DIR`, then `./data`) |
| `SITE_URL` | Referer header sent to OpenRouter (defaults to the production domain) |
| `LUNA_STEM_DEVICE` | Demucs device: `cpu` (default), `cuda`, `mps`, or `auto` |
| `PORT` | Server port (default `3000`) |

The Concert Hall's custom-song uploads additionally need Python: `pip install -r requirements-server.txt` (Demucs; first split is slow on CPU). The built-in setlist works without it.

## Legacy code to be aware of

A few things exist in the repo but are **not** part of the visitor-facing site — don't document them as features:

- `ChoiceScreen`, `SiteStats`, and `Pill3D` — the old flat landing page, replaced by the 3D Gateway and no longer routed.
- The `arena.games` array in `content.ts` — superseded by live studio-owned pods; kept as a shape reference.
- `src/lib/youtube.ts` — a YouTube-id parser duplicated inside the components that actually use it.

## Deployment

Built for **Railway**, or anywhere that runs a long-lived Node process: `npm run build`, then `npm start` (which runs `server.mjs`). Set the env vars above and mount a volume at `DATA_DIR` so data survives redeploys. The working convention is push-to-deploy: changes land on `main`, GitHub triggers Railway, and verification happens on the deployed site.

## Project structure

```
src/
  app/                    Routes (see docs/README.md for the visitor-facing map)
  components/             PortalHub, PortfolioWalk, ConstructGame, ArenaLobby,
                          ConcertHall, MovieTheater, Workshop, StudioBackOffice,
                          AdminConsole, AccountPanel, Guestbook, WalkWorld, …
  lib/                    content (most site copy), auth, studios, analytics,
                          lobby (WebRTC client), persona, openrouter,
                          concertCrowd, concertLasers, luna/ …
server.mjs                Custom Next + WebSocket server (the multiplayer lobby)
server/split_stems.py     The Demucs stem-split worker
```
