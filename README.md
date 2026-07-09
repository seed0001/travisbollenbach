# travisbollenbach.com

The source for **[travisbollenbach.com](https://travisbollenbach.com)** — a personal site that's really two sites behind one door.

A visitor lands on a *Matrix*-style choice screen and picks a pill:

- **Blue pill → `/storefront`** — a clean professional portfolio: software, services, projects, an about section, a guestbook, and site stats.
- **Red pill → `/rabbit-hole`** — the experimental world behind the work: short essays on characters, AI, simulation, and story, opening into **The Construct**, a live 3D multiplayer environment you can walk around in.

It's part portfolio, part playground.

## The Construct

The centerpiece (`/rabbit-hole/game`) is a browser-rendered 3D city block built with **Three.js**, where visitors move around as avatars in real time:

- **Multiplayer presence** — see other visitors move and turn, synced over a WebSocket server.
- **Text + voice chat** — chat messages broadcast to everyone in the lobby, with WebRTC peer-to-peer voice over a mesh (the WebSocket doubles as the signaling channel).
- **Walk-up interactions** — approach a storefront or the Arena entrance and a prompt appears to step inside.
- **VRM avatars** — humanoid avatars via [`@pixiv/three-vrm`](https://github.com/pixiv/three-vrm), with a procedural walk cycle; `.vrm`, `.glb`, `.gltf`, and `.fbx` models are supported.
- **Ten rentable storefront units** — a street of shops. One is live (the Character Workshop); others are demo tenants or vacant "for lease" spots.
- **The Arena** — a domed game hall at the end of the block. Each unit owns a pod inside, and an owner can point their pod at an external game URL to make it playable.

## The Character Workshop

A live unit on the street (`/rabbit-hole/workshop`) lets anyone design a persona — either a **character** (stays in-role) or a **tool** (a focused assistant) — and chat with it. Personas are turned into a system prompt and run against an LLM through [OpenRouter](https://openrouter.ai). Usage is rate-limited per IP since each message spends the operator's API credits.

## Accounts & studios

The site has its own lightweight auth and content-management layer, all backed by JSON files on disk (no external database):

- **Auth** (`/account`) — email/password sign-up with scrypt-hashed passwords and cookie sessions. The account matching the `ADMIN_EMAIL` env var is minted as the owner and can't be demoted or deleted.
- **Studio back office** (`/studio`) — a unit owner customizes their storefront: wall content (image, website, or YouTube embed), merch links, an uploaded VRM avatar, and the game their Arena pod links to.
- **Admin console** (`/admin`) — the owner manages members and studios.
- **Guestbook** — an account-free comment channel on the portfolio.
- **Analytics** — a self-hosted page-view beacon and a live stats endpoint (visitor count, whether the host is online).

## Tech stack

- **[Next.js 16](https://nextjs.org)** (App Router) with **React 19** and **TypeScript**
- **Tailwind CSS v4** for styling
- **Three.js** + **@pixiv/three-vrm** for the 3D environment and avatars
- **Framer Motion** for UI animation
- A **custom Node server** (`server.mjs`) wrapping Next.js to add the `ws` WebSocket lobby (presence, chat, and WebRTC voice signaling)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Note:** `npm run dev` uses the standard Next.js dev server. The WebSocket features (the multiplayer lobby, chat, and voice in The Construct) run under the custom server, so to exercise the full experience locally, build and start it:

```bash
npm run build
npm start   # runs server.mjs
```

## Configuration

All persistent data (accounts, sessions, studios, comments, uploads, VRM files) is written to a data directory on disk, so point `DATA_DIR` at a mounted volume in production to survive redeploys.

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAIL` | The account that owns the site — always admin, never lockable-out. |
| `OPENROUTER_API_KEY` | Enables the Character Workshop chat. |
| `OPENROUTER_MODEL` | Overrides the default model (`openai/gpt-4o-mini`). |
| `DATA_DIR` | Where JSON data and uploads are stored (falls back to `COMMENTS_DIR`, then `./data`). |
| `PORT` | Server port (default `3000`). |

## Project structure

```
src/
  app/
    page.tsx              The pill-choice landing screen
    storefront/           Blue pill — professional portfolio
    rabbit-hole/          Red pill — essays, The Construct, Arena, Workshop
    account/  admin/  studio/   Auth, owner console, studio back office
    api/                  Auth, comments, studios, uploads, workshop chat, stats, analytics
  components/             ChoiceScreen, ConstructGame (the 3D world), ArenaLobby,
                          Workshop, StudioBackOffice, AdminConsole, Guestbook, …
  lib/                    auth, studios, lobby (WebRTC client), persona, openrouter, analytics, content
server.mjs               Custom Next.js + WebSocket server (the multiplayer lobby)
```

All site copy lives in `src/lib/content.ts` — edit there to change text everywhere.

## Deployment

Runs anywhere that supports a long-lived Node process (built for Railway): `npm run build` then `npm start`. Set the environment variables above and mount a volume at `DATA_DIR`.
