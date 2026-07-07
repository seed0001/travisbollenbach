import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CreatorFeedback from "@/components/CreatorFeedback";
import { creditedCreators } from "@/lib/content";

export function generateStaticParams() {
  return creditedCreators.map((creator) => ({ creator: creator.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ creator: string }>;
}): Promise<Metadata> {
  const { creator: id } = await params;
  const creator = creditedCreators.find((c) => c.id === id);
  if (!creator) return { title: "Credits — Travis Bollenbach" };
  return {
    title: `${creator.name} — Credits — Travis Bollenbach`,
    description: `${creator.name}: ${creator.tagline}. Their open-source work lives inside this world.`,
  };
}

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ creator: string }>;
}) {
  const { creator: id } = await params;
  const creator = creditedCreators.find((c) => c.id === id);
  if (!creator) notFound();

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-6 py-16 text-white md:py-24">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/credits"
          className="text-sm text-white/40 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          ← all credits
        </Link>

        <header className="mt-8 flex items-center gap-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote GitHub avatar, no optimizer config needed */}
          <img
            src={creator.avatarUrl}
            alt={creator.name}
            width={96}
            height={96}
            className="h-24 w-24 rounded-full border border-white/15 object-cover"
          />
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              {creator.name}
            </h1>
            <p className="mt-1 text-white/50">{creator.tagline}</p>
            <a
              href={creator.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              {creator.githubUrl.replace("https://", "")} ↗
            </a>
          </div>
        </header>

        <p className="mt-8 max-w-2xl leading-relaxed text-white/60">
          {creator.bio}
        </p>

        <h2 className="mt-12 text-lg font-semibold text-white/90">
          In this world
        </h2>
        <div className="mt-4 space-y-4">
          {creator.works.map((work) => (
            <div
              key={work.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="font-semibold text-white/90">{work.project}</p>
                <span className="text-xs uppercase tracking-widest text-white/30">
                  {work.license}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Powers {work.inWorld} in the open world.
              </p>
              <a
                href={work.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                {work.repoUrl.replace("https://", "")} ↗
              </a>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <CreatorFeedback
            topic={`creator-${creator.id}`}
            creatorName={creator.name.split(" ")[0]}
          />
        </div>
      </div>
    </main>
  );
}
