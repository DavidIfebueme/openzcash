"use client";
import { useEffect, useState } from "react";
import { approvedBudgetSnapshotSchema, type ApprovedBudgetSnapshot, type ApprovedBudgetStatus } from "@/lib/participate/workspace/data/zcg-approved-budgets";

/** A single bulk request for the board, never a request for each proposal. */
export function useApprovedProposalBudgets(initial: ApprovedBudgetSnapshot | null = null) {
  const [state, setState] = useState<{ snapshot: ApprovedBudgetSnapshot | null; status: ApprovedBudgetStatus }>({
    snapshot: initial, status: initial ? "ready" : "loading",
  });
  useEffect(() => {
    let active = true;
    let pending: AbortController | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    async function refresh() {
      if (pending || document.visibilityState === "hidden") return;
      clearTimeout(retry);
      const controller = new AbortController();
      pending = controller;
      const timeout = setTimeout(() => controller.abort(), 8_000);
      let ok = false;
      try {
        const response = await fetch("/api/participate/approved-budgets", { signal: controller.signal });
        if (!response.ok) throw new Error("Budget source unavailable");
        const snapshot = approvedBudgetSnapshotSchema.parse(await response.json());
        if (active) setState({ snapshot, status: "ready" });
        ok = true;
      } catch {
        // Do not present a stale or withdrawn approval as a current budget.
        if (active) setState({ snapshot: null, status: "unavailable" });
      } finally {
        clearTimeout(timeout);
        pending = null;
        if (active) retry = setTimeout(() => void refresh(), ok ? 60_000 : 15_000);
      }
    }
    if (initial) retry = setTimeout(() => void refresh(), 60_000);
    else void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false; pending?.abort(); clearTimeout(retry); document.removeEventListener("visibilitychange", onVisible); };
  }, [initial]);
  return state;
}

export function budgetStatusText(status: ApprovedBudgetStatus) {
  return status === "loading" ? "Loading approved budget…" : status === "unavailable" ? "Approved budget unavailable" : "Approved budget pending in ledger";
}
