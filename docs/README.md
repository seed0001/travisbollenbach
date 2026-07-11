# Documentation

A guided tour of **travisbollenbach.com** — what each part of the site is and does. Every page below was written directly from the source code it documents.

## The map

Every visitor lands at the 3D Gateway and picks a pill:

```
/  The Gateway (3D hub: two pills + a live stats jumbotron)
├── blue pill → /storefront          The Portfolio Walk — a project gallery:
│                                    53 GitHub repos in 12 walkable categories
└── red pill  → /rabbit-hole/game    The Construct — the multiplayer 3D city
                                     block, and the hub for everything else:
      ├── street's end (press E) →  /rabbit-hole/venue    The Colossus room picker
      │     ├── /rabbit-hole/arena     Game Arena (ten pods, one per street unit)
      │     ├── /rabbit-hole/concert   Concert Hall (Luna live)
      │     └── /rabbit-hole/theater   Movie Theater (bring your own film)
      ├── Unit 01 (press E) →       /rabbit-hole/workshop  Character Workshop
      └── "exit" →                  /rabbit-hole           The environment page
                                                           (four essays + guestbook)
/account   /studio   /admin          Accounts, studio back office, operator console
```

## The pages

| Page | Covers |
| --- | --- |
| [Overview](01-overview.md) | What the site is, the two-pill idea, and how the pieces fit together |
| [The Gateway](02-the-gateway.md) | The 3D landing hub: the pills, the controls, and the live scoreboard |
| [The Portfolio Walk](03-portfolio-walk.md) | The blue pill: a 3D gallery of 53 GitHub projects in 12 categories |
| [The Construct](04-the-construct.md) | The red pill: the multiplayer 3D city block — presence, chat, voice, the street of storefronts |
| [The Environment Page](05-environment-page.md) | The Construct's parent page at `/rabbit-hole`: four essays and the guestbook |
| [The Colossus](06-the-colossus.md) | The venue at the end of the street: the room picker, the Game Arena, and the Movie Theater |
| [The Concert Hall](07-concert-hall.md) | The hall in the round: singers, setlist, stage menu, lasers, the crowd |
| [The Character Workshop](08-character-workshop.md) | Design an AI persona — a character or a tool — and talk to it |
| [Accounts, Studios & Admin](09-accounts-studios-admin.md) | Sign-up, the studio back office, the operator console, and analytics |
| [Architecture](10-architecture.md) | Tech stack, the custom server, the Luna performer stack, data storage, the API surface, deployment |

## Where the words live

Most visitor-facing copy (pill labels, essay text, storefront names, workshop copy, venue signage) lives in [`src/lib/content.ts`](../src/lib/content.ts). The one big exception is the Portfolio Walk's project list: its categories and GitHub repo names live in the `CATEGORIES` array at the top of [`src/components/PortfolioWalk.tsx`](../src/components/PortfolioWalk.tsx).
