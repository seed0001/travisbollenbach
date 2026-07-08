"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Stats = {
  onlineNow: number;
  hostOnline: boolean;
  members: number;
  visitorsToday: number;
  visitsToday: number;
  recentVisits: number;
};

const REFRESH_MS = 30000;

const formatCount = new Intl.NumberFormat("en-US");

export default function SiteStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/stats", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as Stats;
        if (!cancelled) setStats(data);
      } catch {
        // stats are decorative — stay quiet on failure
      }
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const value = (n: number | undefined) =>
    n === undefined ? "—" : formatCount.format(n);

  const items = [
    { label: "in the construct now", value: value(stats?.onlineNow) },
    { label: "visitors today", value: value(stats?.visitorsToday) },
    { label: "members", value: value(stats?.members) },
    { label: "recent visits", value: value(stats?.recentVisits) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mt-9 max-w-lg"
    >
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2">
          {stats?.hostOnline && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7dffa8] opacity-60" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              stats?.hostOnline ? "bg-[#7dffa8]" : "bg-white/25"
            }`}
          />
        </span>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
          {stats === null
            ? "checking the construct…"
            : stats.hostOnline
              ? "travis is in the construct right now"
              : "travis is not inside at the moment"}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
              {item.label}
            </dt>
            <dd className="mt-0.5 text-xl font-black tabular-nums text-white/85">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </motion.div>
  );
}
