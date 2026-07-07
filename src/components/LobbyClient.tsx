"use client";

import dynamic from "next/dynamic";

// The Nexus runs on WebGL, WebSockets, and WebRTC — all browser-only, so the
// lobby is skipped entirely during server-side prerendering.
const Lobby = dynamic(() => import("./Lobby"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <p className="animate-pulse text-xs uppercase tracking-[0.3em] text-matrix">
        loading the nexus…
      </p>
    </div>
  ),
});

export default function LobbyClient() {
  return <Lobby />;
}
