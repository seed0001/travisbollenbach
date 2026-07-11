# The Construct — the red pill

**Route:** `/rabbit-hole/game` · **Component:** [`ConstructGame`](../src/components/ConstructGame.tsx) (the site's largest component — it predates the shared `WalkWorld` engine and keeps its own loop because it also carries the multiplayer lobby)

Taking the red pill drops you **directly here**: a browser-rendered 3D city block where visitors walk around together in real time. One street, ten storefront units, and a giant venue — The Colossus — walling off the far end. The Construct is the hub of the experimental half of the site: the Colossus rooms, the Character Workshop, and the essay page are all reached from inside or via its links.

## Entering

Before stepping in, an overlay lets you set your identity: a display name (saved locally, defaults to `guest-NNNN`) and one of eight orb colors. Desktop enters with a click into pointer-lock; mobile picks between motion (gyro, "AR style") and touch controls. The overlay's pitch: *"A virtual city block. Walk the street, step into the storefronts, and claim a space of your own."*

## Multiplayer

The Construct is a shared space, powered by the WebSocket lobby in [`server.mjs`](../server.mjs) (capacity 32):

- **Presence** — every other visitor appears as a **glowing orb** in their chosen color, with their name floating above it. Orbs drift smoothly toward each visitor's live position and bob gently.
- **Text chat** — a group chat panel (open by default on desktop, tucked away on mobile). Press **Enter** to jump into the chat box; messages (up to 280 characters) broadcast to everyone inside. Joins and leaves appear as system lines.
- **Voice chat** — a mic toggle enables WebRTC peer-to-peer voice over a mesh; the WebSocket doubles as the signaling channel. Newcomers initiate the connection with everyone already inside so offers never collide.
- **Identity** — your name and orb color are saved in localStorage and rejoin with you; if the connection drops it reconnects and re-enters where you stood.

## The street — ten rentable storefront units

Ten units line the block, five per side, each an open-fronted room with accent-colored posts, awning, threshold sill, and a lit sign band (unit number + name). Their base names and statuses come from the `storefronts` array in [`src/lib/content.ts`](../src/lib/content.ts); their *live* content comes from the studio system (`/api/studios/public`):

- **Unit 01 — Character Workshop** (*live*) — walk up and a prompt offers to open the Workshop; **E** goes to `/rabbit-hole/workshop`.
- **Units 02–04 — Neon Threads, The Gallery, Byte Bazaar** (*occupied*) — demo tenants showing the concept.
- **Units 05–10 — For Lease** (*vacant*) — advertising "Your storefront here" until an owner claims them.

Walking up to a unit pops a placard: unit number, status ("available to rent" / "now open" / "open now"), the owner's studio name, "Run by …" if a proprietor is set, and the owner's tagline. Owners standing at their own unit also get a "Manage your studio →" link to `/studio`.

### The walls

Every unit has three poster walls (back, left, right). A claimed unit's owner sets what hangs on each: an **image** (uploaded or external, proxied through `/api/proxy` to dodge CORS), a **website** (rendered as a poster with a weekly-refreshed front-page screenshot via `/api/shot`), or a **YouTube video** (thumbnail with a play badge). Aim the crosshair at a wall and press **E**:

- **Visitors** view the image full-screen, play the YouTube video, or open the website in an embedded frame (with a new-tab link).
- **Owners** get an in-world wall editor — swap the wall's type, paste a URL, upload an image — without leaving the 3D world. A link to the full back office is right there too.

### The shopkeepers

An owner can upload an avatar (**.vrm**, **.glb**, **.gltf**, or **.fbx**, up to 60 MB) that lives inside their unit. Models are auto-fit to a normal height, stood on the floor, and pace back and forth along the frontage, pausing to face the street. VRM models get a procedural walk cycle; GLB/FBX models play their own animation clip if they ship one. The owner controls its size (0.5–3×) and facing from the back office.

## The Colossus entrance

The far end of the street is closed off by a monolithic domed venue with a giant marquee — **THE COLOSSUS**, lettered "Game Arena" and "Concert Hall" in its top corners, with a light-curtain doorway. Walking into the forecourt pops the entrance placard; **E** steps inside to the [room picker](06-the-colossus.md) at `/rabbit-hole/venue`.

## Exits

The **exit** button (top bar) and the enter-overlay's "back to the environment page" link both lead to [`/rabbit-hole`](05-environment-page.md) — the flat essays-and-guestbook page. The red pill never lands there directly; it's the Construct's back door.

## Notes

- Full multiplayer (presence, chat, voice) requires the custom server (`npm start`); under `next dev` the world renders but the lobby is absent.
- The lobby also feeds the [Gateway scoreboard](02-the-gateway.md#the-live-scoreboard): the "in the construct now" count and the verified host-presence flag come from this socket.
- Controls match the rest of the site: WASD/arrows + pointer-lock mouse, twin thumbs + optional gyro on touch, **E** to interact, **Enter** for chat, **Esc** to free the cursor or close overlays.
