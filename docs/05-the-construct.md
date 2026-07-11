# The Construct — the multiplayer city block

**Route:** `/rabbit-hole/game` · **Component:** [`ConstructGame`](../src/components/ConstructGame.tsx) (the site's largest component — it predates the shared `WalkWorld` engine and keeps its own loop because it also carries the multiplayer lobby)

The centerpiece of the site: a browser-rendered 3D city block where visitors walk around together in real time. One street, ten storefronts, question monuments in the dark, and a giant venue closing off the far end.

## Multiplayer

The Construct is a shared space, powered by the WebSocket lobby in [`server.mjs`](../server.mjs):

- **Presence** — every visitor in the lobby appears as an avatar; you see each other move and turn live.
- **Text chat** — a group chat panel (open by default on desktop, tucked away on mobile; there's a shortcut that frees the cursor and focuses the box). Messages broadcast to everyone inside.
- **Voice chat** — WebRTC peer-to-peer voice over a mesh; the WebSocket doubles as the signaling channel. Newcomers initiate the connection with everyone already inside so offers never collide.
- **Identity** — your display name and avatar choice are saved locally and rejoin with you.

## Avatars

Humanoid avatars via `@pixiv/three-vrm` with a procedural walk cycle. Supported model formats: `.vrm`, `.glb`, `.gltf`, and `.fbx`. Visitors pick or supply an avatar; storefront owners can also give their unit a VRM shopkeeper (uploaded from the [studio back office](09-accounts-studios-admin.md#the-studio-back-office)).

## The street — ten rentable storefronts

Ten units line the block, five per side, each with a lit sign band, awning, and window glow in its own accent color. Their names, taglines, and statuses come from the `storefronts` array in [`src/lib/content.ts`](../src/lib/content.ts); their *content* comes from the studio system:

- **Unit 01 — Character Workshop** (*live*) — walk up and a prompt offers to open the Workshop app.
- **Units 02–04 — Neon Threads, The Gallery, Byte Bazaar** (*occupied*) — demo tenants showing the concept: wearables, prints, software.
- **Units 05–10 — For Lease** (*vacant*) — empty storefronts advertising "Your storefront here."

A claimed unit's walls display whatever its owner set in the back office: an uploaded image, a website (rendered as a poster naming the destination, with a weekly-refreshed screenshot snapshot via `/api/shot`), or a YouTube embed. External images are routed through the site's `/api/proxy` to dodge CORS.

## The monuments

The four questions from the [Rabbit Hole essays](04-rabbit-hole.md) stand as monuments in the dark — walk up to one to read it in-world.

## The Colossus entrance

The far end of the street is walled off by a monolithic domed venue with a giant marquee — **THE COLOSSUS**, lettered "Game Arena" and "Concert Hall" in its top corners. Walking into the forecourt pops the entrance placard; pressing **E** steps inside to the [venue choice](06-the-colossus.md) (`/rabbit-hole/venue`).

## Controls

Same scheme as every 3D space on the site: WASD/arrows + pointer-lock mouse on desktop, twin thumbs + optional gyro (AR-style look) on touch, **E** to interact with whatever you've walked up to. On-screen hints cover the chat and voice toggles.

## Notes

- Full multiplayer (presence, chat, voice) requires the custom server (`npm start`); under `next dev` the world renders but the lobby is absent.
- The lobby also feeds the [Gateway scoreboard](02-the-gateway.md#the-live-scoreboard): the "in the construct now" count and the verified host-presence flag come from this socket.
