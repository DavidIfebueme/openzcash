"use client";
import { useEffect, useState } from "react";
import { officialProposalSnapshotSchema, type OfficialProposalSnapshot } from "@/lib/participate/official-proposals-model";

/** One public read for the entire board. Refreshes preserve drafts and open conversations. */
export function useOfficialProposals(initial: OfficialProposalSnapshot | null, enabled: boolean) {
  const [state, setState] = useState({ snapshot: initial, unavailable: false });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let pending: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      if (pending) return;
      if (document.visibilityState === "hidden" || document.activeElement?.matches("input, textarea, [contenteditable=true]")) {
        clearTimeout(timer);
        timer = setTimeout(() => void refresh(), 60_000);
        return;
      }
      clearTimeout(timer);
      const controller = new AbortController(); pending = controller;
      const timeout = setTimeout(() => controller.abort(), 8_000);
      try {
        const response = await fetch("/api/participate/official-proposals", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Unavailable");
        const snapshot = officialProposalSnapshotSchema.parse(await response.json());
        if (active) setState({ snapshot, unavailable: false });
      } catch {
        // Keep last-good rows, explicitly marked as stale, instead of silently dropping proposals.
        if (active) setState(previous => ({ ...previous, unavailable: true }));
      } finally {
        clearTimeout(timeout); pending = null;
        if (active) timer = setTimeout(() => void refresh(), 60_000);
      }
    }
    if (initial) timer = setTimeout(() => void refresh(), 60_000); else void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; pending?.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [initial, enabled]);
  return state;
}
