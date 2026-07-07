---
name: verify
description: Build, run, and visually verify this Next.js + three.js site (matrix-themed portfolio). Use to confirm UI/WebGL changes actually render.
---

# Verifying this project

## Build & run

```bash
npm ci
npx next build          # also generates next-env.d.ts (tsc alone fails on image imports before this)
npx next start -p 3100  # production server
```

`next lint` does not exist in this Next version — use `npx eslint <file>`.

## Driving WebGL pages headlessly

Playwright is not a project dep; install it in the scratchpad, not here.
Launch the pre-installed Chromium (version mismatch with npm playwright is expected):

```js
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
```

WebGL renders fine under SwiftShader; screenshots capture the three.js canvas.

## Gotchas

- `/rabbit-hole/game` (the construct) blocks the scene behind an entry overlay.
  Desktop mode needs pointer lock (unavailable headless). Instead emulate touch
  (`hasTouch: true` + a mobile device descriptor) and tap "enter with touch
  controls" — no pointer lock or gyro permission needed.
- Capture page console: shader compile errors surface there, not as exceptions.
- Touch-look: swipe the right half of the screen via CDP
  `Input.dispatchTouchEvent`; left half is the walk stick.
- `/rabbit-hole/character-creation` works headless with a plain desktop
  page (no pointer lock needed). The chat backend is OpenRouter; the key +
  model live in admin settings (data/settings.json) with
  `OPENROUTER_API_KEY`/`OPENROUTER_MODEL` env fallback. Without a key,
  `/api/persona-chat` returns 503 `{"error":"offline"}` and the chamber
  shows an in-fiction offline message — that's the expected keyless path.
- First signup becomes admin. `/admin` has analytics + integration
  settings (`/api/admin/settings`, admin-gated, secrets masked to last 4).
