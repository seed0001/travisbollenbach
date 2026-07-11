# The Gateway — the landing hub

**Route:** `/` · **Component:** [`PortalHub`](../src/components/PortalHub.tsx) on the shared [`WalkWorld`](../src/components/WalkWorld.tsx) engine

The first thing every visitor sees. Instead of a flat landing page, the site opens on a small first-person 3D room: a grid floor, drifting light motes, and two glowing pills waiting on pedestals. Before you step in, the camera drifts on a slow cinematic establishing shot high over the scene; clicking (or tapping a control style on mobile) settles it into first person.

## What's in the room

- **The blue pill** (left) — a glossy blue capsule spinning over a lit pad, with a floating sign carrying its name and one-line description. Taking it routes to `/storefront`, the project gallery.
- **The red pill** (right) — the same treatment in red. Taking it routes to `/rabbit-hole/game`, straight into the Construct.
- **The scoreboard** — a giant jumbotron deep at the back of the room, past the walkable boundary, showing live site stats (below).
- Each pill also gets a rim point-light and a soft additive glow, so the two halves of the room read blue and red.

## Controls

| | Desktop | Touch |
| --- | --- | --- |
| Walk | WASD / arrow keys | left thumb stick |
| Look | mouse (pointer lock) | right thumb, or device motion ("AR style") |
| Take a pill | **E** near it, or click the prompt | tap the prompt |

Walking into a pill's trigger zone pops a placard ("Take the blue pill" / "Take the red pill"); confirming navigates.

## Escape hatches

Not everyone wants the theater:

- **portfolio** (top-right) — jumps straight to the project gallery at `/storefront` without walking anywhere.
- **sign in** (the exit link) — goes to `/account` for members and the owner.

## The live scoreboard

The back wall is a canvas-texture jumbotron titled **"LIVE SITE TELEMETRY"**, refreshed from the public `/api/stats` endpoint every 30 seconds:

- **Hero number** — how many visitors are inside the Construct right now (live lobby presence).
- **Host presence** — "TRAVIS IS IN THE CONSTRUCT" / "TRAVIS IS NOT INSIDE AT THE MOMENT". This is verified server-side against the session cookie on the lobby socket, so it can't be spoofed by picking his display name.
- **Detail row** — visitors today, visits today, members, and recent visits.

The board's face and halo ignore the scene fog and tone mapping, so while the far room fades into haze the scoreboard stays crisp. Until the first fetch resolves it shows em-dash placeholders. Where the numbers come from is covered in [Accounts, Studios & Admin](09-accounts-studios-admin.md#analytics).

## Notes

- The scene copy (title, pill labels, subtitles, control hints) lives under `hub` in [`src/lib/content.ts`](../src/lib/content.ts).
- An older flat landing page (`ChoiceScreen`, with the 2D `SiteStats` strip and `Pill3D` cards) still exists in the codebase but is no longer routed — the Gateway replaced it.
- The "in the construct now" and host-presence numbers come from the WebSocket lobby in `server.mjs`, so they read `0` under the plain Next dev server — they're live on the real deployment.
