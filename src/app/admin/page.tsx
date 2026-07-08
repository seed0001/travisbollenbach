import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  getUserBySession,
  listUsers,
  ownerEmail,
  SESSION_COOKIE,
} from "@/lib/auth";
import { dayKey, readAnalytics, type DayStats } from "@/lib/analytics";
import { listStudios } from "@/lib/studios";
import AdminConsole, { type Traffic } from "@/components/AdminConsole";

export const metadata: Metadata = {
  title: "Operator Console — Travis Bollenbach",
  robots: { index: false },
};

// session + live stats on every request — never cache this page
export const dynamic = "force-dynamic";

const DAYS_SHOWN = 14;
const TOP_WINDOW = 7;

function lastDays(count: number): string[] {
  const days: string[] = [];
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    days.push(dayKey(new Date(now - i * 24 * 60 * 60 * 1000)));
  }
  return days;
}

function dayTotal(stats: DayStats | undefined): number {
  return stats
    ? Object.values(stats.views).reduce((sum, n) => sum + n, 0)
    : 0;
}

function topEntries(
  data: Record<string, DayStats>,
  days: string[],
  key: "views" | "referrers",
  limit: number,
): [string, number][] {
  const totals: Record<string, number> = {};
  for (const day of days) {
    const bucket = data[day]?.[key];
    if (!bucket) continue;
    for (const [name, count] of Object.entries(bucket)) {
      totals[name] = (totals[name] ?? 0) + count;
    }
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export default async function AdminPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value ?? "";
  const user = await getUserBySession(token);

  if (!user || user.role !== "admin") {
    return (
      <main className="scanlines relative flex min-h-svh items-center justify-center px-6 text-ink">
        <div className="max-w-md text-center">
          <p className="glow-red text-xs uppercase tracking-[0.35em] text-pill-red">
            access denied
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            This console is not for you.
          </h1>
          <Link
            href="/account"
            className="mt-10 inline-block rounded-xl border border-matrix px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-matrix transition-colors hover:bg-matrix hover:text-black"
          >
            identify yourself →
          </Link>
        </div>
      </main>
    );
  }

  const [data, members, allStudios] = await Promise.all([
    readAnalytics(),
    listUsers(),
    listStudios(),
  ]);
  const studios = allStudios.map((s) => ({
    unit: s.unit,
    studioName: s.studioName,
    ownerEmail: s.ownerEmail,
  }));
  const days = lastDays(DAYS_SHOWN);
  const recentDays = days.slice(-TOP_WINDOW);
  const daily = days.map((day) => ({
    day,
    views: dayTotal(data[day]),
    uniques: data[day]?.uniques.length ?? 0,
  }));

  const traffic: Traffic = {
    weekViews: daily.slice(-TOP_WINDOW).reduce((sum, d) => sum + d.views, 0),
    weekUniques: daily.slice(-TOP_WINDOW).reduce((sum, d) => sum + d.uniques, 0),
    daily,
    topPages: topEntries(data, recentDays, "views", 10),
    topReferrers: topEntries(data, recentDays, "referrers", 10),
  };

  return (
    <main className="scanlines relative min-h-svh text-ink">
      <div className="relative z-10 mx-auto max-w-5xl px-6 pb-28">
        <header className="flex items-center justify-between py-6">
          <Link
            href="/"
            className="text-sm font-bold tracking-tight text-ink transition-colors hover:text-matrix"
          >
            Travis<span className="text-matrix">.</span>Bollenbach
          </Link>
          <Link
            href="/account"
            className="text-xs uppercase tracking-[0.25em] text-ink-dim transition-colors hover:text-matrix"
          >
            {user.name} →
          </Link>
        </header>

        <section className="pb-10 pt-12 md:pt-16">
          <p className="glow-green mb-4 text-xs uppercase tracking-[0.35em] text-matrix">
            operator console
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Manage the
            <span className="glow-green block text-matrix">whole ship.</span>
          </h1>
        </section>

        <AdminConsole
          ownerEmail={ownerEmail()}
          members={members}
          studios={studios}
          traffic={traffic}
        />
      </div>
    </main>
  );
}
