"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Fires a pageview ping on every client-side route change. Renders nothing. */
export default function AnalyticsBeacon() {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || lastPath.current === pathname) return;
    // only credit the external referrer on the first page of the visit
    const referrer = lastPath.current === null ? document.referrer : "";
    lastPath.current = pathname;

    const payload = JSON.stringify({ path: pathname, referrer });
    try {
      const sent = navigator.sendBeacon?.(
        "/api/track",
        new Blob([payload], { type: "application/json" }),
      );
      if (!sent) {
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // analytics must never break the page
    }
  }, [pathname]);

  return null;
}
