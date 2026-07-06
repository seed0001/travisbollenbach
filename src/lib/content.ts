// Central content for the site. Edit here to update copy everywhere.

export const site = {
  name: "Travis Bollenbach",
  domain: "travisbollenbach.com",
  email: "travisbollenbach@gmail.com",
  tagline: "I build, design, and launch things worth paying attention to.",
  intro:
    "Part engineer, part creative, part founder. This is where all of it lives — the software I ship, the work I make, and the business I run.",
};

export const nav = [
  { label: "Work", href: "#work" },
  { label: "Creative", href: "#creative" },
  { label: "Services", href: "#services" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

// Rotating words in the hero headline
export const roles = ["software", "brands", "products", "ideas", "experiences"];

// Skills / tools marquee
export const marquee = [
  "TypeScript",
  "React",
  "Next.js",
  "Node",
  "Design Systems",
  "Branding",
  "Motion",
  "AI / LLMs",
  "Product Strategy",
  "UI / UX",
  "Cloud",
  "Storytelling",
];

export type Project = {
  title: string;
  category: string;
  year: string;
  description: string;
  tags: string[];
  href?: string;
};

export const projects: Project[] = [
  {
    title: "Flagship Web Platform",
    category: "Software",
    year: "2026",
    description:
      "A full-stack product built end to end — from architecture to pixel-perfect UI. Fast, accessible, and built to scale.",
    tags: ["Next.js", "TypeScript", "Cloud"],
  },
  {
    title: "Brand Identity System",
    category: "Creative",
    year: "2025",
    description:
      "A complete visual language: logo, type, color, and motion guidelines that make a brand instantly recognizable.",
    tags: ["Branding", "Design", "Motion"],
  },
  {
    title: "AI-Powered Tooling",
    category: "Software",
    year: "2025",
    description:
      "Applied LLMs to a real workflow, turning a slow manual process into something that feels like magic.",
    tags: ["AI / LLMs", "Product", "UX"],
  },
  {
    title: "Launch Campaign",
    category: "Business",
    year: "2024",
    description:
      "Strategy, site, and story for a product launch — positioning that converted attention into customers.",
    tags: ["Strategy", "Web", "Content"],
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

export const stats = [
  { value: "10+", label: "Years building" },
  { value: "50+", label: "Projects shipped" },
  { value: "3", label: "Disciplines, one focus" },
  { value: "∞", label: "Curiosity" },
];
