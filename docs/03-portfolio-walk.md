# The Portfolio Walk — the blue pill

**Route:** `/storefront` (a legacy route name — nothing is for sale here) · **Component:** [`PortfolioWalk`](../src/components/PortfolioWalk.tsx) on the shared [`WalkWorld`](../src/components/WalkWorld.tsx) engine

The professional side of the site is a **project gallery**, staged as a 3D boulevard. Thirteen panels float on lit pads inside light beams down both sides of a road. Twelve of them are categories of Travis's GitHub work — **53 projects in all** — and the thirteenth, at the center end of the road, is the photo of Travis and his dog. There are no products, no services, no pricing, and no sales pitch: the gallery is a walkable index of the work itself.

## The walk, in order

Each category panel shows its number, its title, and how many projects it holds. Walk up to one and press **E** to open its subpage — a list of every repo in the category, each a direct link to its GitHub page (`github.com/seed0001/…`).

1. **3D Worlds** (5 projects) — travisbollenbach, AI-City, outdoor-world, human-sim, throngs
2. **Games** (4) — survival-sim, darkness-game, Map_Game, MiniSim
3. **AI Companions** (5) — amy, Adam, Andrew, NOVA, eve-and-the-endless-convo
4. **Agents & Autonomy** (5) — agent, growing-agent, Adam-GURU, workshop-RT, claude
5. **Frameworks & Cores** (6) — the-foundation, Framework, baseline, seed, memory-core, SeedKG
6. **Business & Apps** (6) — my-company, company-website, the-biz-app, 3d-printing-company-software, marketplace, b-bBros
7. **Learn AI** (4) — ai-for-everyone, how-ai-works, ai-tools, quote-ai
8. **Vibe Coding** (3) — vibecoding247, vibecoding101, speedy-coder
9. **About Me** (4) — who-i-am, my-hobby, Hopes-Place, mental-space
10. **Media & Creative** (4) — media-network, Audio-Podcast, travis-s-creations, travis-and-andrew-website
11. **Experiments** (4) — pressure, digital-pressure, flowMax, Star-Ant
12. **Bots & Toys** (3) — seg-bot, dan, jar
13. **The photo** — Travis and his dog (the head of the quality assurance department, who approves every release). Press **E** to see it full-screen.

## What you can do

- **Walk and read** — same controls as everywhere else (WASD/arrows + mouse, or touch thumbs; **E** at a panel opens its subpage, which pauses movement and frees the cursor).
- **Jump to GitHub** — every repo on a category subpage opens its GitHub page in a new tab.
- **Cross over** — "back to the choice" returns to the Gateway, and "the construct" (top-right) jumps straight to the red-pill side.

For crawlers and screen readers, the page also renders the entire category/repo list as plain HTML links.

## Editing the content

The categories and their repo lists live in the `CATEGORIES` array at the top of [`src/components/PortfolioWalk.tsx`](../src/components/PortfolioWalk.tsx), with `GH_USER` naming the GitHub account the links point at. Adding a project is a matter of appending a repo name to a category — the walk lays out panels and counts from the data; no 3D code changes needed. The page kicker and control hints come from the `portfolioWalk` object in [`src/lib/content.ts`](../src/lib/content.ts).
