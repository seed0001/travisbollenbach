# The Concert Hall — the hall in the round

**Route:** `/rabbit-hole/concert` · **Component:** [`ConcertHall`](../src/components/ConcertHall.tsx), with the performer stack under [`src/lib/luna/`](../src/lib/luna)

The Colossus's showpiece room: a very large, multi-level hall in the round. A sunken stage sits at dead center; four concentric tiers — orchestra, mezzanine, balcony, and gallery — rise outward and upward around it, so from any balcony you look *down* across the void at the performer. You spawn on the mezzanine, tilted down toward the stage.

## The room

- **Multi-level movement** — the tiers are real walkable floors. Movement is blocked over the open voids between rings ("soft railings"), and two ramp sectors bridge each gap, rotated ring by ring so the descent spirals down toward the stage. The camera eases its height to whatever level or ramp you're standing on.
- **Railings** — a glowing rail with posts guards each tier's inner edge; neon ring lines trace every floor edge.
- **The crowd** — instanced audience figures fill the first three tiers (biased toward the inner railings — everyone wants to be near the stage), swaying on their own phase, nearly half holding glowing phone lights overhead. The sway speeds up and the lights swing wider as the music's energy rises. The crowd is thinner on touch devices.
- **The laser show** — a ring of twelve laser heads hangs over the stage, panning and tilting on their own phases. An analyser tapped off the **music stem** drives sweep speed and beam brightness; a bass-onset beat detector flashes the beams, pops a ring of light around the stage edge, and rotates the beam colors every four beats. With nothing playing, the rig idles on slow, faint sweeps.
- **Spotlights and stars** — six spotlight cones rake down onto the stage, swelling with the music, under a dome ceiling of house-light stars.

## The performers

The stage lineup is picked from a roster (in [`concertConfig.ts`](../src/lib/luna/concertConfig.ts)):

- **Luna** (solo) — the default.
- **Victor** (solo).
- **Duet · Luna + Victor** — both singers side by side, sharing one stem mixer so they lip-sync the same vocals in perfect sync. Their spacing scales with performer size.

Every performer is a VRM avatar driven by the Luna performance stack:

- **Lip sync** — vowel shapes (A/E/I/O/U) computed from the *vocal* stem in real time, with jaw and subtle head motion layered on from phonetics.
- **Expressions** — facial emotion inferred from the vocal audio (level, brightness, attack), blendable with lyric-based cues; sustained shouts narrow the eyes.
- **Choreography** — VRMA dance clips (hip-hop, jazz, belly, pop sets) cycling while the song plays, with bone-blended transitions when a clip's motion stops. A quick audio analysis of each track estimates BPM and genre and picks a matching dance playlist.
- **Facing** — the performer turns to face you, the visitor, wherever you stand.
- **Custom performer** — swap the lead singer for any uploaded `.vrm`; lip sync, expressions, and choreography re-attach automatically, and the song keeps playing through the swap. One click resets to Luna solo. If a custom model fails to load, Luna returns so the stage is never empty.

## The setlist

Four built-in tracks, each stored as separate instrumental + vocal stems: **Starline Dream**, **Pixel Escape**, **Stuck in the Chat**, and **Mud Life Anthem**. The lineup and setlist can be picked on the enter overlay before you even step in; the page can also be pointed at a different opening track via its `track` prop.

### Custom song upload

Anyone can hand the hall a song. An upload is a single mixed audio file (up to 80 MB); the server splits it into **instrumental + vocal stems with [Demucs](https://github.com/facebookresearch/demucs)** (`/api/stems/*`, backed by [`src/lib/server/stemSplit.ts`](../src/lib/server/stemSplit.ts) and [`server/split_stems.py`](../server/split_stems.py)), then the performer sings it with full lip sync and choreography. Split results are cached per job and the stems are streamed back to the browser.

This is the one feature with a native dependency: the machine running the server needs a one-time `pip install -r requirements-server.txt`. Splitting runs on CPU by default (set `LUNA_STEM_DEVICE=auto` to allow CUDA/Apple GPU) and the first split can take a few minutes. Without the Python setup the built-in setlist still works — only uploads need it.

## The stage menu

A lit menu board stands on the hall floor near the stage — walk into its radius and a prompt offers to open it (it's also always available from the **stage menu** button in the top bar):

| Section | What it does |
| --- | --- |
| **Size** | Resize the performer, from about half human height up to giant scale (slider) |
| **Singers** | Swap the lineup: Luna, Victor, or the duet |
| **Performer** | Upload a `.vrm` to replace the lead singer; reset to Luna solo |
| **Built-in setlist** | Switch between the four tracks |
| **Upload a song** | Add a custom song (optional title) for stem-split and performance |

The top bar also carries **play set / pause set** and **leave the hall** (back to the street). A status line under the bar reports what's happening — "Loading Luna…", "Ready · Starline Dream · Pop / Electronic", "Playing · …", "Splitting…", and so on.
