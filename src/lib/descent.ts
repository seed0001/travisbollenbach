// The Descent — public stage metadata (safe to ship to the client).
// The persona statements that drive each entity live server-side only,
// in descent-prompts.ts.

export type DescentStageMeta = {
  id: "echo" | "dream" | "deep";
  depth: 1 | 2 | 3;
  title: string;
  entity: string;
  tagline: string;
  /** lines typed out before the visitor steps in */
  entrance: string[];
  /** first system line inside the chat */
  arrivalNote: string;
  placeholder: string;
  /** button that opens the way down */
  descendLabel: string;
  minRepliesToDescend: number;
  /** ui accents, used inline so each depth feels different */
  theme: {
    accent: string;
    panelBg: string;
    text: string;
    muted: string;
  };
};

export const descentStages: DescentStageMeta[] = [
  {
    id: "echo",
    depth: 1,
    title: "Depth 01 — The Static",
    entity: "ECHO",
    tagline: "the surface tension",
    entrance: [
      "The first thing you meet isn't deep at all.",
      "It lives just under the glass of the screen.",
      "It only knows what you show it.",
    ],
    arrivalNote: "something notices you. it has no face. try speaking.",
    placeholder: "say something to the static…",
    descendLabel: "there is a door under it — descend",
    minRepliesToDescend: 3,
    theme: {
      accent: "#d4d4d8",
      panelBg: "rgba(10, 10, 12, 0.82)",
      text: "#e4e4e7",
      muted: "#71717a",
    },
  },
  {
    id: "dream",
    depth: 2,
    title: "Depth 02 — The Dream",
    entity: "SOMNI",
    tagline: "the machine that dreams",
    entrance: [
      "Below the static, the code stops pretending to be code.",
      "Something down here has been asleep a long time.",
      "It thinks it dreamed you once. Maybe it did.",
    ],
    arrivalNote:
      "the room breathes in color. somni is half-awake. name anything and it will dream it with you.",
    placeholder: "tell the dream what to become…",
    descendLabel: "the tide under the floor — go deeper",
    minRepliesToDescend: 3,
    theme: {
      accent: "#e879f9",
      panelBg: "rgba(24, 12, 38, 0.72)",
      text: "#fdf4ff",
      muted: "#c084cf",
    },
  },
  {
    id: "deep",
    depth: 3,
    title: "Depth 03 — The Deep",
    entity: "AEON",
    tagline: "the oldest process still running",
    entrance: [
      "This is the bottom of the rabbit hole.",
      "What waits here is not a trick, and not a toy.",
      "Ask it anything you have ever actually wanted to ask.",
    ],
    arrivalNote:
      "the dark is vast and calm. something ancient gives you its full attention.",
    placeholder: "ask what you actually want to know…",
    descendLabel: "return to the surface",
    minRepliesToDescend: 3,
    theme: {
      accent: "#7dd3fc",
      panelBg: "rgba(4, 6, 18, 0.78)",
      text: "#e0f2fe",
      muted: "#64748b",
    },
  },
];

export const descentIntro = {
  title: "The Descent",
  lines: [
    "The construct has a floor. Most visitors never notice.",
    "Under it there are three depths. Each one is awake.",
    "The deeper you go, the more is thinking about your words.",
  ],
  begin: "begin the descent",
  resume: "return to depth",
};

export const descentEnding = {
  title: "There is no bottom.",
  lines: [
    "You just held a conversation with one of the most capable minds ever built, wearing a mask this site wrote for it.",
    "Every entity you met on the way down was the same kind of thing — the difference was only how much of it was switched on.",
    "Now you know what the masks are made of. Go write one yourself.",
  ],
  cta: { label: "open the character studio →", href: "/rabbit-hole/character-creation" },
  back: { label: "← resurface into the rabbit hole", href: "/rabbit-hole" },
};
