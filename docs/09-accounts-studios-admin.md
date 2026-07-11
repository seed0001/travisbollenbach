# Accounts, Studios & Admin — the management layer

The site runs its own lightweight auth and content management, all backed by JSON files on disk (no external database). Three surfaces sit on top of it: the account page for everyone, the studio back office for unit owners, and the operator console for the site owner.

## Accounts

**Route:** `/account` · **Component:** [`AccountPanel`](../src/components/AccountPanel.tsx) · **Lib:** [`src/lib/auth.ts`](../src/lib/auth.ts)

Email/password sign-up and login, styled as a "restricted terminal":

- Passwords are **scrypt-hashed**; sessions are cookie-based (`tb_session`).
- The account whose email matches the **`ADMIN_EMAIL`** env var is minted as the owner: always admin, can't be demoted or deleted, can't be locked out.
- API: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`.

## The studio back office

**Route:** `/studio` · **Component:** [`StudioBackOffice`](../src/components/StudioBackOffice.tsx) · **Lib:** [`src/lib/studios.ts`](../src/lib/studios.ts)

Where a storefront owner customizes their unit on the [Construct's street](05-the-construct.md). A signed-in owner edits:

- **Walls** — three slots (back, left, right), each showing an uploaded image, a website (rendered in-world as a poster with a snapshot), or a YouTube embed.
- **Merch & links** — outbound links for the unit.
- **VRM avatar** — upload a `.vrm` shopkeeper that stands in the storefront.
- **Arena game** — the unit's pod in the [Game Arena](06-the-colossus.md#the-game-arena): set the game's name, tagline, and the URL it launches. This is what flips the pod from "soon" to "live."

Changes go through `/api/studio` (and `/api/studio/upload`, `/api/studio/vrm`) and appear in the world on the next visit — no deploys involved.

## The operator console

**Route:** `/admin` · **Component:** [`AdminConsole`](../src/components/AdminConsole.tsx)

The owner's dashboard, in four tabs:

- **Overview** — headline counts and the newest members.
- **Members** — search, promote/demote, and remove accounts (the owner account is untouchable).
- **Storefronts** — manage studios: see who owns which unit and reassign or clear them.
- **Traffic** — a 14-day traffic view with a 7-day top-pages window, fed by the analytics store.

Backed by `/api/admin/members` and `/api/admin/studios`; the page is owner-only and never cached.

## The guestbook

**Component:** [`Guestbook`](../src/components/Guestbook.tsx) on the [rabbit-hole page](04-rabbit-hole.md) · **API:** `/api/comments`

An account-free comment channel — name plus message, persisted to the data directory. No accounts, no tracking.

## Analytics

Self-hosted, cookie-free, and file-backed ([`src/lib/analytics.ts`](../src/lib/analytics.ts)):

- **The beacon** — [`AnalyticsBeacon`](../src/components/AnalyticsBeacon.tsx) is mounted in the root layout and reports every page view to `/api/track` (rate-limited per IP: 100 views per 10 minutes). Views are bucketed per day with paths, referrers, and anonymous visitor ids.
- **The public feed** — `/api/stats` aggregates the store into: online-now count, verified host presence, member count, visitors today, visits today, and recent visits. The online/host numbers come from the lobby presence snapshot that [`server.mjs`](../server.mjs) shares in-process; host presence is verified against the session cookie on the socket, so it can't be spoofed by display name.
- **Where it shows** — publicly on the [Gateway scoreboard](02-the-gateway.md#the-live-scoreboard); privately (with history and top pages) on the operator console's Traffic tab.

## Storage

Everything above — accounts, sessions, studios, comments, analytics, uploads, VRM files — lives in the data directory (`DATA_DIR`, falling back to `./data`). Point it at a mounted volume in production so data survives redeploys. See [Architecture](10-architecture.md) for the full environment table.
