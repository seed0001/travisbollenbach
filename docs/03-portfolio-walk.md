# The Portfolio Walk — the blue pill

**Route:** `/storefront` (a legacy route name — nothing is for sale here) · **Component:** [`PortfolioWalk`](../src/components/PortfolioWalk.tsx) on the shared [`WalkWorld`](../src/components/WalkWorld.tsx) engine

The professional side of the site is a **project gallery**, staged as a 3D boulevard. Fourteen panels float on lit pads inside light beams down both sides of a road. Twelve of them are categories of Travis's GitHub work — **88 projects in all** — the thirteenth spotlights the projects that actually have tagged GitHub Releases, and the fourteenth, at the center end of the road, is the photo of Travis and his dog. There are no products, no services, no pricing, and no sales pitch: the gallery is a walkable index of the work itself.

Panels idle in a slow spin; walk up to one and it turns to face you. The intro overlay reads: *"Every panel is a category of what I've built on GitHub — 88 projects across 12 rooms."*

## The walk, in order

Each category panel shows its number, its title, and how many projects it holds. Press **E** at a panel to open its subpage — a list of every repo in the category, each a direct link to its GitHub page (`github.com/seed0001/…`).

1. **3D Worlds** (7 projects) — travisbollenbach, AI-City, outdoor-world, human-sim, throngs, the-worlds, simtown
2. **Games** (9) — survival-sim, darkness-game, Map_Game, MiniSim, space-movie, ar-games, PHONE-GAMES, cards, discordgame
3. **AI Companions** (7) — amy, Adam, Andrew, NOVA, eve-and-the-endless-convo, connor, checkin-companion
4. **Agents & Autonomy** (7) — agent, growing-agent, Adam-GURU, workshop-RT, claude, Andrew-the-coder, the-office
5. **Frameworks & Cores** (11) — the-foundation, Framework, baseline, seed, memory-core, SeedKG, Engines, forge, voidcoder, voidcoder-website, new-internet
6. **Business & Apps** (11) — my-company, company-website, the-biz-app, 3d-printing-company-software, marketplace, b-bBros, medbot, MedicalBot-Platform, mental-space-app, sharenet, market-strategy-lab
7. **Learn AI** (5) — ai-for-everyone, how-ai-works, ai-tools, quote-ai, ai-schooling
8. **Vibe Coding** (3) — vibecoding247, vibecoding101, speedy-coder
9. **About Me** (6) — who-i-am, my-hobby, my-story, my-hub, Hopes-Place, mental-space
10. **Media & Creative** (10) — media-network, Audio-Podcast, travis-s-creations, travis-and-andrew-website, book-maker, castflow, ai-studio, movieMaker, videoMaker, the-voide-network
11. **Experiments** (4) — pressure, digital-pressure, flowMax, Star-Ant
12. **Bots & Toys** (8) — seg-bot, dan, jar, discord-agent, multi-agent-discord-bot, Discord-Bot-Platform, ai-tv, GifWarBot
13. **Releases** — a spotlight on whatever's actually tagged and shipping on GitHub right now, not just committed to. Currently just **forge** (62 releases and counting), rendered as a live recreation of its own desktop UI rather than a screenshot, with its latest version and links to the repo and its release history. Hand-authored in the `SHOWCASE` array — add an entry here by hand once another project starts cutting real releases.
14. **The photo** — Travis and his dog ("the one who approves every release"). Press **E** to see it full-screen.

## What you can do

- **Walk and read** — the standard controls (WASD/arrows + mouse, or touch thumbs; **E** at a panel opens its subpage, which pauses movement and frees the cursor; **Esc** closes it). On touch, a **recenter** button in the top bar re-levels the camera if the view tilts, and **switch to touch** bails out of motion controls without reloading.
- **Jump to GitHub** — every repo on a category subpage opens its GitHub page in a new tab.
- **Cross over** — "back to the choice" returns to the Gateway, and "the construct" (top-right) jumps straight to the red-pill side.

For crawlers and screen readers, the page also renders the entire category/repo list as plain HTML links (visually hidden).

## Editing the content

The categories and their repo lists live in the `CATEGORIES` array at the top of [`src/components/PortfolioWalk.tsx`](../src/components/PortfolioWalk.tsx), with `GH_USER` naming the GitHub account the links point at. Adding a project is a matter of appending a repo name to a category — the walk lays out panels and counts from the data; no 3D code changes needed. The Releases spotlight is a separate hand-authored `SHOWCASE` array in the same file. The page kicker and control hints come from the `portfolioWalk` object in [`src/lib/content.ts`](../src/lib/content.ts).
