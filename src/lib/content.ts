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
    hint: "A clean portfolio: software, services, projects, and the professional version of the work.",
    href: "/storefront",
  },
  red: {
    label: "Red Pill",
    hint: "An immersive 3D environment: the experimental world behind the work.",
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
// The Construct — a virtual city block of rentable storefronts
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
