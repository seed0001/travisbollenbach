import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getUserBySession, SESSION_COOKIE } from "@/lib/auth";
import { dayKey, readAnalytics, type DayStats } from "@/lib/analytics";
import { getStorageInfo } from "@/lib/storage";
import AdminSettings from "@/components/AdminSettings";

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
      <main className="ops flex min-h-svh items-center justify-center bg-ops-bg px-6 text-ops-ink">
        <div className="w-full max-w-sm rounded-xl border border-ops-line bg-ops-card p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-ops-red">
            403 — restricted
          </p>
          <h1 className="mt-3 text-xl font-semibold">
            This console requires operator access.
          </h1>
          <Link
            href="/account"
            className="mt-8 inline-block rounded-lg bg-ops-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:brightness-110"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const storage = await getStorageInfo();
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

  const storageHealthy = storage.source !== "fallback" && storage.writable;

  return (
    <main className="ops min-h-svh bg-ops-bg text-ops-ink">
      <div className="mx-auto max-w-5xl px-6 pb-24">
        {/* header */}
        <header className="flex items-center justify-between border-b border-ops-line py-5">
          <div>
            <h1 className="text-lg font-semibold">Operator Console</h1>
            <p className="text-xs text-ops-muted">travisbollenbach.com</p>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/"
              className="font-medium text-ops-muted transition-colors hover:text-ops-ink"
            >
              View site
            </Link>
            <Link
              href="/account"
              className="rounded-lg border border-ops-line bg-ops-card px-4 py-2 font-medium shadow-sm transition-colors hover:border-ops-accent hover:text-ops-accent"
            >
              {user.name}
            </Link>
          </nav>
        </header>

        {/* storage status */}
        <section
          className={`mt-6 rounded-xl border p-5 shadow-sm ${
            storageHealthy
              ? "border-ops-line bg-ops-card"
              : "border-ops-red/40 bg-ops-red-soft"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  storageHealthy ? "bg-ops-green" : "bg-ops-red"
                }`}
              />
              <p className="text-sm font-semibold">
                {!storage.writable
                  ? "Storage not writable"
                  : storage.source === "fallback"
                    ? "Storage is ephemeral — data lost on deploy"
                    : "Storage volume-backed"}
              </p>
            </div>
            <p className="text-xs text-ops-muted">
              {storage.users} account{storage.users === 1 ? "" : "s"} ·{" "}
              {storage.comments} comment{storage.comments === 1 ? "" : "s"} ·
              settings {storage.settingsPresent ? "saved" : "not saved yet"}
            </p>
          </div>
          <p className="mt-2 break-all text-xs text-ops-muted">
            writing to <span className="font-medium">{storage.dir}</span> (
            {storage.source === "fallback"
              ? "no DATA_DIR or COMMENTS_DIR set — container filesystem"
              : `from ${storage.source}`}
            )
          </p>
          {storage.source === "fallback" && (
            <p className="mt-3 text-sm leading-relaxed text-ops-red">
              Accounts, sessions, comments, and integration keys will be wiped
              on every deploy. On Railway: add a Volume (mount path{" "}
              <span className="font-semibold">/data</span>), set{" "}
              <span className="font-semibold">DATA_DIR=/data</span>, redeploy.
            </p>
          )}
        </section>

        {/* analytics */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ops-muted">
            Analytics
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-ops-line bg-ops-card p-6 shadow-sm">
              <p className="text-[13px] font-medium text-ops-muted">
                Page views · last {TOP_WINDOW} days
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {weekViews.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-ops-line bg-ops-card p-6 shadow-sm">
              <p className="text-[13px] font-medium text-ops-muted">
                Unique visitors · last {TOP_WINDOW} days
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {weekUniques.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-ops-line bg-ops-card p-6 shadow-sm">
            <p className="text-[13px] font-medium text-ops-muted">
              Daily views · last {DAYS_SHOWN} days
            </p>
            <div className="mt-5 space-y-2">
              {dailyTotals.map(({ day, views, uniques }) => (
                <div key={day} className="flex items-center gap-3 text-xs">
                  <span className="w-16 shrink-0 tabular-nums text-ops-muted">
                    {day.slice(5)}
                  </span>
                  <div className="h-3.5 flex-1 overflow-hidden rounded bg-ops-bg">
                    <div
                      className="h-full rounded bg-ops-accent/80"
                      style={{ width: `${(views / maxViews) * 100}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right tabular-nums text-ops-muted">
                    {views} · {uniques}u
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(
              [
                ["Top pages", topPages, "No traffic recorded yet"],
                ["Top referrers", topReferrers, "No external referrers yet"],
              ] as const
            ).map(([title, entries, empty]) => (
              <div
                key={title}
                className="rounded-xl border border-ops-line bg-ops-card p-6 shadow-sm"
              >
                <p className="text-[13px] font-medium text-ops-muted">
                  {title} · last {TOP_WINDOW} days
                </p>
                <div className="mt-4 space-y-2.5 text-sm">
                  {entries.length === 0 && (
                    <p className="text-ops-muted">{empty}</p>
                  )}
                  {entries.map(([name, count]) => (
                    <div
                      key={name}
                      className="flex justify-between gap-4 border-b border-ops-line/60 pb-2 last:border-b-0 last:pb-0"
                    >
                      <span className="truncate">{name}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* integrations */}
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ops-muted">
            Integrations
          </h2>
          <div className="mt-3">
            <AdminSettings />
          </div>
        </section>
      </div>
    </main>
  );
}
