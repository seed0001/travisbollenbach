# Documentation

A guided tour of everything on **travisbollenbach.com** — what each part of the site is, what it contains, and what a visitor (or the owner) can do there.

## The map

The site is really two sites behind one door. Every visitor starts at the 3D Gateway and picks a pill:

```
/  The Gateway (3D hub, pill choice, live scoreboard)
├── blue pill → /storefront          The Portfolio Walk (professional work)
└── red pill  → /rabbit-hole/game    The Construct (3D multiplayer city block)
      /rabbit-hole                   The essays + guestbook
      /rabbit-hole/workshop          The Character Workshop (AI personas)
      /rabbit-hole/venue             The Colossus (pick a room)
      ├── /rabbit-hole/arena         Game Arena
      ├── /rabbit-hole/concert       Concert Hall
      └── /rabbit-hole/theater       Movie Theater
/account   /studio   /admin          Accounts, studio back office, operator console
```

## The pages

| Page | Covers |
| --- | --- |
| [Overview](01-overview.md) | What the site is, the two-pill idea, and how the pieces fit together |
| [The Gateway](02-the-gateway.md) | The 3D landing hub: the pills, the controls, and the live stats scoreboard |
| [The Portfolio Walk](03-portfolio-walk.md) | The blue pill: a 3D boulevard of professional work |
| [The Rabbit Hole](04-rabbit-hole.md) | The red pill's reading room: four essays and the guestbook |
| [The Construct](05-the-construct.md) | The multiplayer 3D city block: presence, chat, voice, avatars, storefronts |
| [The Colossus](06-the-colossus.md) | The venue at the end of the street: Game Arena and Movie Theater |
| [The Concert Hall](07-concert-hall.md) | The hall in the round: singers, setlist, stage menu, lasers, the crowd |
| [The Character Workshop](08-character-workshop.md) | Design an AI persona — a character or a tool — and talk to it |
| [Accounts, Studios & Admin](09-accounts-studios-admin.md) | Sign-up, the studio back office, the operator console, and analytics |
| [Architecture](10-architecture.md) | Tech stack, the custom server, data storage, the API surface, deployment |

All visitor-facing copy lives in [`src/lib/content.ts`](../src/lib/content.ts) — names, taglines, essay text, and signage are edited there, not in components.
