"use client";

import { useMemo, useState } from "react";

type AccessRule = "free" | "subscription" | "age-gated" | "subscription-age";

type LevelDoor = {
  id: string;
  name: string;
  shortName: string;
  zone: string;
  description: string;
  access: AccessRule;
  minimumAge?: number;
  position: {
    left: string;
    top: string;
  };
};

const levelDoors: LevelDoor[] = [
  {
    id: "training-yard",
    name: "Training Yard",
    shortName: "Yard",
    zone: "starter",
    description: "A free tutorial space for movement, controls, and basic interactions.",
    access: "free",
    position: { left: "18%", top: "62%" },
  },
  {
    id: "arcade-run",
    name: "Arcade Run",
    shortName: "Arcade",
    zone: "starter",
    description: "A quick free challenge level with score chasing and short loops.",
    access: "free",
    position: { left: "29%", top: "29%" },
  },
  {
    id: "sky-workshop",
    name: "Sky Workshop",
    shortName: "Workshop",
    zone: "premium",
    description: "A subscription area with build tools, experiments, and advanced puzzles.",
    access: "subscription",
    position: { left: "52%", top: "20%" },
  },
  {
    id: "neon-district",
    name: "Neon District",
    shortName: "Neon",
    zone: "age gate",
    description: "An age-gated social zone with sharper themes and moderated interactions.",
    access: "age-gated",
    minimumAge: 18,
    position: { left: "71%", top: "39%" },
  },
  {
    id: "deep-vault",
    name: "Deep Vault",
    shortName: "Vault",
    zone: "premium age gate",
    description: "A subscription and age-gated late-game level for mature story content.",
    access: "subscription-age",
    minimumAge: 18,
    position: { left: "58%", top: "70%" },
  },
];

const accessLabels: Record<AccessRule, string> = {
  free: "Free",
  subscription: "Subscription",
  "age-gated": "Age gate",
  "subscription-age": "Subscription + age gate",
};

const accessDescriptions: Record<AccessRule, string> = {
  free: "Open from the lobby.",
  subscription: "Requires an active paid tier.",
  "age-gated": "Requires age confirmation before entry.",
  "subscription-age": "Requires both paid access and age confirmation.",
};

export default function ComingSoonPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedDoorId, setSelectedDoorId] = useState(levelDoors[0].id);
  const selectedDoor = useMemo(
    () => levelDoors.find((door) => door.id === selectedDoorId) ?? levelDoors[0],
    [selectedDoorId],
  );

  return (
    <main className="game-shell min-h-svh bg-[#111318] text-white">
      {!isPlaying ? (
        <section className="welcome-screen mx-auto flex min-h-svh max-w-5xl flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-[#89d8c2]">
            Travis Bollenbach
          </p>
          <h1 className="mt-5 text-6xl font-black tracking-tight text-white sm:text-8xl">
            Welcome.
          </h1>
          <p className="mt-5 text-xl font-semibold text-white/78 sm:text-2xl">
            Do you want to play the game?
          </p>
          <button
            type="button"
            onClick={() => setIsPlaying(true)}
            className="mt-9 min-h-14 rounded-md bg-[#f5d06f] px-8 text-sm font-black uppercase tracking-[0.18em] text-[#15120b] shadow-[0_16px_40px_rgba(0,0,0,0.28)] transition hover:-translate-y-0.5 hover:bg-[#ffe08d] focus:outline-none focus:ring-4 focus:ring-[#f5d06f]/35"
          >
            Enter lobby
          </button>
        </section>
      ) : (
        <section className="lobby-screen mx-auto grid min-h-svh max-w-7xl gap-5 px-4 py-4 lg:grid-cols-[1fr_360px] lg:px-6 lg:py-6">
          <div className="lobby-world relative min-h-[620px] overflow-hidden rounded-md border border-white/12 bg-[#182023] shadow-2xl shadow-black/35">
            <div className="lobby-path absolute left-[12%] top-[50%] h-[18%] w-[74%] -translate-y-1/2 rounded-[50%] border border-[#ead08a]/24 bg-[#d8b45b]/16" />
            <div className="lobby-path absolute left-[42%] top-[12%] h-[74%] w-[16%] rounded-[50%] border border-[#ead08a]/18 bg-[#d8b45b]/12" />
            <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#89d8c2]/45 bg-[#111318]/88 shadow-[0_0_50px_rgba(137,216,194,0.2)]">
              <span className="text-center text-xs font-black uppercase tracking-[0.18em] text-[#89d8c2]">
                Lobby
              </span>
            </div>

            {levelDoors.map((door) => (
              <button
                key={door.id}
                type="button"
                onClick={() => setSelectedDoorId(door.id)}
                className={`level-door absolute grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-t-full border px-2 text-center text-[11px] font-black uppercase tracking-[0.08em] transition hover:-translate-y-[54%] focus:outline-none focus:ring-4 ${
                  selectedDoor.id === door.id
                    ? "border-[#f5d06f] bg-[#f5d06f] text-[#15120b] shadow-[0_0_32px_rgba(245,208,111,0.38)] focus:ring-[#f5d06f]/30"
                    : "border-white/18 bg-[#111318]/86 text-white shadow-[0_12px_30px_rgba(0,0,0,0.32)] focus:ring-white/20"
                }`}
                style={{ left: door.position.left, top: door.position.top }}
                aria-label={`Inspect ${door.name}`}
              >
                <span>{door.shortName}</span>
              </button>
            ))}
          </div>

          <aside className="lobby-panel rounded-md border border-white/12 bg-[#17191f] p-5 shadow-xl shadow-black/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#89d8c2]">
                  Door map
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-tight">
                  {selectedDoor.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsPlaying(false)}
                className="rounded-md border border-white/14 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white/70 transition hover:border-white/35 hover:text-white"
              >
                Exit
              </button>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                  Zone
                </dt>
                <dd className="mt-1 text-sm font-bold capitalize text-white">
                  {selectedDoor.zone}
                </dd>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
                  Access
                </dt>
                <dd className="mt-1 text-sm font-bold text-white">
                  {accessLabels[selectedDoor.access]}
                </dd>
              </div>
            </dl>

            <p className="mt-5 text-sm leading-6 text-white/68">
              {selectedDoor.description}
            </p>

            <div className="mt-5 rounded-md border border-[#f5d06f]/24 bg-[#f5d06f]/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f5d06f]">
                Entry rule
              </p>
              <p className="mt-2 text-sm leading-6 text-white/76">
                {accessDescriptions[selectedDoor.access]}
                {selectedDoor.minimumAge
                  ? ` Minimum age: ${selectedDoor.minimumAge}.`
                  : ""}
              </p>
            </div>

            <div className="mt-6 space-y-2">
              {levelDoors.map((door) => (
                <button
                  key={door.id}
                  type="button"
                  onClick={() => setSelectedDoorId(door.id)}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-white/10 bg-white/[0.035] px-3 py-3 text-left transition hover:border-white/24 hover:bg-white/[0.06]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {door.name}
                    </span>
                    <span className="mt-1 block text-xs text-white/45">
                      {door.zone}
                    </span>
                  </span>
                  <span className="rounded-sm bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white/72">
                    {accessLabels[door.access]}
                  </span>
                </button>
              ))}
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}
