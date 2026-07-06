import { marquee } from "@/lib/content";

export default function Marquee() {
  const items = [...marquee, ...marquee];

  return (
    <div className="relative overflow-hidden border-y border-line bg-bg-soft/50 py-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-bg to-transparent" />
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
        {items.map((word, i) => (
          <span
            key={`${word}-${i}`}
            className="flex items-center gap-10 text-lg font-medium text-ink-dim"
          >
            {word}
            <span className="text-accent">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
