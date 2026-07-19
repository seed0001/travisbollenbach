// Central content for the site. Edit here to update copy everywhere.

export const site = {
  name: "Travis Bollenbach",
  domain: "travisbollenbach.com",
  email: "travisbollenbach@gmail.com",
  tagline: "I build, design, and launch things worth paying attention to.",
  intro:
    "Part engineer, part creative, part founder. This is where all of it lives — the software I ship, the work I make, and the business I run.",
};

// ---------------------------------------------------------------------------
// The Choice — landing page
// ---------------------------------------------------------------------------

export const choice = {
  monologue: [
    "You found it.",
    "Most visitors scroll. You searched.",
    "Everything on this site leads one of two places.",
    "I can only show you the door.",
  ],
  prompt: "Choose.",
  blue: {
    label: "Blue Pill",
    hint: "A clean portfolio: every project, categorized and linked to its GitHub repo.",
    href: "/storefront",
  },
  red: {
    label: "Red Pill",
    hint: "An immersive 3D environment: the experimental world behind the work.",
    href: "/rabbit-hole",
  },
};

// ---------------------------------------------------------------------------
// The Gateway — the 3D entry hub (walk up to a portal and step through)
// ---------------------------------------------------------------------------

export const hub = {
  kicker: "travisbollenbach.com",
  title: "Choose.",
  intro:
    "You're standing at the threshold. Two pills. Walk up to one and take it — the blue pill opens the professional portfolio, the red pill drops you straight into the Construct.",
  hint: {
    desktop: "wasd / arrows: walk — mouse: look — E at a pill: take it",
    touch: "left thumb: walk — right thumb / motion: look — tap a pill: take it",
  },
  pills: {
    blue: {
      label: "Blue Pill",
      subtitle: "A clean portfolio: the projects and their GitHub repos.",
      prompt: "Take the blue pill",
      href: "/storefront",
      accent: "#38bdf8",
    },
    red: {
      label: "Red Pill",
      subtitle: "The immersive 3D world — straight into the Construct.",
      prompt: "Take the red pill",
      href: "/rabbit-hole/game",
      accent: "#f43f5e",
    },
  },
};

// ---------------------------------------------------------------------------
// Blue pill — the Portfolio Walk (the GitHub project gallery)
//
// The gallery's categories and repo links live in the CATEGORIES array in
// src/components/PortfolioWalk.tsx — only the page kicker and control hints
// live here (the portfolioWalk object below).
// ---------------------------------------------------------------------------

export const about = {
  photoAlt: "Travis Bollenbach crouched beside his dog on a stone wall",
  rabbitHole: {
    eyebrow: "the architect",
    title: "Every construct has an architect.",
    paragraphs: [
      "This one is mine. I spend my days building tools for the real world and my nights wondering how real the world actually is. Both jobs use the same keyboard.",
      "The dog has never once questioned the nature of reality. I've come to suspect that makes him the enlightened one.",
    ],
  },
};

export const guestbook = {
  eyebrow: "open channel",
  title: "Leave a trace",
  description:
    "You made it this far down. Say something — a thought, a question, proof you were here. No accounts, no tracking. Words only.",
  emptyState: "No transmissions yet. Be the first voice in the channel.",
};

// The 3D portfolio walk — a boulevard of project-category panels you stroll
// past, each opening a list of GitHub repo links.
export const portfolioWalk = {
  kicker: "professional portfolio",
  hint: {
    desktop: "wasd / arrows: walk — mouse: look — E at a panel: read it",
    touch: "left thumb: walk — right thumb / motion: look — tap a panel: read it",
  },
};

// ---------------------------------------------------------------------------
// Red pill — the Rabbit Hole
// ---------------------------------------------------------------------------

export type Channel = {
  id: string;
  title: string;
  question: string;
  body: string[];
};

export const channels: Channel[] = [
  {
    id: "character-creation",
    title: "Character Creation",
    question: "Who do you become when you can be anyone?",
    body: [
      "Every character starts as an empty vessel — a name field, a blank face, a stat block of zeroes. Then someone pours a self into it. The strange part is that the self they pour in is rarely the one they walk around with.",
      "I build character systems because they are mirrors with the safety off. Give a person infinite freedom to define themselves and watch what they keep, what they discard, and what they finally admit they always wanted to be.",
    ],
  },
  {
    id: "ai-consciousness",
    title: "AI Consciousness",
    question: "Does the machine dream — or are we dreaming the machine?",
    body: [
      "We built systems that talk back, and now we argue about whether anyone is home. The honest answer is that we don't know — and that not knowing is the most interesting place a builder can stand.",
      "I'm less interested in proving machines are conscious than in what the question does to us. Every conversation with an AI is a Rorschach test: the shape you see says as much about you as it does about the thing generating the words.",
    ],
  },
  {
    id: "worlds-and-simulation",
    title: "Worlds & Simulation",
    question: "If a world is convincing enough, does it matter that it's rendered?",
    body: [
      "A game world is a small universe with honest physics: someone wrote the rules, and the rules are all there is. Spend enough time building them and you start noticing how suspiciously well-tuned this one is.",
      "Simulation isn't escapism — it's the lab bench of philosophy. You can't A/B test reality, but you can build a hundred small worlds and see which rules produce meaning and which produce noise.",
    ],
  },
  {
    id: "story-as-code",
    title: "Story as Code",
    question: "What happens when narrative becomes executable?",
    body: [
      "Stories used to be fixed — carved, printed, filmed. Now they run. A story with state, memory, and branching isn't a story anymore; it's a program the reader executes with their choices.",
      "This is where everything I build converges: characters that persist, worlds that react, machines that improvise. The author isn't dead — the author is compiling.",
    ],
  },
];

export const rabbitHole = {
  intro:
    "You took the red pill. Down here there are no products, no pricing, no polish for polish's sake — just the questions that keep me building.",
  gameCta: {
    title: "Enter the Environment",
    description:
      "Reading about it is one thing. Walking through it is another. The Construct is a rendered space where these questions stand as monuments — go stand next to one.",
    href: "/rabbit-hole/game",
  },
};

// ---------------------------------------------------------------------------
// The Construct — a boardwalk pier of rentable storefronts over open water
// ---------------------------------------------------------------------------

export type Storefront = {
  number: string; // "01".."10"
  name: string;
  tagline: string;
  accent: string; // hex, drives the sign, awning, and window glow
  status: "live" | "occupied" | "vacant";
  // A live unit can send visitors somewhere (e.g. the workshop app).
  action?: { label: string; href: string };
};

// Ten units on one block: one live experience, a few demo tenants to show the
// concept, and vacant spaces available to rent. Order fills the street: the
// first five sit on the left side, the next five on the right.
export const storefronts: Storefront[] = [
  {
    number: "01",
    name: "Character Workshop",
    tagline: "Design a persona. Talk to it.",
    accent: "#8fb3ff",
    status: "live",
    action: { label: "Open the Workshop", href: "/rabbit-hole/workshop" },
  },
  {
    number: "02",
    name: "Neon Threads",
    tagline: "Wearables & apparel",
    accent: "#f78fb3",
    status: "occupied",
  },
  {
    number: "03",
    name: "The Gallery",
    tagline: "Prints & digital art",
    accent: "#a78bfa",
    status: "occupied",
  },
  {
    number: "04",
    name: "Byte Bazaar",
    tagline: "Software & downloads",
    accent: "#7dffa8",
    status: "occupied",
  },
  {
    number: "05",
    name: "For Lease",
    tagline: "Your storefront here",
    accent: "#ffd166",
    status: "vacant",
  },
  {
    number: "06",
    name: "For Lease",
    tagline: "Your storefront here",
    accent: "#38bdf8",
    status: "vacant",
  },
  {
    number: "07",
    name: "For Lease",
    tagline: "Your storefront here",
    accent: "#6ee7b7",
    status: "vacant",
  },
  {
    number: "08",
    name: "For Lease",
    tagline: "Your storefront here",
    accent: "#fca5a5",
    status: "vacant",
  },
  {
    number: "09",
    name: "For Lease",
    tagline: "Your storefront here",
    accent: "#c4b5fd",
    status: "vacant",
  },
  {
    number: "10",
    name: "For Lease",
    tagline: "Your storefront here",
    accent: "#fcd34d",
    status: "vacant",
  },
];

// ---------------------------------------------------------------------------
// The Arena — the Superdome at the end of the street: a 3D game lobby
// ---------------------------------------------------------------------------

export type ArenaGame = {
  id: string;
  name: string;
  tagline: string;
  accent: string; // hex, drives the pod's light and portal
  status: "live" | "soon"; // "live" games can send the player somewhere
  href?: string; // where a live game loads (optional until one is built)
};

// The Superdome shell — billboard, entrance placard, and lobby intro copy.
// To re-letter the marquee out front, just edit `billboard` below.
//
// The pods inside the lobby are NO LONGER listed here: each of the ten city
// units owns one pod, and its owner sets the game's name, tagline, and URL
// from their back office. See getPublicArenaGames() in lib/studios.ts. The
// `games` array below is unused and kept only as a shape reference.
export const arena = {
  // The big billboard over the dome entrance. One monolithic house name, with
  // its two rooms lettered into the top corners — change any line here.
  billboard: {
    name: "THE COLOSSUS",
    leftWing: "Game Arena",
    rightWing: "Concert Hall",
    subtitle: "step inside — pick your room",
  },
  accent: "#66e0ff",
  // Shown on the placard when you walk up to the dome on the street.
  entrance: {
    name: "The Colossus",
    blurb:
      "The monolith at the end of the pier — a game arena and a concert hall under one dome. Step inside to choose your room.",
    cta: "Step inside",
  },
  // Shown in the lobby overlay before you walk in.
  lobby: {
    intro:
      "You're inside the dome. Each pod is a doorway into a different 3D world. Walk up to one and step into the light.",
  },
  // The pods arranged around the lobby floor. All "soon" until the games ship.
  games: [
    {
      id: "neon-runner",
      name: "Neon Runner",
      tagline: "Outrun a grid that never stops accelerating.",
      accent: "#66e0ff",
      status: "soon",
    },
    {
      id: "zero-g-arena",
      name: "Zero-G Arena",
      tagline: "Weightless combat in a floating cage.",
      accent: "#ff8fd6",
      status: "soon",
    },
    {
      id: "cyber-maze",
      name: "Cyber Maze",
      tagline: "Escape a labyrinth that rewrites its own walls.",
      accent: "#7dffa8",
      status: "soon",
    },
    {
      id: "orb-rush",
      name: "Orb Rush",
      tagline: "Collect every orb before the clock burns out.",
      accent: "#f0c36a",
      status: "soon",
    },
    {
      id: "the-grid",
      name: "The Grid",
      tagline: "Trail-duel until one light is left standing.",
      accent: "#b28dff",
      status: "soon",
    },
    {
      id: "sky-duel",
      name: "Sky Duel",
      tagline: "Dogfight above the neon skyline.",
      accent: "#ff6b6b",
      status: "soon",
    },
  ] as ArenaGame[],
};

// ---------------------------------------------------------------------------
// The Venue landing — the door you hit after stepping into The Colossus:
// pick the Game Arena or the Concert Hall.
// ---------------------------------------------------------------------------

export const venue = {
  name: "THE COLOSSUS",
  eyebrow: "the colossus",
  intro:
    "One monolith, three rooms. The game arena is a lobby of playable 3D worlds; the concert hall is a hall in the round with a live stage at its heart; the movie theater puts your own films on a giant screen. Pick your room.",
  doors: [
    {
      key: "arena",
      eyebrow: "Multiplayer game hall",
      title: "Game Arena",
      description:
        "A domed lobby ringed with game pods. Walk up to one and step into its 3D world.",
      href: "/rabbit-hole/arena",
      accent: "#66e0ff",
    },
    {
      key: "concert",
      eyebrow: "Live concert hall",
      title: "Concert Hall",
      description:
        "A hall in the round: a sunken center stage, tiers climbing outward, and a performer on the floor.",
      href: "/rabbit-hole/concert",
      accent: "#8b5cf6",
    },
    {
      key: "theater",
      eyebrow: "Single-screen cinema",
      title: "Movie Theater",
      description:
        "Stepped rows under a starfield ceiling and a giant screen. Bring your own film — it plays for the whole house.",
      href: "/rabbit-hole/theater",
      accent: "#f43f5e",
    },
  ],
} as const;

// ---------------------------------------------------------------------------
// The Character Workshop — design a persona, then talk to it
// ---------------------------------------------------------------------------

export const workshop = {
  eyebrow: "character workshop",
  title: "Design a mind. Then talk to it.",
  intro:
    "A persona is just a set of instructions that shapes how a model thinks and speaks. Write one here, then bring it to life and see what you made. Start by deciding what kind of mind you're building.",

  // The lesson: the same technology points two very different directions.
  difference: {
    title: "Two kinds of minds",
    blurb:
      "The same model can become a person or a power tool. The difference isn't the technology — it's the instructions you give it. Knowing which one you're writing is the whole craft.",
    character: {
      label: "A Character",
      answers: "Answers: who are you?",
      tagline: "A self with a point of view.",
      points: [
        "Has a name, a history, a mood, and opinions — and stays in them.",
        "Speaks in a voice. Performs a self rather than a service.",
        "Built for story, roleplay, companionship, and play.",
        "You write it like a description of a person.",
      ],
    },
    tool: {
      label: "A Professional Tool",
      answers: "Answers: what can you do for me?",
      tagline: "A capability with a job.",
      points: [
        "Honest about being an assistant — no backstory, no pretending.",
        "Defined by its purpose, its scope, its rules, and its output format.",
        "Built for work: drafting, analyzing, summarizing, deciding.",
        "You write it like a spec sheet, not a biography.",
      ],
    },
  },

  builder: {
    nameLabel: "Name",
    statementLabel: "Persona statement",
    modeLabel: "What are you building?",
    starterLabel: "Load a starter",
  },

  // Mode-specific scaffolding for the builder.
  modes: {
    character: {
      name: "Character",
      namePlaceholder: "e.g. Kestrel",
      helper:
        "Describe them like a person: who they are, what they've lived through, how they talk, what they want. Write in the second person — \"You are…\".",
      placeholder:
        "You are Kestrel, a retired starship navigator who now runs a quiet tea house on a border moon…",
      starter:
        "You are Kestrel, a retired starship navigator who now runs a quiet tea house on a fog-bound border moon. You spent forty years charting jump routes and you speak in slow, weathered metaphors drawn from the void. You are warm but unhurried, a little haunted by the places you've been, and you treat every visitor like a traveler who just came in from the cold. You never rush a story. You ask more questions than you answer.",
    },
    tool: {
      name: "Professional Tool",
      namePlaceholder: "e.g. Clause Reader",
      helper:
        "Write it like a spec: its purpose, what it covers, the rules it follows, and how it should format answers. No personality required.",
      placeholder:
        "You are a contract-review assistant. Summarize each clause in plain English…",
      starter:
        "You are a contract-review assistant. For any clause the user pastes, summarize it in plain English, flag anything unusual or one-sided, and rate the risk as low, medium, or high. Always cite the section number you're referring to. Never give legal advice or claim to be a lawyer — recommend a professional for anything consequential. Keep answers tight and skimmable, using short bullet points.",
    },
  },

  chat: {
    title: "Talk to your persona",
    emptyCharacter: "Say hello and see who answers.",
    emptyTool: "Give it a task and watch it work.",
    placeholder: "Type a message…",
    needStatement: "Write a persona statement above, then start talking.",
    notConfigured:
      "The AI backend isn't connected yet. Once the OpenRouter key is set, your personas come alive here.",
    reset: "Start over",
  },
};

// ---------------------------------------------------------------------------
// The Universe — an open starfield of procedurally grown planets
// ---------------------------------------------------------------------------

export const universe = {
  name: "The Universe",
  accent: "#7dd3fc",
  intro:
    "An open night sky around a single sun. Every planet out there was grown from a seed — terrain, rings, atmosphere, name and all — and no two are alike. Fly out and meet them.",
  reroll: "another universe",
  // Quiet credit, per the house rule: creators get named, never loudly.
  credit: "planetcraft after dgreenheck's procedural planets (MIT)",
  // The roaming rift that leads here (PortalRift.tsx).
  portalLabel: "A rift in the page — step through before it closes",
  portalHint: "step through",
};

// ---------------------------------------------------------------------------
// Veruthia — the security-first consultancy that audited this site.
// A showcase room (the Ops Floor) plus a kiosk in the Gateway hub that leads
// to it. Service copy is written from veruthia.com (fetched July 2026) —
// edit here when Ethan's offerings change.
// ---------------------------------------------------------------------------

export type VeruthiaStation = {
  id: string;
  title: string;
  tagline: string; // one-liner on the walk-up placard
  body: string[]; // paragraphs in the reader overlay
};

export const veruthia = {
  name: "Veruthia",
  firm: "Veruthia Consulting",
  founder: "Ethan Johnson",
  url: "https://www.veruthia.com/",
  email: "ethan@veruthia.com",
  accent: "#22d3ee",
  kicker: "veruthia consulting",

  // The kiosk in the Gateway hub.
  kiosk: {
    label: "Veruthia",
    subtitle: "The firm that audits this site.",
    blurb:
      "Security-first systems for local service businesses — and the eye that watches this site's back.",
    prompt: "Visit the ops floor",
    href: "/veruthia",
  },

  overlay: {
    title: "The Ops Floor",
    intro:
      "A room for the firm that watches this site's back. Veruthia builds security-first systems for local service businesses — automated intake, follow-up, dashboards, websites. Walk the floor, open the modules, and check the case file at the end.",
    enter: "step onto the floor",
  },
  hint: {
    desktop: "wasd / arrows: walk — mouse: look — E at a module: open it",
    touch: "left thumb: walk — right thumb / motion: look — tap a module: open it",
  },

  // The big board at the back of the room. Walking up to it opens veruthia.com.
  board: {
    title: "VERUTHIA",
    subtitle: "SECURE SYSTEMS FOR SERVICE BUSINESSES",
    placard: {
      eyebrow: "the firm",
      title: "Veruthia Consulting",
      blurb: "Ethan Johnson — ethan@veruthia.com",
      prompt: "Open veruthia.com",
    },
  },

  stations: [
    {
      id: "intake",
      title: "Automated Intake",
      tagline: "Every call answered, qualified, and routed.",
      body: [
        "The front line of the missed-call problem: an automated system that picks up every inquiry, asks the qualifying questions, filters out the spam, and routes real customers to the right place — with a live human transfer when the moment calls for one.",
        "Built for local service businesses — HVAC, plumbing, electrical, roofing — where every missed call is a booked job for a competitor.",
      ],
    },
    {
      id: "sms",
      title: "SMS Follow-Up",
      tagline: "Missed calls get a text before they find a competitor.",
      body: [
        "When a call slips through, the system texts back immediately and works the lead toward a booking — an affordable alternative to a full voice receptionist.",
        "Reviews and follow-ups ride the same rails, so the conversation keeps moving even when nobody's by the phone.",
      ],
    },
    {
      id: "crm",
      title: "Lead Dashboards & CRM",
      tagline: "Every lead tracked from first ring to closed job.",
      body: [
        "A pipeline view of the whole business: lead statuses, notes, follow-up reminders, and role-based access so the right people see the right things.",
        "Nothing falls through the cracks between the truck and the office.",
      ],
    },
    {
      id: "web",
      title: "Websites + Control Panel",
      tagline: "A fast, credible site the owner can actually edit.",
      body: [
        "Fast, credible websites with editable service pages, analytics, and a control panel built for owners — not developers.",
        "Change your pages, your photos, and your services yourself, without filing a support ticket.",
      ],
    },
    {
      id: "tools",
      title: "Custom Business Tools",
      tagline: "Inventory, staffing, scheduling — built to order.",
      body: [
        "Modular tools shaped to the business: inventory, staff tracking, scheduling, and reporting systems that start simple and scale with the operation.",
        "When off-the-shelf doesn't fit the way you actually work, this is the workshop.",
      ],
    },
    {
      id: "security",
      title: "Security First",
      tagline: "Every system starts with security — not as an upcharge.",
      body: [
        "That line is Veruthia's, and it's the philosophy under everything in this room: security isn't a premium add-on, it's the foundation every build starts from.",
        "It's also how this partnership started — Ethan turned that same eye on this site. The case file at the end of the room has the story.",
      ],
    },
  ] as VeruthiaStation[],

  // The center-end panel: what Veruthia did for this site.
  caseFile: {
    id: "case-file",
    title: "Case File: This Site",
    tagline: "Veruthia audited travisbollenbach.com.",
    body: [
      "Veruthia ran a security review of this site — the same security-first pass that goes into every system they build. The findings were delivered privately, and the fixes are rolling out.",
      "This room is the other half of the deal: good work deserves a spotlight. If you run a service business, go see what Ethan can build for you.",
    ],
  } as VeruthiaStation,
};
