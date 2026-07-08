"use client";

import dynamic from "next/dynamic";

// WebGL + GLTF — client-only, skipped during server-side prerendering.
const GalaxyRoom = dynamic(() => import("./GalaxyRoom"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <p className="animate-pulse text-xs uppercase tracking-[0.3em] text-matrix">
        opening the hangar…
      </p>
    </div>
  ),
});

export default function GalaxyRoomClient() {
  return <GalaxyRoom />;
}
