"use client";
import { useState } from "react";
import Link from "next/link";
/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import { PageHeader, Stat } from "@/components/ui";
import { IconShield } from "@/components/icons";
import { cn } from "@/lib/utils";
import { HARDWARE, SOFTWARE, walletPrivacy, type Shielded, type Wallet } from "./catalog-data";

// A distinct "LED" glow colour per wallet — everyone gets one, nobody is
// singled out or promoted. Assigned by position so the grid never repeats.
const LED = [
  "#10b981",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#f43f5e",
  "#14b8a6",
  "#6366f1",
  "#ec4899",
  "#84cc16",
  "#06b6d4",
  "#f97316",
  "#a855f7",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#d946ef",
];

// Wallets the user asked to mark with a star (plus the flagship, which always has one).
const STARRED = new Set([
  "Zingo!",
  "zkool",
  "Vizor",
  "Edge",
  "Cake Wallet",
  "Noir Wallet",
  "Brave Wallet",
  "Unstoppable Wallet",
  "Keystone",
  "Ledger",
  "Trezor",
]);

const SHIELDED: Record<
  Shielded,
  { ringColor: string; monoBg: string; label: string; text: string }
> = {
  full: {
    ringColor: "ring-emerald-400/70",
    monoBg: "bg-[var(--pos-soft)] text-[var(--pos)]",
    label: "Shielded both ways",
    text: "text-[var(--pos)]",
  },
  partial: {
    ringColor: "ring-amber-400/70",
    monoBg: "bg-amber-50 text-amber-700",
    label: "Partial",
    text: "text-amber-700",
  },
  unknown: {
    ringColor: "ring-stone-300", monoBg: "bg-[var(--panel-2)] text-[var(--muted)]",
    label: "Not verified", text: "text-[var(--muted)]",
  },
  unavailable: {
    ringColor: "ring-stone-300", monoBg: "bg-[var(--panel-2)] text-[var(--muted)]",
    label: "Not available", text: "text-[var(--muted)]",
  },
  transparent: {
    ringColor: "ring-stone-300",
    monoBg: "bg-stone-100 text-stone-600",
    label: "Transparent only",
    text: "text-stone-600",
  },
};

function WalletCard({ w, led, platform }: { w: Wallet; led: string; platform: string }) {
  const privacy = walletPrivacy(w.name, platform);
  const s = SHIELDED[privacy.level];
  const star = w.flagship || STARRED.has(w.name);
  return (
    // Stretched-link pattern: the whole card links to the wallet site via an
    // absolutely-positioned overlay, so the source badge can be its own real
    // link (nested <a> is invalid HTML).
    <div
      style={{ "--led": led } as CSSProperties}
      className="ws-wallet-card group relative h-full"
    >
      <a
        href={w.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`${w.name} website`}
        className="absolute inset-0 z-10 rounded-2xl"
      />
      <div className="flex h-full flex-col rounded-2xl bg-white p-4 shadow-[0_0_0_1px_var(--led),0_5px_18px_-9px_var(--led)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_0_0_1.5px_var(--led),0_12px_28px_-7px_var(--led)]">
        <div className="flex items-start gap-3">
          {w.logo ? (
            <img
              src={w.logo}
              alt=""
              width={40}
              height={40}
              className={cn(
                "h-10 w-10 shrink-0 rounded-full bg-white object-contain ring-1 ring-inset ring-stone-200",
                w.name === "Zodl" ? "p-0" : "p-1.5",
              )}
            />
          ) : (
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ring-inset ring-stone-200",
                s.monoBg,
              )}
              aria-hidden="true"
            >
              {w.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="min-w-0 max-w-full break-words text-base font-semibold leading-snug tracking-wide text-stone-900">
                {w.name.toUpperCase()}
              </span>
              {star ? (
                <span className="shrink-0 text-xs text-amber-500">★</span>
              ) : null}
              {w.tag ? (
                <span className="shrink-0 rounded-full bg-stone-200/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600">
                  {w.tag}
                </span>
              ) : null}
            </div>
            <p className="mt-1 break-words text-[13px] font-medium leading-relaxed text-stone-600">
              {w.maker}
            </p>
          </div>
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-amber-600/70 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100"
          >
            <path
              d="M3.5 8h8m0 0L8 4.5M11.5 8L8 11.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-stone-600">
          {w.note}
        </p>

        <Link
          href={`/wallets/find?view=evidence&wallet=${encodeURIComponent(w.name)}`}
          className="relative z-20 mt-2 inline-flex min-h-11 items-center self-start text-[13px] text-[var(--accent-ink)] underline underline-offset-4"
        >
          Capability evidence
        </Link>

        <div className="mt-auto flex flex-wrap items-start justify-between gap-2 pt-3.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {w.platforms.map((p) => (
              <span
                key={p}
                className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600"
              >
                {p}
              </span>
            ))}
            {w.source ? (
              // relative + z-20 lifts this link above the stretched overlay.
              <a
                href={w.source}
                target="_blank"
                rel="noreferrer"
                title={`Fully open source. Code at ${w.source.replace("https://", "")}`}
                className="relative z-20 rounded-md bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-500/20 transition hover:bg-sky-500/20"
              >
                Open source
              </a>
            ) : null}
            {w.audit ? (
              <a
                href={w.audit}
                target="_blank"
                rel="noreferrer"
                title="Opens the public third-party security audit report"
                className="relative z-20 rounded-md bg-violet-500/10 px-2 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-500/20 transition hover:bg-violet-500/20"
              >
                Audited
              </a>
            ) : null}
          </div>
          <span
            className={cn(
              "flex max-w-full items-start gap-1.5 text-xs font-semibold",
              s.text,
            )}
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current" />
            <span>
              {s.label}
              {privacy.level === "full" && !platform && (
                <span className="mt-0.5 block text-[11px] font-normal">{privacy.platforms.join(", ")}</span>
              )}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function WalletCatalog() {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("");
  const [shielded, setShielded] = useState("");
  const [kind, setKind] = useState("all");
  const matches = (w: Wallet) =>
    (!query ||
      `${w.name} ${w.maker} ${w.note}`
        .toLowerCase()
        .includes(query.toLowerCase())) &&
    (!platform || w.platforms.includes(platform)) &&
    (!shielded || walletPrivacy(w.name, platform).level === shielded);
  const software = kind === "hardware" ? [] : SOFTWARE.filter(matches);
  const hardware = kind === "software" ? [] : HARDWARE.filter(matches);
  return (
    <>
      <PageHeader
        title="Zcash Wallets"
        subtitle="Explore Zcash wallets with platform-specific evidence for shielded sending and receiving."
        actions={<Link href="/wallets/find" className="inline-flex min-h-11 items-center gap-3 rounded-lg border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-4 py-2.5 text-base font-medium text-[var(--accent-ink)]">Find a wallet for your needs <span aria-hidden="true">→</span></Link>}
      />

      <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Wallets"
          value={SOFTWARE.length + HARDWARE.length}
          sub="software and hardware"
        />
        <Stat
          label="Shielded both ways"
          value={
            [...SOFTWARE, ...HARDWARE].filter((w) => walletPrivacy(w.name, platform).level === "full")
              .length
          }
          sub={platform ? `confirmed on ${platform}` : "confirmed on at least one platform"}
          tone="in"
        />
        <Stat
          label="Open source"
          value={[...SOFTWARE, ...HARDWARE].filter((w) => w.source).length}
          sub="linked public repositories"
        />
        <Stat
          label="Hardware"
          value={HARDWARE.length}
          sub="device-based options"
        />
      </section>
      <div className="ws-filter-panel" role="search">
        <input
          aria-label="Search wallets"
          type="search"
          placeholder="Search wallets or makers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Wallet type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="all">All wallets</option>
          <option value="software">Software</option>
          <option value="hardware">Hardware</option>
        </select>
        <select
          aria-label="Platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          <option value="">All platforms</option>
          {Array.from(
            new Set([...SOFTWARE, ...HARDWARE].flatMap((w) => w.platforms)),
          ).map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          aria-label="Shielded support"
          value={shielded}
          onChange={(e) => setShielded(e.target.value)}
        >
          <option value="">All privacy levels</option>
          <option value="full">Shielded send + receive</option>
          <option value="partial">Partial shielded</option>
          <option value="transparent">Transparent only</option>
          <option value="unknown">Not verified</option>
          <option value="unavailable">Not available</option>
        </select>
        <button
          className="ws-button"
          onClick={() => {
            setQuery("");
            setPlatform("");
            setShielded("");
            setKind("all");
          }}
        >
          Reset
        </button>
      </div>
      <p className="mb-5 text-[13px] text-stone-500" aria-live="polite">
        {software.length + hardware.length} wallets match this view
      </p>
      <aside className="mb-7 flex items-start gap-3 rounded-2xl border border-[var(--pos-soft)] bg-[var(--pos-soft)] p-5">
        <IconShield className="mt-0.5 h-5 w-5 shrink-0 text-[var(--pos)]" />
        <p className="text-sm leading-relaxed text-[var(--ink)]">
          <span className="font-semibold">
            Shielded = private.
          </span>{" "}
          Shielded transactions protect on-chain payment details. Transparent
          ZEC exposes them. Labels require documented support; check the evidence
          for platform, release and integration limits.
        </p>
      </aside>

      {software.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3.5 text-[15px] font-semibold text-stone-700">
            Software wallets
          </h2>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {software.map((w, i) => (
              <WalletCard key={w.name} w={w} platform={platform} led={LED[i % LED.length]} />
            ))}
          </div>
        </section>
      )}

      {hardware.length > 0 && (
        <section>
          <h2 className="mb-3.5 text-[15px] font-semibold text-stone-700">
            Hardware wallets
          </h2>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {hardware.map((w, i) => (
              <WalletCard
                key={w.name}
                w={w}
                platform={platform}
                led={LED[(SOFTWARE.length + i) % LED.length]}
              />
            ))}
          </div>
        </section>
      )}
      {!software.length && !hardware.length && (
        <p className="ws-empty">
          No wallets match these filters. Try another platform or privacy level.
        </p>
      )}

      <p className="mt-7 text-[13px] leading-relaxed text-stone-600">
        {SOFTWARE.length + HARDWARE.length} wallets · curated from official
        sources. Privacy labels use the same evidence as the finder, for the selected platform. With all platforms selected, confirmed platforms appear below the label. Check the{" "}
        <Link href="/wallets/find?view=evidence" className="underline underline-offset-4">capability evidence</Link>{" "}
        for source dates, scope and unknowns. The{" "}
        <span className="rounded-md bg-sky-500/10 px-1.5 py-px text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-500/20">
          Open source
        </span>{" "}
        badge links to the public repository and appears only when the wallet
        itself (app or firmware) is fully open source, verified per repo and
        license; Ledger is excluded because its device OS is proprietary, even
        though its Zcash app is open. The{" "}
        <span className="rounded-md bg-violet-500/10 px-1.5 py-px text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-500/20">
          Audited
        </span>{" "}
        badge links to a public third-party security audit of the wallet itself
        (for Ledger, of its Zcash app). No badge means no public report was
        found, not that the wallet is unsafe. Deprecated (Nighthawk) and
        non-Zcash (Coinbase Wallet) options are omitted.
      </p>
    </>
  );
}
