"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Read-only source pages update while visible without moving the scroll position. */
export function SourceRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let lastRefresh = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefresh < intervalMs) return;
      // Do not replace a search form while someone is typing.
      if (document.activeElement?.matches("input, textarea, [contenteditable=true]")) return;
      lastRefresh = Date.now();
      router.refresh();
    };
    const timer = window.setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, intervalMs]);
  return null;
}
