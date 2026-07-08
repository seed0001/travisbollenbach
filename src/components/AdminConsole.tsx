"use client";

import { useEffect, useMemo, useState } from "react";

export type Member = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  createdAt: string;
};

export type Traffic = {
  weekViews: number;
  weekUniques: number;
  daily: { day: string; views: number; uniques: number }[];
  topPages: [string, number][];
  topReferrers: [string, number][];
};

export type AdminStudio = {
  unit: string;
  studioName: string;
  ownerEmail: string | null;
};

type Tab = "overview" | "members" | "storefronts" | "traffic";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "overview" },
  { id: "members", label: "members" },
  { id: "storefronts", label: "storefronts" },
  { id: "traffic", label: "traffic" },
];

const fmt = new Intl.NumberFormat("en-US");

function joined(iso: string): string {
  // Stable, locale-free date so server and client agree.
  return iso.slice(0, 10);
}

export default function AdminConsole({
  ownerEmail,
  members: initialMembers,
  studios: initialStudios,
  traffic,
}: {
  ownerEmail: string | null;
  members: Member[];
  studios: AdminStudio[];
  traffic: Traffic;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [studios, setStudios] = useState<AdminStudio[]>(initialStudios);
  const [assignEmail, setAssignEmail] = useState<Record<string, string>>({});
  const [unitPending, setUnitPending] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setOnline(d.onlineNow ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const adminCount = members.filter((m) => m.role === "admin").length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [members, query]);

  const isOwner = (m: Member) =>
    ownerEmail !== null && m.email === ownerEmail;

  const changeRole = async (m: Member, role: "admin" | "user") => {
    setPendingId(m.id);
    setError("");
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: m.id, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Update failed.");
      setMembers((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, role: data.member.role } : x)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setPendingId(null);
    }
  };

  const removeMember = async (m: Member) => {
    setPendingId(m.id);
    setError("");
    try {
      const res = await fetch("/api/admin/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: m.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Remove failed.");
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
    } finally {
      setPendingId(null);
      setConfirmId(null);
    }
  };

  const assignUnit = async (unit: string) => {
    const email = (assignEmail[unit] ?? "").trim();
    if (!email) return;
    setUnitPending(unit);
    setError("");
    try {
      const res = await fetch("/api/admin/studios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Assign failed.");
      setStudios((prev) =>
        prev.map((s) =>
          s.unit === unit
            ? { ...s, ownerEmail: data.studio.ownerEmail }
            : s,
        ),
      );
      setAssignEmail((prev) => ({ ...prev, [unit]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed.");
    } finally {
      setUnitPending(null);
    }
  };

  const vacateUnit = async (unit: string) => {
    setUnitPending(unit);
    setError("");
    try {
      const res = await fetch("/api/admin/studios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Vacate failed.");
      setStudios((prev) =>
        prev.map((s) => (s.unit === unit ? { ...s, ownerEmail: null } : s)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vacate failed.");
    } finally {
      setUnitPending(null);
    }
  };

  const cards = [
    { label: "members", value: fmt.format(members.length) },
    { label: "admins", value: fmt.format(adminCount) },
    { label: "views · 7d", value: fmt.format(traffic.weekViews) },
    { label: "uniques · 7d", value: fmt.format(traffic.weekUniques) },
  ];

  const maxViews = Math.max(1, ...traffic.daily.map((d) => d.views));

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-6 border-b border-line pb-3 text-xs font-bold uppercase tracking-[0.25em]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "glow-green text-matrix"
                : "text-ink-dim transition-colors hover:text-ink-soft"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-pill-red/30 bg-pill-red/10 px-4 py-3 text-sm text-pill-red">
          {error}
        </p>
      )}

      {/* Overview */}
      {tab === "overview" && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div
                key={c.label}
                className="rounded-3xl border border-line bg-surface/70 p-6"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
                  {c.label}
                </p>
                <p className="glow-green mt-3 text-3xl font-bold text-matrix">
                  {c.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-line bg-surface/70 p-8">
              <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
                in the construct now
              </p>
              <p className="glow-green mt-3 text-4xl font-bold text-matrix">
                {online === null ? "—" : fmt.format(online)}
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-surface/70 p-8">
              <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
                newest members
              </p>
              <div className="mt-4 space-y-2 text-sm">
                {members.length === 0 && (
                  <p className="text-ink-dim">no members yet</p>
                )}
                {members.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex justify-between gap-4">
                    <span className="truncate text-ink-soft">{m.name}</span>
                    <span className="shrink-0 text-ink-dim">
                      {joined(m.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Members */}
      {tab === "members" && (
        <div className="mt-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search name or email…"
            className="mb-4 w-full max-w-sm rounded-xl border border-line bg-black/50 px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ink-dim focus:border-matrix"
          />
          <div className="overflow-x-auto rounded-3xl border border-line bg-surface/70">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-[0.2em] text-ink-dim">
                  <th className="p-4 font-semibold">member</th>
                  <th className="p-4 font-semibold">role</th>
                  <th className="p-4 font-semibold">joined</th>
                  <th className="p-4 text-right font-semibold">manage</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-ink-dim">
                      no members match.
                    </td>
                  </tr>
                )}
                {filtered.map((m) => {
                  const owner = isOwner(m);
                  const busy = pendingId === m.id;
                  return (
                    <tr key={m.id} className="border-b border-line/60">
                      <td className="p-4">
                        <p className="font-semibold text-ink">{m.name}</p>
                        <p className="text-xs text-ink-dim">{m.email}</p>
                      </td>
                      <td className="p-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                            m.role === "admin"
                              ? "border-matrix/50 text-matrix"
                              : "border-line text-ink-dim"
                          }`}
                        >
                          {owner ? "owner" : m.role}
                        </span>
                      </td>
                      <td className="p-4 text-ink-soft">{joined(m.createdAt)}</td>
                      <td className="p-4">
                        {owner ? (
                          <p className="text-right text-xs text-ink-dim">
                            protected
                          </p>
                        ) : confirmId === m.id ? (
                          <div className="flex justify-end gap-3 text-xs font-bold uppercase tracking-[0.14em]">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => removeMember(m)}
                              className="text-pill-red hover:underline disabled:opacity-50"
                            >
                              confirm remove
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId(null)}
                              className="text-ink-dim hover:text-ink-soft"
                            >
                              cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-4 text-xs font-bold uppercase tracking-[0.14em]">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                changeRole(
                                  m,
                                  m.role === "admin" ? "user" : "admin",
                                )
                              }
                              className="text-matrix transition-opacity hover:opacity-70 disabled:opacity-50"
                            >
                              {m.role === "admin" ? "revoke admin" : "make admin"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setConfirmId(m.id)}
                              className="text-ink-dim transition-colors hover:text-pill-red disabled:opacity-50"
                            >
                              remove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Storefronts */}
      {tab === "storefronts" && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-ink-soft">
            Assign a unit to any registered member by email. They can then dress
            its walls and manage it from their back office at{" "}
            <span className="text-matrix">/studio</span>.
          </p>
          {studios.map((s) => {
            const busy = unitPending === s.unit;
            return (
              <div
                key={s.unit}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/70 p-5"
              >
                <span className="glow-green text-lg font-black text-matrix">
                  {s.unit}
                </span>
                <div className="min-w-[8rem] flex-1">
                  <p className="font-semibold text-ink">{s.studioName}</p>
                  <p className="text-xs text-ink-dim">
                    {s.ownerEmail ? (
                      <>
                        owned by{" "}
                        <span className="text-ink-soft">{s.ownerEmail}</span>
                      </>
                    ) : (
                      "vacant"
                    )}
                  </p>
                </div>
                <input
                  value={assignEmail[s.unit] ?? ""}
                  onChange={(e) =>
                    setAssignEmail((prev) => ({
                      ...prev,
                      [s.unit]: e.target.value,
                    }))
                  }
                  placeholder="member email"
                  className="w-56 rounded-lg border border-line bg-black/50 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-dim focus:border-matrix"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => assignUnit(s.unit)}
                  className="rounded-lg border border-matrix px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-matrix transition-colors hover:bg-matrix hover:text-black disabled:opacity-50"
                >
                  {s.ownerEmail ? "reassign" : "assign"}
                </button>
                {s.ownerEmail && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => vacateUnit(s.unit)}
                    className="text-xs font-bold uppercase tracking-[0.14em] text-ink-dim transition-colors hover:text-pill-red disabled:opacity-50"
                  >
                    vacate
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Traffic */}
      {tab === "traffic" && (
        <div className="mt-6 space-y-4">
          <div className="rounded-3xl border border-line bg-surface/70 p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
              daily views · last {traffic.daily.length} days
            </p>
            <div className="mt-6 space-y-2">
              {traffic.daily.map(({ day, views, uniques }) => (
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
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["top pages", traffic.topPages, "no traffic recorded yet"],
                ["top referrers", traffic.topReferrers, "no external referrers yet"],
              ] as const
            ).map(([title, entries, empty]) => (
              <div
                key={title}
                className="rounded-3xl border border-line bg-surface/70 p-8"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-ink-dim">
                  {title}
                </p>
                <div className="mt-5 space-y-3 text-sm">
                  {entries.length === 0 && <p className="text-ink-dim">{empty}</p>}
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
          </div>
        </div>
      )}
    </div>
  );
}
