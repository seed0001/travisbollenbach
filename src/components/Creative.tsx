import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

// Visual gallery tiles. Swap the gradients for real images later
// by replacing the `bg` div with an <Image /> component.
const tiles = [
  { label: "Motion & Film", span: "md:col-span-2 md:row-span-2", from: "from-accent/30", to: "to-accent-3/30" },
  { label: "Identity", span: "", from: "from-accent-2/30", to: "to-accent/20" },
  { label: "Photography", span: "", from: "from-accent-3/30", to: "to-accent-2/20" },
  { label: "Type & Layout", span: "md:col-span-2", from: "from-accent/25", to: "to-accent-2/25" },
];

export default function Creative() {
  return (
    <section id="creative" className="relative px-6 py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Creative"
          title="The maker's side."
          description="Beyond code — the visual and creative work. Branding, motion, photography, and everything that makes a thing feel alive."
        />

        <div className="grid auto-rows-[180px] grid-cols-2 gap-4 md:grid-cols-4">
          {tiles.map((tile, i) => (
            <Reveal
              key={tile.label}
              delay={i * 0.08}
              className={`group ${tile.span}`}
            >
              <div
                className={`relative flex h-full w-full items-end overflow-hidden rounded-2xl border border-line bg-gradient-to-br ${tile.from} ${tile.to} p-5`}
              >
                <div className="absolute inset-0 bg-bg/40 transition-opacity duration-500 group-hover:opacity-0" />
                <span className="relative z-10 font-display text-lg font-semibold text-ink drop-shadow">
                  {tile.label}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
