# Accounts, Studios & Admin — the management layer

The site runs its own lightweight auth and content management, all backed by JSON files on disk (no external database). Three surfaces sit on top of it: the account page for everyone, the studio back office for unit owners, and the operator console for the site owner.

## Accounts

**Route:** `/account` · **Component:** [`AccountPanel`](../src/components/AccountPanel.tsx) · **Lib:** [`src/lib/auth.ts`](../src/lib/auth.ts)

Email/password sign-up and login, styled as a "restricted terminal" ("Who goes there?" / "jack in"):

- Passwords are **scrypt-hashed** with per-user salts; sessions are 30-day `tb_session` cookies whose tokens are stored hashed.
- The account whose email matches the **`ADMIN_EMAIL`** env var is the owner: always admin at read time, can't be demoted or deleted, can't be locked out. (If `ADMIN_EMAIL` is unset, the first registered account becomes admin.)
- Signup carries a hidden honeypot field for bots and is rate-limited (5 signups/hour/IP); login allows 10 attempts per 10 minutes per IP.
- Admins are routed straight to `/admin` on login. Signed-in members see their name, clearance, and a logout ("unplug") button.
- API: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`.

## The studio back office

**Route:** `/studio` · **Component:** [`StudioBackOffice`](../src/components/StudioBackOffice.tsx) · **Lib:** [`src/lib/studios.ts`](../src/lib/studios.ts)

Where a unit owner customizes their storefront on the [Construct's street](04-the-construct.md). Signed-out visitors are asked to sign in; signed-in members without a unit are told the operator hasn't assigned them one yet. An owner edits, per unit:

- **Listing** — store name, proprietor (shown as "Run by …" on the street placard — never their email), and a tagline/spiel (up to 180 characters).
- **Walls** — three slots (back, left, right), each blank, an uploaded image (PNG/JPG/WEBP/GIF, 5 MB), an external image URL, a website (hangs as a weekly-refreshed screenshot poster), or a YouTube video. Previews render inline.
- **Merch & links** — up to 12 labeled outbound links.
- **Store avatar** — upload a `.vrm`/`.glb`/`.gltf`/`.fbx` shopkeeper (60 MB max) that walks around inside the unit, with a size slider (0.5–3×) and a facing dial ("If your avatar walks backwards, turn it 180°").
- **Arena game** — the unit's pod in the [Game Arena](06-the-colossus.md#the-game-arena): game name, tagline, and the URL it launches (host it anywhere public — "a Railway app works great"). A valid URL flips the pod from "coming soon" to **live**; clearing it takes the pod down.

Changes save through `/api/studio` (uploads via `/api/studio/upload` and `/api/studio/vrm`) and appear in the world on the next visit — no deploys. Owners can also edit walls in-world by pressing **E** at their own wall inside the Construct. All inputs are sanitized server-side (URL shapes, length caps, avatar-path allowlisting).

## The operator console

**Route:** `/admin` · **Component:** [`AdminConsole`](../src/components/AdminConsole.tsx) · owner/admin-only, never cached

"Manage the whole ship." Four tabs:

- **Overview** — member/admin counts, 7-day views and uniques, live "in the construct now," and the newest members.
- **Members** — search by name/email; promote/demote admins; remove accounts (with confirm, and sessions revoked). The owner row is marked "protected."
- **Storefronts** — assign any unit to a registered member by email, reassign, or vacate it. Assigning a vacant unit drops its "For Lease" placeholder name.
- **Traffic** — a 14-day daily views/uniques bar list, plus top pages and top referrers over the last 7 days.

Backed by `/api/admin/members` and `/api/admin/studios`.

## The guestbook

**Component:** [`Guestbook`](../src/components/Guestbook.tsx) on the [environment page](05-environment-page.md) · **API:** `/api/comments`

An account-free comment channel — a handle (40 chars) plus a message (500 chars), with a bot honeypot and a 5-posts-per-10-minutes IP limit. The newest 100 render; the store keeps the most recent 1,000.

## Analytics

Self-hosted, cookie-free, and file-backed ([`src/lib/analytics.ts`](../src/lib/analytics.ts)):

- **The beacon** — [`AnalyticsBeacon`](../src/components/AnalyticsBeacon.tsx) in the root layout reports every route change to `/api/track` (rate-limited to 100 views per 10 minutes per IP). Views are bucketed per UTC day with paths and referrer hosts; `/api`, `/admin`, and internal routes aren't counted; only the first page of a visit credits the external referrer.
- **Visitors** — a day-scoped fingerprint (`sha256(ip | user-agent | day)`, truncated) counts uniques without raw IPs ever hitting disk. Data is capped per day and pruned after 120 days.
- **The public feed** — `/api/stats` aggregates: online-now count, verified host presence, member count, visitors today, visits today, and total recent visits. The online/host numbers come from the lobby presence snapshot that [`server.mjs`](../server.mjs) shares in-process; host presence is verified against the session cookie on the socket, so it can't be spoofed by display name.
- **Where it shows** — publicly on the [Gateway scoreboard](02-the-gateway.md#the-live-scoreboard); privately (with history and top pages) on the console's Traffic tab.

## Storage

Everything above — accounts, sessions, studios, comments, analytics, uploads, avatar files, website snapshots — lives in the data directory (`DATA_DIR`, falling back to `COMMENTS_DIR`, then `./data`). Point it at a mounted volume in production so data survives redeploys. See [Architecture](10-architecture.md) for the full environment table.
