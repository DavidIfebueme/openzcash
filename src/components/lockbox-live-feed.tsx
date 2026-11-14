"use client";

import { useEffect, useRef, useState } from "react";
import {
  NU7_HEIGHT,
  blockRewardsAt,
  lockboxAccruedZec,
  lockboxZecAt,
} from "@/lib/zcash/lockbox";
import { Card, Stat } from "@/components/ui";
import { IconShield } from "@/components/icons";
import { LivePill } from "@/components/live-pill";

const POLL_MS = 15_000;
const MAX_ROWS = 30;

type BlockRow = { height: number; seenAt: number };

function usd(zec: number, rate: number): string {
  return (zec * rate).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function ago(seenAt: number, now: number): string {
  if (!now) return "";
  const s = Math.max(0, Math.round((now - seenAt) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

/** Per-block amounts as consensus pays them: eight decimals, no rounding. */
const zecExact = (zec: number): string =>
  zec.toLocaleString("en-US", { maximumFractionDigits: 8 });

/**
 * Live view of the Zcash Lockbox (deferred Dev Fund). Polls the chain tip and,
 * for each newly mined block, shows what that block paid into the Lockbox
 * under the rules at its height (0.06249999 ZEC since NU7). The running total
 * is computed deterministically from the tip height.
 */
export function LockboxLiveFeed({
  initialHeight,
  zecUsd,
  baselineZec,
  baselineHeight,
}: {
  initialHeight: number;
  zecUsd: number;
  /** Real Lockbox balance from the spreadsheet snapshot, and its block. */
  baselineZec: number;
  baselineHeight: number;
}) {
  const [height, setHeight] = useState(initialHeight);
  const [live, setLive] = useState(initialHeight > 0);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [now, setNow] = useState(0);
  const lastH = useRef(initialHeight);

  // Seed the ticker and start the relative-time clock after mount (keeps SSR
  // deterministic — no Date.now() during render).
  useEffect(() => {
    const t = Date.now();
    /* eslint-disable react-hooks/set-state-in-effect */
    setNow(t);
    if (initialHeight > 0) setBlocks([{ height: initialHeight, seenAt: t }]);
    /* eslint-enable react-hooks/set-state-in-effect */
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, [initialHeight]);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/chain-tip", { cache: "no-store" });
        const data = (await res.json()) as { height?: number; stale?: boolean };
        if (!alive) return;
        if (typeof data.height !== "number") {
          setLive(false);
          return;
        }
        setLive(!data.stale);
        const h = data.height;
        if (h > lastH.current) {
          const t = Date.now();
          const from = Math.max(lastH.current + 1, h - 20);
          const fresh: BlockRow[] = [];
          for (let b = h; b >= from; b--) fresh.push({ height: b, seenAt: t });
          setBlocks((prev) => [...fresh, ...prev].slice(0, MAX_ROWS));
          lastH.current = h;
          setHeight(h);
        }
      } catch {
        if (alive) setLive(false);
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Anchor to the real spreadsheet balance and add what each block since has
  // paid at its own rate, so this matches the snapshot screens at the baseline
  // and only the live blocks pull it ahead. Falls back to the from-genesis math
  // if no snapshot. Accrual stops at the 3rd halving (funding-model end).
  const totalZec =
    baselineHeight > 0
      ? baselineZec + lockboxAccruedZec(baselineHeight, height)
      : lockboxZecAt(height);
  // Until the tip is known, quote the rules in force since NU7.
  const rewards = blockRewardsAt(height > 0 ? height : NU7_HEIGHT);
  const perDayZec = rewards.lockboxZec * rewards.blocksPerDay;

  return (
    <>
      {/* Hero: the live Lockbox total */}
      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-stone-600">
              Lockbox · deferred Dev Fund
            </p>
            <p className="num-lg mt-2 break-words text-3xl font-semibold tracking-tight text-stone-900 tnum sm:text-4xl md:text-5xl">
              {totalZec.toLocaleString("en-US", {
                maximumFractionDigits: 4,
              })}{" "}
              <span className="text-xl text-stone-600 sm:text-2xl">ZEC</span>
            </p>
            <p className="mt-1 text-sm text-stone-600 tnum">
              ≈ {usd(totalZec, zecUsd)} · accruing{" "}
              <span className="font-medium text-amber-700">
                +{zecExact(rewards.lockboxZec)} ZEC
              </span>{" "}
              every block
            </p>
          </div>
          <LivePill live={live} height={height} />
        </div>
      </Card>

      {/* The per-block reward split */}
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <Stat
          label="To Lockbox"
          value={`+${zecExact(rewards.lockboxZec)}`}
          sub="ZEC / block · 12%"
          tone="warn"
        />
        <Stat
          label="Per day"
          value={`~${perDayZec.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          sub={`ZEC · ${rewards.blocksPerDay.toLocaleString("en-US")} blocks`}
        />
        <Stat
          label="ZCG grants"
          value={zecExact(rewards.zcgZec)}
          sub="ZEC / block · 8%"
        />
        <Stat
          label="Block subsidy"
          value={zecExact(rewards.subsidyZec)}
          sub="ZEC · 80% to miner"
        />
      </section>

      {/* Live block ticker */}
      <h2 className="mb-3 text-sm font-semibold text-stone-700">
        Block rewards into the Lockbox
      </h2>
      <Card className="p-0">
        {blocks.length > 0 ? (
          <div className="divide-y divide-stone-200 px-5">
            {blocks.map((b, i) => {
              const paid = blockRewardsAt(b.height);
              return (
              <div
                key={b.height}
                className="flex items-center gap-4 py-3"
                style={i === 0 ? { animation: "none" } : undefined}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-700">
                  <IconShield className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-stone-900 tnum">
                    Block #{b.height.toLocaleString("en-US")}
                  </p>
                  <p className="text-xs text-stone-600">
                    coinbase · {zecExact(paid.subsidyZec)} ZEC subsidy
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-amber-700 tnum">
                    +{zecExact(paid.lockboxZec)} ZEC
                  </p>
                  <p className="text-xs text-stone-600">to Lockbox</p>
                </div>
                <div className="hidden w-20 shrink-0 text-right text-xs text-stone-600 sm:block">
                  {ago(b.seenAt, now)}
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <p className="px-5 py-12 text-center text-sm text-stone-600">
            Waiting for the next block…
          </p>
        )}
      </Card>

      <p className="mt-4 text-xs text-stone-600">
        Protocol funding stream (ZIP-1015 / ZIP-1016) read live from the chain
        tip; per-block amounts follow the 25-second schedule in force since NU7
        (ZIP-218). No viewing keys involved.
      </p>
    </>
  );
}
