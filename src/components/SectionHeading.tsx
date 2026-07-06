import Reveal from "./Reveal";

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
};

export default function SectionHeading({ eyebrow, title, description }: Props) {
  return (
    <Reveal className="mb-14 max-w-2xl">
      <p className="mb-3 flex items-center gap-3 font-mono text-sm uppercase tracking-[0.2em] text-accent">
        <span className="h-px w-8 bg-accent" />
        {eyebrow}
      </p>
      <h2 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
        {title}
      </h2>
      {description && (
        <p className="mt-5 text-lg text-ink-soft">{description}</p>
      )}
    </Reveal>
  );
}
