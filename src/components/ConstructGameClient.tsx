"use client";

import dynamic from "next/dynamic";

// The Construct runs on WebGL and EZ-Tree, which touch `document` the moment
// they load — so the game is client-only, skipped entirely during
// server-side prerendering.
const ConstructGame = dynamic(() => import("./ConstructGame"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <p className="animate-pulse text-xs uppercase tracking-[0.3em] text-matrix">
        loading the construct…
      </p>
    </div>
  ),
});

export default ConstructGameClient;

function ConstructGameClient() {
  return <ConstructGame />;
}
