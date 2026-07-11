# The Concert Hall — the hall in the round

**Route:** `/rabbit-hole/concert` · **Component:** [`ConcertHall`](../src/components/ConcertHall.tsx), with the performer stack under [`src/lib/luna/`](../src/lib/luna)

The Colossus's showpiece room: a very large, multi-level hall in the round. A sunken stage sits at dead center; concentric tiers rise outward and upward around it, so from any balcony you look *down* across the void at the performer. Ramps spiral between levels, railings guard the gaps, and the whole room runs on the site's unlit-neon material language.

## The room

- **Multi-level movement** — the tiers are real, walkable floors. Movement is blocked over the open voids between rings, and paired ramp sectors bridge each gap, rotated ring by ring so the descent spirals down toward the stage.
- **The crowd** — a swaying audience fills the tiers, phone lights held up, so the hall never feels empty.
- **The laser show** — beat-reactive beams driven by the *music* stem of the playing track, sweeping in time with the song.

## The performers

The stage lineup is picked from a roster (defined in [`concertConfig.ts`](../src/lib/luna/concertConfig.ts)):

- **Luna** (solo) — the default performer.
- **Victor** (solo).
- **Duet** — Luna and Victor side by side, sharing one stem mixer so they stay in sync.

Every performer is a VRM avatar driven by the Luna performance stack:

- **Lip sync & expressions** — driven by the *vocal* stem of the playing track.
- **Choreography** — VRMA dance clips synced to beat and genre analysis.
- **Custom performer** — swap the lead singer for any uploaded `.vrm` avatar; lip sync, expressions, and choreography re-attach automatically. One click resets to Luna solo.

## The setlist

Four built-in tracks: **Starline Dream**, **Pixel Escape**, **Stuck in the Chat**, and **Mud Life Anthem**. The hall opens on the default track; the page can also be pointed at another song via the `track` prop.

### Custom song upload

Anyone can hand the hall a song of their own. An upload is a single mixed audio file; the server splits it into **instrumental + vocal stems with [Demucs](https://github.com/facebookresearch/demucs)** (the `/api/stems/*` routes, backed by [`src/lib/server/stemSplit.ts`](../src/lib/server/stemSplit.ts)), then the performer sings it with full lip sync and choreography. Split results are cached per job.

This is the one feature with a native dependency: the machine running the server needs a one-time `pip install -r requirements-server.txt`. The first split can take a few minutes on CPU. Without the Python setup, the built-in setlist still works — only custom uploads need it.

## The stage menu board

A lit menu board stands on the hall floor — walk up to it to open the stage controls:

| Section | What it does |
| --- | --- |
| **Scale** | Resize the performer, from human scale up to giant |
| **Lineup** | Swap the stage lineup: Luna, Victor, or the duet |
| **Performer** | Upload a `.vrm` to replace the lead singer; reset to Luna |
| **Setlist** | Switch between the four built-in tracks |
| **Upload** | Add a custom song (optional title) for stem-split and performance |

## Notes

- Same first-person controls as the rest of the site; exits lead back to the [Colossus venue door](06-the-colossus.md).
- An overhead jumbotron (face cam / YouTube screen) existed in an earlier version of the hall but was dropped in the Luna rewrite — the stage menu sections above are the current feature set.
