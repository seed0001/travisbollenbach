# Overview — what this site is

**travisbollenbach.com** is a personal site that is part portfolio, part playground. It presents the same person two ways and lets the visitor choose which version they came to see.

## The two-pill idea

The landing page is a *Matrix*-style choice staged as a small 3D world ([The Gateway](02-the-gateway.md)): two glowing pills hover on pedestals, and the visitor walks up and takes one.

- **Blue pill → [The Portfolio Walk](03-portfolio-walk.md)** (`/storefront` — a legacy route name; nothing is for sale) — the professional side: a **project gallery**. Twelve panels along a 3D boulevard, each a category of Travis's GitHub work — 53 repositories in all — and each opening a list of direct links to the repos. There are no products, no services, and no sales pitch; the gallery is a walkable index of the work itself.
- **Red pill → [The Construct](04-the-construct.md)** (`/rabbit-hole/game`) — the experimental side: the red pill drops you **straight into the Construct**, a live multiplayer 3D city block. The Construct is the hub of this half of the site — the Colossus venue, the Character Workshop, and the essay page all branch off it.

Nothing is hidden behind the choice — both halves are always reachable — but the framing sets the tone: one door shows the work, the other is for the curious.

## What's in each half

**The professional half** is a single walkable boulevard: twelve category panels covering 53 GitHub projects — 3D worlds, games, AI companions, agents, frameworks, business apps, and more — plus a thirteenth panel at the end of the road: the photo of Travis and his dog.

**The experimental half** all hangs off the Construct:

- **The Construct** (`/rabbit-hole/game`) — a multiplayer 3D street where visitors appear to each other as glowing orbs, with text chat, voice chat, ten rentable storefront units, and a giant venue walling off the far end.
- **The Colossus** (`/rabbit-hole/venue`) — that venue, holding three rooms: a **Game Arena** of pods that link out to games hosted by unit owners, a **Concert Hall** where VRM performers sing with lip sync and choreography, and a **Movie Theater** that plays visitor-supplied video on a big screen.
- **The Character Workshop** (`/rabbit-hole/workshop`) — a persona builder reached through the street's Unit 01: write a character or a professional tool as a set of instructions, then chat with it live through an LLM.
- **The environment page** (`/rabbit-hole`) — the Construct's flat parent page, reached by its "exit" link: four short essays on character creation, AI consciousness, simulation, and story-as-code, plus an open guestbook.

## The management layer

The site runs its own lightweight accounts and content management, all stored as JSON files on disk — no external database:

- **Accounts** (`/account`) — email/password sign-up with cookie sessions.
- **Studio back office** (`/studio`) — a storefront owner names their unit, dresses its walls, adds merch links, uploads a shopkeeper avatar, and points their Arena pod at a game.
- **Operator console** (`/admin`) — the site owner manages members and unit assignments and reads traffic.
- **Analytics** — a self-hosted page-view beacon feeds a public stats endpoint, displayed live on the Gateway's scoreboard.

Details in [Accounts, Studios & Admin](09-accounts-studios-admin.md).

## One design language

Every 3D space shares the same material language — dark grounds, unlit neon (`MeshBasicMaterial`), grid floors, fog, and canvas-drawn signage — and the same first-person controls (WASD/arrows + pointer-lock mouse on desktop, twin thumbs with optional gyro "AR look" on touch, **E** to interact with whatever you've walked up to). Learn the controls once at the Gateway and every other room works the same way.
