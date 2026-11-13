"use client";

import { useEffect, useState } from "react";
import { IconCoins } from "@/components/icons";
import { LivePill } from "@/components/live-pill";
import { Badge, Card, Stat } from "@/components/ui";
import type { NsmBlock, NsmSnapshot } from "@/lib/network/nsm";

/** The node feed caches for 30 seconds; asking more often returns the same reading. */
const POLL_MS = 30_000;
const MAX_ROWS = 30;
const ZAT_PER_ZEC = 100_000_000;

const zec = (zat: number, digits: number): string =>
  (zat / ZAT_PER_ZEC).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

/** Per-block amounts as consensus counts them: up to eight decimals. */
const zecExact = (zat: number): string =>
  (zat / ZAT_PER_ZEC).toLocaleString("en-US", { maximumFractionDigits: 8 });

function usd(zat: number, rate: number): string {
  return ((zat / ZAT_PER_ZEC) * rate).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function ago(time: string, now: number): string {
  if (!now) return "";
  const s = Math.max(0, Math.round((now - Date.parse(time)) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

/** "Feb 2031", kept on one line in the narrow stat strip. */
const monthYear = (iso: string): string =>
  new Date(iso)
    .toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .replace(" ", "\u00a0");

/** Newer readings first; a block already listed keeps its place. */
function mergeBlocks(fresh: NsmBlock[], previous: NsmBlock[]): NsmBlock[] {
  const seen = new Set(fresh.map((b) => b.height));
  return [...fresh, ...previous.filter((b) => !seen.has(b.height))]
    .sort((a, b) => b.height - a.height)
    .slice(0, MAX_ROWS);
}

function isSnapshot(value: unknown): value is NsmSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<NsmSnapshot>;
  return (
    typeof v.balanceZat === "number" &&
    typeof v.height === "number" &&
    Array.isArray(v.blocks)
  );
}

/**
 * Live view of the NSM value balance: what consensus holds out of circulation
 * now, how much of it came from fees since NU7, and each recent block's fee
 * split. Starts from the server's reading and follows the node feed.
 */
export function NsmLiveFeed({
  initial,
  zecUsd,
}: {
  /** The reading taken while rendering; null when the feed was unavailable. */
  initial: NsmSnapshot | null;
  /** ZEC/USD used for the valuation; null when no price is available. */
  zecUsd: number | null;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [blocks, setBlocks] = useState<NsmBlock[]>(initial?.blocks ?? []);
  const [reachable, setReachable] = useState(initial !== null);
  const [now, setNow] = useState(0);

  // The relative-time clock starts after mount (keeps SSR deterministic).
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setNow(Date.now());
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    let alive = true;
    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/network/nsm", { cache: "no-store" });
        const data: unknown = res.ok ? await res.json() : null;
        if (!alive) return;
        if (!isSnapshot(data)) {
          setReachable(false);
          return;
        }
        setReachable(true);
        setSnapshot(data);
        setBlocks((previous) => mergeBlocks(data.blocks, previous));
      } catch {
        if (alive) setReachable(false);
      }
    }
    const id = setInterval(poll, POLL_MS);
    // A hidden tab skips its polls; catch up as soon as it is shown again.
    document.addEventListener("visibilitychange", poll);
    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
  }, []);

  if (!snapshot) {
    return (
      <Card className="mb-6">
        <p className="text-sm font-medium text-stone-900">
          NSM balance unavailable right now
        </p>
        <p className="mt-1 text-sm text-stone-600">
          The node feed did not return the balance, so nothing is shown in its
          place. The rules below do not depend on it.
        </p>
      </Card>
    );
  }

  const live = reachable && !snapshot.stale;
  // An empty block adds nothing and is left out. A block whose split the feed
  // did not report stays listed, but is never counted as a contribution.
  const added = blocks.filter((b) => b.nsmZat !== null && b.nsmZat > 0);
  const unreported = blocks.filter((b) => b.nsmZat === null);
  const listed = blocks.filter((b) => b.nsmZat === null || b.nsmZat > 0);
  const tally = `${added.length} of the last ${blocks.length} blocks added to the balance${
    unreported.length > 0 ? ` · ${unreported.length} not reported` : ""
  }`;

  return (
    <>
      {/* Hero: the balance consensus holds out of circulation */}
      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-stone-600">
              NSM value balance · out of circulation
            </p>
            <p className="num-lg mt-2 break-words text-3xl font-semibold tracking-tight text-stone-900 tnum sm:text-4xl md:text-5xl">
              {zec(snapshot.balanceZat, 4)}{" "}
              <span className="text-xl text-stone-600 sm:text-2xl">ZEC</span>
            </p>
            <p className="mt-1 text-sm text-stone-600 tnum">
              {zecUsd !== null
                ? `≈ ${usd(snapshot.balanceZat, zecUsd)} · `
                : ""}
              growing by{" "}
              <span className="font-medium text-amber-700">
                60% of the fees
              </span>{" "}
              in every block
            </p>
          </div>
          <LivePill
            live={live}
            height={snapshot.height}
            idleLabel="Last reading"
          />
        </div>
      </Card>

      {/* Where the balance came from and when it starts coming back */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat
          label="Seeded at NU7"
          value={zec(snapshot.seedZat, 2)}
          sub="ZEC · unclaimed before NU6"
        />
        <Stat
          label="From fees since NU7"
          value={`+${zec(snapshot.addedZat, 2)}`}
          sub={`ZEC · ${snapshot.blocksSinceActivation.toLocaleString("en-US")} blocks`}
          tone="warn"
        />
        <Stat
          label="Per day"
          value={`~${zec(snapshot.averagePerDayZat, 2)}`}
          sub="ZEC · average since NU7"
        />
        <Stat
          label="Reissuance from"
          value={monthYear(snapshot.reissuance.estimatedAt)}
          sub={`block ${snapshot.reissuance.height.toLocaleString("en-US")} · estimate`}
        />
      </section>

      {/* Recent blocks that carried fees, and the 60% that left circulation */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-sm font-semibold text-stone-700">
          Transaction fees into the NSM
        </h2>
        {blocks.length > 0 ? (
          <p className="text-xs text-stone-600 tnum">{tally}</p>
        ) : null}
      </div>
      <Card className="p-0">
        {listed.length > 0 ? (
          <div className="divide-y divide-stone-200 px-5">
            {listed.map((b) => (
              <FeeRow key={b.height} block={b} now={now} />
            ))}
          </div>
        ) : (
          <p className="px-5 py-12 text-center text-sm text-stone-600">
            {blocks.length > 0
              ? "None of the recent blocks added to the balance."
              : "Waiting for the next block…"}
          </p>
        )}
      </Card>
    </>
  );
}

function FeeRow({ block, now }: { block: NsmBlock; now: number }) {
  const known = block.feesZat !== null && block.nsmZat !== null;
  const added = block.nsmZat ?? 0;
  return (
    <div className="flex items-center gap-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-700">
        <IconCoins className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-900 tnum">
          Block #{block.height.toLocaleString("en-US")}
        </p>
        <p className="text-xs text-stone-600 tnum">
          {!known
            ? "fee split not reported"
            : block.feesZat === 0
              ? "no transaction fees"
              : `fees ${zecExact(block.feesZat ?? 0)} ZEC${
                  block.minerFeesZat !== null
                    ? ` · ${zecExact(block.minerFeesZat)} to the miner`
                    : ""
                }`}
        </p>
      </div>
      {block.ruleHolds === false ? (
        <Badge tone="rose">differs from the 60% rule</Badge>
      ) : null}
      <div className="shrink-0 text-right">
        <p
          className={
            added > 0
              ? "text-sm font-semibold text-amber-700 tnum"
              : "text-sm font-medium text-stone-500 tnum"
          }
        >
          {!known ? "·" : added > 0 ? `+${zecExact(added)} ZEC` : "0 ZEC"}
        </p>
        <p className="text-xs text-stone-600">to the NSM</p>
      </div>
      <div className="hidden w-20 shrink-0 text-right text-xs text-stone-600 sm:block">
        {ago(block.time, now)}
      </div>
    </div>
  );
}
