# Overview — what this site is

**travisbollenbach.com** is a personal site that is part portfolio, part playground. It presents the same person two ways and lets the visitor choose which version they came to see.

## The two-pill idea

The landing page is a *Matrix*-style choice, staged as a small 3D world ([The Gateway](02-the-gateway.md)) with two pills hovering on pedestals:

- **Blue pill → [The Portfolio Walk](03-portfolio-walk.md)** (`/storefront`) — the professional version: software, services, projects, and the person behind them, presented as a 3D boulevard of readable panels.
- **Red pill → [The Construct](05-the-construct.md)** (`/rabbit-hole/game`) — the experimental version: a live multiplayer 3D city block, plus the essays, venues, and AI experiments that branch off it.

Nothing is hidden behind the choice — both halves are always reachable — but the framing sets the tone: one door is for clients, the other is for the curious.

## What's in each half

**The professional half** is a single walkable boulevard: a hero panel, a stats wall, four project panels, three service panels, an about panel with a photo, and a contact panel at the end of the road.

**The experimental half** fans out:

- **The Rabbit Hole** (`/rabbit-hole`) — a reading room of four short essays on character creation, AI consciousness, simulation, and story-as-code, with an open guestbook at the bottom.
- **The Construct** (`/rabbit-hole/game`) — the centerpiece: a multiplayer 3D street with ten rentable storefronts, text and voice chat, VRM avatars, and a giant venue at the far end.
- **The Colossus** (`/rabbit-hole/venue`) — that venue, holding three rooms: a **Game Arena** of pods that link out to 3D worlds, a **Concert Hall** where a VRM performer sings with lip sync and choreography, and a **Movie Theater** that plays visitor-supplied video on a big screen.
- **The Character Workshop** (`/rabbit-hole/workshop`) — a persona builder: write a character or a professional tool as a system prompt, then chat with it live through an LLM.

## The management layer

The site runs its own lightweight accounts and content management, all stored as JSON files on disk — no external database:

- **Accounts** (`/account`) — email/password sign-up with cookie sessions.
- **Studio back office** (`/studio`) — a storefront owner decorates their unit's walls, links merch, uploads a VRM shopkeeper, and points their Arena pod at a game.
- **Operator console** (`/admin`) — the site owner manages members and studios and reads traffic.
- **Analytics** — a self-hosted page-view beacon feeds a public stats endpoint, displayed live on the Gateway's scoreboard.

Details in [Accounts, Studios & Admin](09-accounts-studios-admin.md).

## One design language

Every 3D space shares the same material language — dark grounds, unlit neon (`MeshBasicMaterial`), grid floors, fog, and canvas-drawn signage — and the same first-person controls (WASD/arrows + mouse on desktop, twin thumbs + gyro on touch, **E** to interact). Learn the controls once at the Gateway and every other room works the same way.
