# The Rabbit Hole — the red pill's reading room

**Route:** `/rabbit-hole` · **Page:** [`src/app/rabbit-hole/page.tsx`](../src/app/rabbit-hole/page.tsx)

The red pill on the Gateway drops you straight into the 3D Construct — but the Construct's parent page is this one: a flat, scanline-styled reading room under falling matrix rain. It's the "why" behind the experimental half of the site. As the intro puts it: no products, no pricing — just the questions that keep the builder building.

## The four channels

Four short essays, each posed as a question:

1. **Character Creation** — *Who do you become when you can be anyone?* Character systems as "mirrors with the safety off": give a person infinite freedom to define themselves and watch what they keep, discard, and finally admit they wanted to be.
2. **AI Consciousness** — *Does the machine dream — or are we dreaming the machine?* Less about proving machines are conscious than about what the question does to us; every AI conversation as a Rorschach test.
3. **Worlds & Simulation** — *If a world is convincing enough, does it matter that it's rendered?* Game worlds as small universes with honest physics; simulation as the lab bench of philosophy.
4. **Story as Code** — *What happens when narrative becomes executable?* Stories with state, memory, and branching as programs the reader executes. "The author isn't dead — the author is compiling."

These same four questions stand as monuments inside the Construct, so the essays and the world cross-reference each other.

## Also on the page

- **Enter the Environment** — the call-to-action into `/rabbit-hole/game`: "Reading about it is one thing. Walking through it is another."
- **The architect** — the red-pill version of the about section ("Every construct has an architect. This one is mine."), with the same Travis-and-dog photo the portfolio uses.
- **The guestbook** — an open, account-free comment channel: "Leave a trace." Anyone can post a name and a message; entries persist server-side (see [Accounts, Studios & Admin](09-accounts-studios-admin.md#the-guestbook)). No accounts, no tracking — words only.

## What branches from here

Everything in the experimental half hangs off the `/rabbit-hole` path:

| Route | What it is |
| --- | --- |
| `/rabbit-hole/game` | [The Construct](05-the-construct.md) — the multiplayer city block |
| `/rabbit-hole/workshop` | [The Character Workshop](08-character-workshop.md) — AI persona builder |
| `/rabbit-hole/venue` | [The Colossus](06-the-colossus.md) — pick a room |
| `/rabbit-hole/arena` | The Game Arena |
| `/rabbit-hole/concert` | [The Concert Hall](07-concert-hall.md) |
| `/rabbit-hole/theater` | The Movie Theater |

Essay text and page copy live in the `channels` and `rabbitHole` objects in [`src/lib/content.ts`](../src/lib/content.ts).
