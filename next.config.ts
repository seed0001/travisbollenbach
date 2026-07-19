import type { NextConfig } from "next";

// Security headers applied to every response. Kept deliberately conservative so
// they harden the site without breaking its WebGL/Three.js scenes, blob-based
// audio, or the lobby microphone (see src/lib/lobby.ts).
//
// Note on CSP: we set `frame-ancestors` only (clickjacking protection). A full
// script-src/default-src policy is intentionally omitted — this site loads
// WebGL workers, blob: media, and data: textures, so a strict default-src would
// break real features and needs to be built up and tested against the live app
// before shipping.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // microphone stays enabled (self) for the lobby voice chat; camera and
    // geolocation are not used anywhere, so deny them outright.
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(self), browsing-topics=()",
  },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
];

const nextConfig: NextConfig = {
  // Drop the framework-fingerprinting `X-Powered-By: Next.js` header.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
