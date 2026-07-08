import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import { dayKey, readAnalytics, type DayStats } from "@/lib/analytics";

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

  const data = await readAnalytics();
  const days = lastDays(DAYS_SHOWN);
  const recentDays = days.slice(-TOP_WINDOW);
  const dailyTotals = days.map((day) => ({
    day,
    views: dayTotal(data[day]),
    uniques: data[day]?.uniques.length ?? 0,
  }));
  const maxViews = Math.max(1, ...dailyTotals.map((d) => d.views));
  const weekViews = dailyTotals
    .slice(-TOP_WINDOW)
    .reduce((sum, d) => sum + d.views, 0);
  const weekUniques = dailyTotals
    .slice(-TOP_WINDOW)
    .reduce((sum, d) => sum + d.uniques, 0);
  const topPages = topEntries(data, recentDays, "views", 10);
  const topReferrers = topEntries(data, recentDays, "referrers", 10);

  return (
    <main className="scanlines relative min-h-svh text-ink">
      <div className="relative z-10 mx-auto max-w-4xl px-6 pb-28">
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

        <section className="pb-12 pt-12 md:pt-20">
          <p className="glow-green mb-4 text-xs uppercase tracking-[0.35em] text-matrix">
            operator console
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Watching the
            <span className="glow-green block text-matrix">watchers.</span>
          </h1>
        </section>

        {/* Topline numbers */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-line bg-surface/70 p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
              page views · last {TOP_WINDOW} days
            </p>
            <p className="glow-green mt-3 text-4xl font-bold text-matrix">
              {weekViews}
            </p>
          </div>
          <div className="rounded-3xl border border-line bg-surface/70 p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
              unique visitors · last {TOP_WINDOW} days
            </p>
            <p className="glow-green mt-3 text-4xl font-bold text-matrix">
              {weekUniques}
            </p>
          </div>
        </section>

        {/* Daily bars */}
        <section className="mt-4 rounded-3xl border border-line bg-surface/70 p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
            daily views · last {DAYS_SHOWN} days
          </p>
          <div className="mt-6 space-y-2">
            {dailyTotals.map(({ day, views, uniques }) => (
              <div key={day} className="flex items-center gap-3 text-xs">
                <span className="w-20 shrink-0 text-ink-dim">
                  {day.slice(5)}
                </span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-black/50">
                  <div
                    className="h-full bg-matrix/70"
                    style={{ width: `${(views / maxViews) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-ink-soft">
                  {views} · {uniques}u
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Top pages / referrers */}
        <section className="mt-4 grid gap-4 md:grid-cols-2">
          {(
            [
              ["top pages", topPages, "no traffic recorded yet"],
              ["top referrers", topReferrers, "no external referrers yet"],
            ] as const
          ).map(([title, entries, empty]) => (
            <div
              key={title}
              className="rounded-3xl border border-line bg-surface/70 p-8"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
                {title} · last {TOP_WINDOW} days
              </p>
              <div className="mt-5 space-y-3 text-sm">
                {entries.length === 0 && (
                  <p className="text-ink-dim">{empty}</p>
                )}
                {entries.map(([name, count]) => (
                  <div key={name} className="flex justify-between gap-4">
                    <span className="truncate text-ink-soft">{name}</span>
                    <span className="shrink-0 font-bold text-matrix">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
