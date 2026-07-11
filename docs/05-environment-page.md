# The Environment Page — essays and the guestbook

**Route:** `/rabbit-hole` · **Page:** [`src/app/rabbit-hole/page.tsx`](../src/app/rabbit-hole/page.tsx)

A flat, scanline-styled reading page under falling matrix rain. **This is not where the red pill lands** — the red pill goes straight into the [Construct](04-the-construct.md). This page is the Construct's parent: you reach it through the Construct's "exit" / "back to the environment page" links. It's the "why" behind the experimental half — as its headline puts it, *"Step into the ideas behind the work."*

## The four signals

Four short essays, presented as numbered "signals," each posed as a question:

1. **Character Creation** — *Who do you become when you can be anyone?* Character systems as "mirrors with the safety off."
2. **AI Consciousness** — *Does the machine dream — or are we dreaming the machine?* Every AI conversation as a Rorschach test.
3. **Worlds & Simulation** — *If a world is convincing enough, does it matter that it's rendered?* Simulation as the lab bench of philosophy.
4. **Story as Code** — *What happens when narrative becomes executable?* "The author isn't dead — the author is compiling."

These essays exist only on this page — they are text on the site, not objects inside the 3D world.

## Also on the page

- **The architect** — the red-pill version of the about section ("Every construct has an architect. This one is mine."), with the photo of Travis and his dog.
- **Enter the Environment** — the big call-to-action card into `/rabbit-hole/game`: "Step into the 3D space and move through the questions as places."
- **The guestbook** — an open, account-free comment channel: "Leave a trace." Anyone can post a name and message; entries persist server-side (see [Accounts, Studios & Admin](09-accounts-studios-admin.md#the-guestbook)). No accounts, no tracking — words only.
- **Header links** — "view portfolio" (to `/storefront`) and the site name (back to the Gateway).

## What lives under this path

Everything in the experimental half hangs off the `/rabbit-hole` route:

| Route | What it is |
| --- | --- |
| `/rabbit-hole/game` | [The Construct](04-the-construct.md) — the multiplayer city block (the red pill's destination) |
| `/rabbit-hole/workshop` | [The Character Workshop](08-character-workshop.md) — the AI persona builder |
| `/rabbit-hole/venue` | [The Colossus](06-the-colossus.md) — the three-room venue picker |
| `/rabbit-hole/arena` | The Game Arena |
| `/rabbit-hole/concert` | [The Concert Hall](07-concert-hall.md) |
| `/rabbit-hole/theater` | The Movie Theater |

Essay text and page copy live in the `channels`, `rabbitHole`, and `about` objects in [`src/lib/content.ts`](../src/lib/content.ts).
