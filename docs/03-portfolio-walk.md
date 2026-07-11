# The Portfolio Walk — the blue pill

**Route:** `/storefront` · **Component:** [`PortfolioWalk`](../src/components/PortfolioWalk.tsx) on the shared [`WalkWorld`](../src/components/WalkWorld.tsx) engine

The professional portfolio, staged as a 3D boulevard. Panels float on lit pads inside light beams down both sides of a road; you stroll past them and read, or walk up to any panel and press **E** to open it as a full readable overlay.

## The walk, in order

1. **Hero panel** — "Software, systems & launch-ready work." Sets the pitch: tools, applications, and software for businesses, with clear scope and practical execution.
2. **By the numbers** — the stats wall: 10+ years building, 50+ projects shipped, 3 disciplines / one focus, ∞ curiosity.
3. **Tools & applications** — four project panels:
   - **Flagship Web Platform** (Software, 2026) — full-stack product built end to end. *Available.*
   - **AI-Powered Tooling** (Automation, 2025) — LLMs applied to real workflows. *Available.*
   - **Brand Identity System** (Design, 2025) — logo, type, color, motion guidelines. *By request.*
   - **Launch Campaign Kit** (Strategy, 2024) — positioning, site, and story for a launch. *By request.*
4. **Work with me** — three service panels: **Product & Software** (full-stack apps, AI integration, architecture), **Design & Brand** (identity, UI/UX, design systems), and **Strategy & Launch** (positioning, landing pages, go-to-market).
5. **About** — "Hi, I'm Travis." The person behind the tools, with the photo of Travis and his dog (the head of the quality assurance department, who approves every release).
6. **Contact** — the end of the road: "Need something built?" with an email call-to-action.

## What you can do

- **Walk and read** — same controls as everywhere else (WASD/arrows + mouse, or touch thumbs; **E** at a panel opens the reader overlay, which pauses movement and frees the cursor).
- **Email Travis** — the contact panel's CTA opens a mail link to the address in `site.email`.
- **Cross over** — exit links lead back to the Gateway, so the red-pill side is never far away.

## Editing the content

Every word on the boulevard comes from [`src/lib/content.ts`](../src/lib/content.ts): the `portfolioWalk` object (headings, hero, hints, contact), `products`, `services`, `stats`, `about`, and `site`. Adding a project is a matter of appending to the `products` array — the walk lays out panels from the data; no 3D code changes needed.
