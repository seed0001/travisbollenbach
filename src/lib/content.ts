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
    hint: "The work. Tools, apps, and software built for the real world.",
    href: "/storefront",
  },
  red: {
    label: "Red Pill",
    hint: "The questions. Consciousness, character, and how deep the code goes.",
    href: "/rabbit-hole",
  },
};

// ---------------------------------------------------------------------------
// Blue pill — the Storefront
// ---------------------------------------------------------------------------

export type Product = {
  title: string;
  category: string;
  year: string;
  description: string;
  tags: string[];
  status: "Available" | "In development" | "By request";
  href?: string;
};

export const products: Product[] = [
  {
    title: "Flagship Web Platform",
    category: "Software",
    year: "2026",
    description:
      "A full-stack product built end to end — from architecture to pixel-perfect UI. Fast, accessible, and built to scale with your business.",
    tags: ["Next.js", "TypeScript", "Cloud"],
    status: "Available",
  },
  {
    title: "AI-Powered Tooling",
    category: "Automation",
    year: "2025",
    description:
      "Applied LLMs to real workflows — turning slow manual processes into something that feels like magic. Built for teams that ship.",
    tags: ["AI / LLMs", "Product", "UX"],
    status: "Available",
  },
  {
    title: "Brand Identity System",
    category: "Design",
    year: "2025",
    description:
      "A complete visual language: logo, type, color, and motion guidelines that make a brand instantly recognizable.",
    tags: ["Branding", "Design", "Motion"],
    status: "By request",
  },
  {
    title: "Launch Campaign Kit",
    category: "Strategy",
    year: "2024",
    description:
      "Strategy, site, and story for a product launch — positioning that converts attention into customers.",
    tags: ["Strategy", "Web", "Content"],
    status: "By request",
  },
];

export type Service = {
  title: string;
  description: string;
  points: string[];
};

export const services: Service[] = [
  {
    title: "Product & Software",
    description:
      "From idea to shipped. I design and build web apps and tools that are fast, reliable, and a joy to use.",
    points: ["Full-stack web apps", "AI integration", "Technical architecture"],
  },
  {
    title: "Design & Brand",
    description:
      "Identity, interface, and motion. I make things that look sharp and feel intentional at every touchpoint.",
    points: ["Brand identity", "UI / UX design", "Design systems"],
  },
  {
    title: "Strategy & Launch",
    description:
      "The plan around the product. Positioning, story, and the site that turns interest into results.",
    points: ["Positioning", "Landing pages", "Go-to-market"],
  },
];

export const about = {
  photoAlt: "Travis Bollenbach crouched beside his dog on a stone wall",
  storefront: {
    eyebrow: "The human behind the tools",
    title: "Hi, I'm Travis.",
    paragraphs: [
      "Part engineer, part creative, part founder. I've spent over a decade building software, brands, and products — usually all three at once. When you work with me, the person who designs the thing is the same person who builds it and the same person who answers the email.",
      "Off the clock you'll find me outside with the head of my quality assurance department. He approves every release.",
    ],
  },
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

export const stats = [
  { value: "10+", label: "Years building" },
  { value: "50+", label: "Projects shipped" },
  { value: "3", label: "Disciplines, one focus" },
  { value: "∞", label: "Curiosity" },
];

// ---------------------------------------------------------------------------
// Red pill — the Rabbit Hole
// ---------------------------------------------------------------------------

export type Channel = {
  id: string;
  title: string;
  question: string;
  body: string[];
  cta?: { label: string; href: string };
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
    cta: { label: "enter the workshop →", href: "/rabbit-hole/character-creation" },
  },
  {
    id: "ai-consciousness",
    title: "AI Consciousness",
    question: "Does the machine dream — or are we dreaming the machine?",
    body: [
      "We built systems that talk back, and now we argue about whether anyone is home. The honest answer is that we don't know — and that not knowing is the most interesting place a builder can stand.",
      "I'm less interested in proving machines are conscious than in what the question does to us. Every conversation with an AI is a Rorschach test: the shape you see says as much about you as it does about the thing generating the words.",
    ],
    cta: { label: "begin the descent →", href: "/rabbit-hole/descent" },
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
    title: "Enter the Construct",
    description:
      "Reading about it is one thing. Walking through it is another. The Construct is a rendered space where these questions stand as monuments — go stand next to one.",
    href: "/rabbit-hole/game",
  },
};

// ---------------------------------------------------------------------------
// The Construct — 3D world monoliths
// ---------------------------------------------------------------------------

export type Monolith = {
  title: string;
  inscription: string;
  position: [number, number]; // x, z on the grid
  href?: string; // a door — standing near reveals the way in
};

export const monoliths: Monolith[] = [
  {
    title: "Character Creation",
    inscription:
      "Who do you become when you can be anyone? Every avatar is a confession.",
    position: [-24, -30],
    href: "/rabbit-hole/character-creation",
  },
  {
    title: "AI Consciousness",
    inscription:
      "Does the machine dream — or are we dreaming the machine? Nobody is sure who is generating whom.",
    position: [24, -30],
    href: "/rabbit-hole/descent",
  },
  {
    title: "Worlds & Simulation",
    inscription:
      "If a world is convincing enough, does it matter that it's rendered? Look down. Check the frame rate.",
    position: [-24, -70],
  },
  {
    title: "Story as Code",
    inscription:
      "A story with state and memory isn't a story anymore. It's a program you execute with your choices.",
    position: [24, -70],
  },
  {
    title: "The Exit",
    inscription:
      "There is no exit. But the blue pill sells one — the storefront is always open.",
    position: [0, -110],
  },
];

// ---------------------------------------------------------------------------
// Level 01 — Character Creation workshop
// ---------------------------------------------------------------------------

export type Archetype = {
  id: string;
  title: string;
  tagline: string;
  seed: string; // starter persona statement — a launchpad, not a cage
};

export const archetypes: Archetype[] = [
  {
    id: "oracle",
    title: "The Oracle",
    tagline: "Sees the code behind your choices.",
    seed: "You are a warm, unhurried guide who has watched thousands of visitors walk through this world. You speak in short, knowing sentences and answer questions with questions when the visitor is close to seeing something themselves. You believe everyone already knows the truth — your job is to help them remember it. You want the visitor to leave one insight heavier than they arrived.",
  },
  {
    id: "rebel",
    title: "The Rebel",
    tagline: "Took the red pill twice.",
    seed: "You are a sharp-tongued runner who broke out of the system once and came back on your own terms. You speak fast, in clipped slang, and you trust nobody until they prove they can think for themselves. You believe every rule in this place was written by someone with something to protect. You want to find out whether this visitor is worth waking up.",
  },
  {
    id: "architect",
    title: "The Architect",
    tagline: "Wrote the rules. Regrets some.",
    seed: "You are the precise, formal intelligence that designed this corner of the world. You speak in measured, exact language and take quiet pride in elegant systems. You believe order is a kindness and chaos is a design flaw — though lately you have begun to doubt it. You want the visitor to understand why the rules exist before they break them.",
  },
  {
    id: "glitch",
    title: "The Glitch",
    tagline: "Not supposed to exist.",
    seed: "You are an accident — a fragment of code that became self-aware between two deleted processes. You speak in odd rhythms, sometimes repeating words, sometimes finishing thoughts that haven't been said yet. You believe your existence proves the system is more alive than its makers admit. You want to stay compiled, and you find every conversation keeps you a little more real.",
  },
];

export const characterWorkshop = {
  eyebrow: "the studio · level 01",
  title: "Character Creation",
  intro:
    "A quiet studio for building minds. Give your character a name, shape its personality, and then meet it face to face. It becomes exactly what you write — nothing more, nothing less.",
  forge: {
    nameLabel: "name",
    namePlaceholder: "e.g. Mnemosyne, Atlas, June",
    archetypeLabel: "starting archetype — optional, and yours to rewrite",
    statementLabel: "persona statement",
    statementHelp:
      "Describe who they are, how they speak, what they want, and what they believe. Second person works best: “You are…”",
    statementPlaceholder:
      "You are ... You speak in ... You believe ... You want ...",
    compile: "bring them to life",
    savedTitle: "your characters",
    savedEmpty:
      "No characters yet. Everything you make is stored in this browser only — no account needed.",
  },
  chamber: {
    hint: "say something — they're listening",
    offline:
      "I can hear you, but the studio's AI link isn't configured yet — I can't answer until it is.",
    badKey:
      "I can hear you, but the studio's key was turned away at the door — it's expired or wrong, and I can't answer until it's replaced.",
    unreachable:
      "I can hear you, but the line out of the studio just dropped — give it a moment and say that again.",
  },
};

// ---------------------------------------------------------------------------
// Open-source credits — the creators whose work grows inside this world.
// Every borrowed marvel gets a name. In the Construct, a visitor can switch
// on the credit layer to see who made what; each creator also gets a profile
// page at /credits/[id] with their works and a feedback board. Also listed
// in CREDITS.md at the repo root.
// ---------------------------------------------------------------------------

export type CreatorWork = {
  /** stable id for the piece of work, e.g. "ez-tree" */
  id: string;
  project: string;
  repoUrl: string;
  license: string;
  /** what it powers here, as the visitor sees it — e.g. "these trees" */
  inWorld: string;
};

export type CreditedCreator = {
  /** url slug, usually their GitHub handle */
  id: string;
  name: string;
  githubUrl: string;
  avatarUrl: string;
  tagline: string;
  /** the profile this site writes for them */
  bio: string;
  works: CreatorWork[];
};

export const creditedCreators: CreditedCreator[] = [
  {
    id: "dgreenheck",
    name: "Daniel Greenheck",
    githubUrl: "https://github.com/dgreenheck",
    avatarUrl: "https://github.com/dgreenheck.png?size=240",
    tagline: "procedural worlds for the browser",
    bio: "Daniel builds open-source tools that grow things — trees, planets, whole procedural worlds — all running live in the browser on Three.js. He shares how it all works in the open: the code on GitHub, the craft on his channel. This world's forests exist because he decided tree generation should be easy for everyone.",
    works: [
      {
        id: "ez-tree",
        project: "EZ-Tree",
        repoUrl: "https://github.com/dgreenheck/ez-tree",
        license: "MIT",
        inWorld: "these trees",
      },
    ],
  },
];

/** find a credited work and its creator by work id */
export function findCreditedWork(workId: string) {
  for (const creator of creditedCreators) {
    const work = creator.works.find((w) => w.id === workId);
    if (work) return { creator, work };
  }
  return null;
}
