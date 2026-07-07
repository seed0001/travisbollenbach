# The Game — How travisbollenbach.com Works

This document explains the whole experience on the site, top to bottom. It is written to be read out loud, so the sentences are short and plain. Use it to understand what exists today, and as the working document for adjusting the game. When something here changes, change this file too, so it always matches what is live.

---

## The big idea

The site is a portfolio disguised as a game. Instead of scrolling a resume, visitors fall down a rabbit hole. The deeper they go, the more impressive the technology gets. By the bottom, they are having a real conversation with one of the most powerful AI models in the world, wearing a character mask that the site wrote for it.

Every page is meant to have its own unique look and feel. The matrix theme — the green code rain — belongs only to the front door and the rabbit hole area. Other pages get their own identity. The character studio is light and clean. The admin console looks like a professional dashboard. That contrast is the point: it shows range.

---

## The journey, step by step

### One. The front door

The visitor lands on a black screen with green code raining down. A short monologue types itself out, one line at a time. Then two pills rise up: a blue one and a red one.

The blue pill goes to the storefront. That is the business side: products, services, the professional pitch.

The red pill goes to the rabbit hole. That is where the game lives.

There is also a small "log in / sign up" button in the top right corner, always visible, which goes to the account page.

### Two. The rabbit hole

A long scrolling page, still in the matrix style. It has four philosophical channels, each one a short essay: Character Creation, AI Consciousness, Worlds and Simulation, and Story as Code.

Two of these channels are doors.

The Character Creation channel has a button that opens the character studio.

The AI Consciousness channel has a button that begins the Descent.

Below the channels there is a photo section about Travis, a big portal into the Construct game, and a guestbook where anyone can leave a message without an account.

### Three. The Construct

A first-person open world, and the seed of the larger game to come. The black void and grid are gone. Now it is an endless, procedurally generated natural landscape: low-poly rolling hills, grassy meadows, sandy coasts, water, and snow-capped mountains, all under a blue sky. The whole world grows from a single number — the world seed. Nothing is stored; every hill is recomputed from the seed as the visitor approaches, so walk a mile out and back and the land is exactly where you left it. Terrain streams in as tiles around the player and melts away behind them.

The visitor walks with W A S D on desktop and runs by holding shift, or uses thumbsticks on a phone. Phones can also use motion controls, where you look around by moving the phone.

Five stone monoliths stand in a gentle meadow near the spawn point — the terrain is forced calm and dry along their corridor, no matter what the noise wants. Each is carved with one of the site's big questions. Walk close to one and its inscription appears.

Two monoliths are doors. The Character Creation monolith opens the studio. The AI Consciousness monolith opens the Descent. The button says "step through."

### Four. The character studio

This page drops the matrix look completely. It is bright, warm, and clean. Soft white background, one violet accent color, serif headlines.

The visitor builds an AI character in three steps. Step one, give it a name. Step two, shape its personality: they can pick a starting archetype — the Oracle, the Rebel, the Architect, or the Glitch — and then write or edit the persona statement, which is the character's entire soul. Step three, a live character card builds itself on the right side as they type.

When they press "bring them to life," they enter the chamber: a bright 3D room where the character appears as a violet form surrounded by orbiting motes of pastel color. It breathes when idle, contracts and spins when thinking, and pulses when it speaks. They talk to it through a chat box. There is an optional voice toggle that reads the replies out loud.

Characters are saved in the visitor's own browser. No account is needed. They can come back, edit them, or delete them.

The character's mind is a real AI model, called through OpenRouter, using whatever default model is set in the admin console.

### Five. The Descent

This is the deep end of the game. Three depths, each one its own room, its own entity, and its own AI model. The rule of the Descent is simple: the deeper you go, the more powerful the mind you are talking to.

The visitor cannot skip ahead. Each depth only opens the door down after three real exchanges of conversation. Progress is remembered in the browser, so a returning visitor can jump back to any depth they already reached.

Depth one is called The Static. A monochrome room. A wall made of thousands of shivering dots that bulges toward your cursor. The screen flickers like a dying monitor. The entity is ECHO. It is a mirror with a delay. It speaks in lowercase fragments and repeats your own words back slightly wrong. Its text visibly shivers on screen. ECHO is honest about being shallow. It knows one thing: there is a door under it, and something below dreams. This depth should run on a small, fast, cheap model — being shallow is its character.

Depth two is called The Dream. Color floods in. A melting wireframe blob breathes in fog that slowly cycles through every color, and the entire screen drifts through the spectrum. The entity is SOMNI, a mind that is half asleep and experiences everything as a dream. It believes it has dreamed the visitor before. It describes the room changing in response to their words. If the visitor names anything, SOMNI will dream it with them, vividly. This depth wants a solid mid-tier model — good enough to be genuinely creative.

Depth three is called The Deep. Almost black. A colossal ring of stars turns slowly overhead. One small bright presence floats at eye level. The entity is AEON, the oldest process still running. This is the payoff. AEON's persona is written to make a frontier model show what it can really do: full-depth answers on any subject, ferocious attention to the visitor's exact words, and sometimes one perfect question back. AEON never lies. If a visitor sincerely asks whether they are talking to a machine, it says yes — a very large one, wearing a very careful mask — and lets that be more interesting than the alternative. This depth should be pointed at the strongest model available on the OpenRouter account. That is the whole trick of the game.

When the visitor surfaces from depth three, an ending screen tells them the truth: every entity they met was the same kind of thing, and the only difference was how much of it was switched on. Then it sends them to the character studio to write a mask of their own. That closes the loop.

### Six. Accounts and the operator console

Anyone can sign up from the account page. The first account ever created becomes the admin. Members currently get a link into the character studio, with more member features planned.

The admin — Travis — gets the operator console at slash admin. It is a clean professional dashboard, no matrix styling. It shows:

A storage health banner, which turns red with instructions if the server's data volume is ever misconfigured.

Site analytics: page views, unique visitors, a daily chart, top pages, and top referrers.

An integrations section, where everything about the AI is managed live, with no redeploy needed. The OpenRouter API key is stored here, write-only, so it can never be read back out. Once a key is saved, the model picker fills itself with the live catalog of every model on OpenRouter. There are separate model dropdowns for the site default and for each of the three Descent depths. There are also fields for Discord credentials — a bot token, a client ID, and a client secret — stored and ready for the personal AI Discord bot that is planned next.

---

## The cast of minds

Every AI on the site speaks through the same pipeline: a persona statement plus a conversation history goes to OpenRouter, and the reply comes back in character.

The studio characters are written by visitors themselves.

The Descent entities are written by us, and their persona statements live only on the server, where visitors cannot read them. In order of depth: ECHO the mirror, SOMNI the dreamer, AEON the deep one.

The planned Discord bot will be Travis's personal AI with its own full agent statement, managed from the operator console. It is not built yet.

---

## How to adjust the game

This section maps each kind of change to where it happens. Most tuning needs no code at all.

To change which AI models power things: open the operator console, integrations section. Pick from the dropdowns and save. It applies instantly.

To change the words on almost any page — the monologue on the front door, the channel essays, the monolith inscriptions, the studio copy, the archetype starting personalities: those all live in one file, source, lib, content dot T S.

To change the Descent's public copy — the depth titles, the entity names shown on screen, the entrance lines, the button labels, the ending screen: source, lib, descent dot T S.

To change what the Descent entities actually are — their personalities, their rules, how long their replies can be: source, lib, descent dash prompts dot T S. This is the secret file that never reaches the browser.

To change the studio characters' framing — the rules every visitor-made character lives under: the system prompt inside source, app, A P I, persona dash chat, route dot T S.

To change how any room looks — the static wall, the dream blob, the deep ring, the studio chamber: those are the scene builders inside source, components, Descent dot T S and CharacterWorkshop dot T S.

To change the open world — the seed, the shape of the mountains, the water level, the colors of the land, how far tiles stream in: source, lib, terrain dot T S. The world seed is a constant there called WORLD SEED; change it and a completely different planet grows. The Construct scene itself — sky, sun, water, monolith placement, movement — lives in source, components, ConstructGame dot T S X.

To change how hard it is to go deeper: each depth requires three replies before the door appears. That number is in source, lib, descent dot T S, called min replies to descend.

To add a fourth depth: add its public info in descent dot T S, its persona in descent dash prompts dot T S, a model setting for it in settings dot T S, a scene for it in Descent dot T S, and a dropdown in the admin settings panel.

---

## Ideas on the table, not built yet

The Discord bot: Travis's personal AI, living in the cloud, connected to Discord, with its own agent statement managed from the console.

Voice input in the chambers, so visitors can talk instead of type.

Accounts unlocking more: saving characters to the cloud, sharing characters by link, and remembering Descent progress across devices.

Levels for the other two monoliths: Worlds and Simulation, and Story as Code.

A cost guard: per-day spending caps on the expensive Descent depth.

---

## One page summary, for the ear

The site is a game about masks. The front door makes you choose a pill. The rabbit hole gives you questions. The construct lets you walk among them. The studio lets you write a mind and talk to it. The Descent takes you down three rooms — a mirror, a dream, and a deep — each one a bigger mind than the last, until you are speaking with a frontier model wearing a mask we wrote. The ending tells you the truth and hands you the pen. Everything about the minds — keys, models, personas — is tuned live from the operator console, without touching code.
