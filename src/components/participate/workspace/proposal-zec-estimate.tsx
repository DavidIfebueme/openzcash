"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ZcgApprovedBudget } from "@/lib/participate/workspace/data/zcg-approved-budgets";
import { estimateFundingZat, formatUsdPerZec, FUNDING_QUOTE_SOURCE_URL } from "@/lib/participate/workspace/domain/funding-quote";
import { formatProposalUsd } from "@/lib/participate/workspace/domain/proposal-funding";
import { formatEstimatedZec, readDisplayZecPrice, type PublicZecPrice } from "@/lib/participate/workspace/domain/zec-price";

export type PriceState = { status: "loading" | "ready" | "unavailable"; price: PublicZecPrice | null };
const updatedFormat = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC"
});

/** Call once for the list, not once per proposal. Expire prices even during a stalled refresh. */
export function useProposalZecPrice(enabled: boolean): PriceState {
  const [state, setState] = useState<PriceState>({ status: "loading", price: null });
  useEffect(() => {
    if (!state.price) return;
    const expiry = setTimeout(() => setState({ status: "unavailable", price: null }), Math.max(0, +new Date(state.price.expiresAt) - Date.now()));
    return () => clearTimeout(expiry);
  }, [state.price]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let pending: AbortController | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    async function refresh() {
      if (pending || document.visibilityState === "hidden") return;
      clearTimeout(retry);
      const controller = new AbortController();
      pending = controller;
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        const response = await fetch("/api/participate/zec-price", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Price unavailable");
        const price = readDisplayZecPrice(await response.json());
        if (!active) return;
        failures = 0;
        setState({ status: "ready", price });
      } catch {
        if (active) {
          failures += 1;
          // A failed refresh does not invalidate a quote before its original expiry.
          // The independent expiry timer still removes it during prolonged outages.
          setState(current => {
            try {
              if (current.price) return { status: "ready", price: readDisplayZecPrice(current.price) };
            } catch { /* The previous quote has genuinely expired. */ }
            return { status: "unavailable", price: null };
          });
        }
      } finally {
        clearTimeout(timeout);
        pending = null;
        if (active) {
          const delay = failures ? Math.min(15_000 * 2 ** Math.min(failures - 1, 2), 60_000) : 60_000;
          retry = setTimeout(() => void refresh(), delay);
        }
      }
    }
    void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      pending?.abort();
      clearTimeout(retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);
  return state;
}

const ledgerUpdatedFormat = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC",
});

/** Only mounted inside the popover; keep its freshness current while it stays open. */
function LedgerSync({ importedAt }: { importedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const imported = Date.parse(importedAt);
  if (!Number.isFinite(imported)) return null;
  return <p className="proposal-zec-ledger-sync">Ledger synced <time dateTime={importedAt}>{ledgerUpdatedFormat.format(new Date(imported))} UTC</time>{now - imported > 12 * 60 * 60 * 1000 ? <strong> · Sync delayed</strong> : null}</p>;
}

export function ProposalZecEstimate({ budget, state, ledgerImportedAt }: { budget: ZcgApprovedBudget; state: PriceState; ledgerImportedAt?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  let price: PublicZecPrice | null = null;
  let estimate: string | null = null;
  try {
    if (state.price) {
      price = readDisplayZecPrice(state.price);
      estimate = formatEstimatedZec(estimateFundingZat(BigInt(budget.usdCents), BigInt(price.rateUsdPerZecE8)));
    }
  } catch { price = null; }

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return <div className="proposal-zec-estimate" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); button.current?.focus(); }
  }}>
    <button ref={button} type="button" className="proposal-zec-trigger" data-available={!!price} aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      {estimate ? <><strong>{estimate.startsWith("<") ? "" : "≈ "}{estimate} ZEC</strong><span>today</span></> : <span>{state.status === "loading" ? "Estimating ZEC…" : "ZEC estimate unavailable"}</span>}
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="10" cy="10" r="7.25" strokeWidth="1.5"/><path d="M10 9v5M10 6v1" strokeWidth="1.5"/></svg>
    </button>
    {open ? <div id={id} className="proposal-zec-detail" role="region" aria-label="ZEC estimate details">
      <div className="proposal-zec-detail-heading"><strong>At today’s rate</strong><button type="button" aria-label="Close ZEC estimate" onClick={() => { setOpen(false); button.current?.focus(); }}>×</button></div>
      <p>Official ZCG spreadsheet · {budget.sourceRows.length} funding {budget.sourceRows.length === 1 ? "entry" : "entries"}</p>
      <dl>
        <div><dt><a href={budget.sourceUrl} target="_blank" rel="noopener noreferrer">Official approved budget ↗</a></dt><dd>{formatProposalUsd(budget.usdCents)}</dd></div>
        {price ? <div><dt>1 ZEC</dt><dd>{formatUsdPerZec(price.rateUsdPerZecE8)} USD</dd></div> : null}
      </dl>
      {ledgerImportedAt ? <LedgerSync importedAt={ledgerImportedAt} /> : null}
      {price ? <><p>Total grant estimate: USD budget ÷ current ZEC price. Prior payments aren’t deducted. Each payment uses its payment-day rate.</p><div className="proposal-zec-price-source"><a href={FUNDING_QUOTE_SOURCE_URL} target="_blank" rel="noopener noreferrer">CoinGecko ↗</a><time dateTime={price.quotedAt}>{updatedFormat.format(new Date(price.quotedAt))} UTC</time></div></> : <p>A fresh price is unavailable. We retry automatically; the approved USD budget stays the same.</p>}
    </div> : null}
  </div>;
}
