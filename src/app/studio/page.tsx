import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import { getStudiosByOwner } from "@/lib/studios";
import StudioBackOffice, {
  type EditableStudio,
} from "@/components/StudioBackOffice";

export const metadata: Metadata = {
  title: "Back Office — Travis Bollenbach",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? "";
  const user = await getUserBySession(token);

  const shell = (body: React.ReactNode) => (
    <main className="scanlines relative min-h-svh text-ink">
      <div className="relative z-10 mx-auto max-w-3xl px-6 pb-28">
        <header className="flex items-center justify-between py-6">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-ink transition-colors hover:text-matrix"
          >
            Travis<span className="text-matrix">.</span>Bollenbach
          </Link>
          <Link
            href="/rabbit-hole/game"
            className="text-xs uppercase tracking-[0.25em] text-ink-dim transition-colors hover:text-matrix"
          >
            visit the city →
          </Link>
        </header>
        {body}
      </div>
    </main>
  );

  if (!user) {
    return shell(
      <section className="pt-20 text-center">
        <p className="glow-green mb-4 text-xs uppercase tracking-[0.35em] text-matrix">
          back office
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Sign in to manage your storefront.
        </h1>
        <Link
          href="/account"
          className="mt-10 inline-block rounded-xl border border-matrix px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
        >
          identify yourself →
        </Link>
      </section>,
    );
  }

  const owned = await getStudiosByOwner(user.id);
  const studios: EditableStudio[] = owned.map((s) => ({
    unit: s.unit,
    studioName: s.studioName,
    walls: s.walls,
    links: s.links,
    vrmSrc: s.vrmSrc ?? "",
  }));

  if (studios.length === 0) {
    return shell(
      <section className="pt-20 text-center">
        <p className="glow-green mb-4 text-xs uppercase tracking-[0.35em] text-matrix">
          back office
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          No storefront yet.
        </h1>
        <p className="mx-auto mt-5 max-w-md leading-relaxed text-ink-soft">
          You don&apos;t own a unit in the city yet. Once the operator assigns
          you one, you&apos;ll dress its walls and manage it from here.
        </p>
      </section>,
    );
  }

  return shell(
    <>
      <section className="pb-8 pt-12 md:pt-16">
        <p className="glow-green mb-4 text-xs uppercase tracking-[0.35em] text-matrix">
          back office
        </p>
        <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
          Your storefront
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-ink-soft">
          Dress the walls, add your links, and name the place. Anyone who walks
          into your unit in the city sees exactly what you set here.
        </p>
      </section>
      <StudioBackOffice initial={studios} />
    </>,
  );
}
