"use client";

import dynamic from "next/dynamic";

// WebGL + WebAudio — client-only, skipped during server-side prerendering.
const BeachRoom = dynamic(() => import("./BeachRoom"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <p className="animate-pulse text-xs uppercase tracking-[0.3em] text-white/70">
        walking down to the water…
      </p>
    </div>
  ),
});

export default function BeachRoomClient() {
  return <BeachRoom />;
}
