# The Gateway — the landing hub

**Route:** `/` · **Component:** [`PortalHub`](../src/components/PortalHub.tsx) on the shared [`WalkWorld`](../src/components/WalkWorld.tsx) engine

The first thing every visitor sees. Instead of a flat landing page, the site drops you into a small first-person 3D room: a dark grid floor, drifting light motes, and two glowing pills waiting on pedestals. The overlay reads **"Choose."** — walk up to a pill and take it.

## What's in the room

- **The blue pill** (left) — a glossy blue capsule spinning over a lit pad. Taking it routes to `/storefront`, the professional portfolio.
- **The red pill** (right) — the same treatment in red. Taking it routes to `/rabbit-hole/game`, straight into the Construct.
- **The scoreboard** — a giant jumbotron deep at the back of the room, past the walkable boundary, showing live site stats (see below).
- **Signage** — each pill carries a floating lit sign with its name and a one-line description of where it leads.

## Controls

| | Desktop | Touch |
| --- | --- | --- |
| Walk | WASD / arrow keys | left thumb stick |
| Look | mouse (pointer lock) | right thumb / device motion |
| Take a pill | **E** near it | tap the prompt |

Walking into a pill's trigger zone pops a prompt card ("Take the blue pill" / "Take the red pill"); confirming navigates.

## Escape hatches

Not everyone wants the theater:

- **portfolio** (top-right) — jumps straight to `/storefront` without walking anywhere.
- **sign in** (corner link) — goes to `/account` for members and the owner.

## The live scoreboard

The back wall of the room is a scoreboard drawn on a canvas texture, refreshed from the public `/api/stats` endpoint every 30 seconds:

- **Hero number** — how many visitors are inside the Construct right now (live lobby presence).
- **Host presence** — whether Travis himself is currently inside. This is verified server-side against the session cookie on the lobby socket, so it can't be spoofed by picking his display name.
- **Detail row** — visitors today, visits today, member count, and recent visits.

The board's face and halo ignore the scene fog and tone mapping, so while the rest of the far room fades into haze, the scoreboard stays crisp — a deliberate "highlighted in the back" effect. Until the first fetch resolves, it shows em-dash placeholders. Where the numbers come from is covered in [Accounts, Studios & Admin](09-accounts-studios-admin.md#analytics).

## Notes

- The scene copy (title, pill labels, hints) lives under `hub` in [`src/lib/content.ts`](../src/lib/content.ts).
- An older flat landing page (`ChoiceScreen`, with the 2D `SiteStats` strip) still exists in the codebase but is no longer routed; the Gateway replaced it.
- The "online now" and host-presence numbers come from the WebSocket lobby in `server.mjs`, so they read `0` under the plain Next dev server — they're live on the real deployment.
