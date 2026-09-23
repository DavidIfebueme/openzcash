"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconChart,
  IconGlobe,
  IconSwap,
  IconTrend,
  IconWallet,
} from "@/components/icons";
import type { MarketDashboard } from "@/lib/markets/sources";
import {
  dexMilestone,
  holderIdentity,
  type HolderKind,
  type Venue,
} from "@/lib/markets/model";
import styles from "./markets.module.css";
import { marketLogo } from "@/lib/markets/logos";

const compact = (n: number, digits = 1) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(n);
const number = (n: number, digits = 2) =>
  n.toLocaleString("en-US", { maximumFractionDigits: digits });
const usd = (n: number) => `$${compact(n)}`;
const pct = (n: number | null) =>
  n === null ? "—" : `${n > 0 && n < 0.01 ? "<0.01" : n.toFixed(2)}%`;
function stamp(s: string | null, dayOnly = false) {
  return s
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: dayOnly ? "numeric" : undefined,
        ...(dayOnly
          ? {}
          : { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }),
        timeZone: "UTC",
      }).format(new Date(s))
    : "Unavailable";
}
const width = (n: number) =>
  ({ "--fill": `${Math.max(0, Math.min(100, n))}%` }) as CSSProperties;
const sections = [
  { id: "volume", label: "Overview", Icon: IconChart },
  { id: "trading", label: "Markets", Icon: IconSwap },
  { id: "crosschain", label: "Cross-chain", Icon: IconGlobe },
  { id: "holdings", label: "Holdings", Icon: IconWallet },
  { id: "funds", label: "Funds", Icon: IconTrend },
];
const kinds: Record<HolderKind, string> = {
  cex: "Exchange / custody",
  dex: "DEX / bridge",
  fund: "Fund",
  treasury: "Treasury",
  other: "Public label",
};
function Logo({ name }: { name: string }) {
  const src = marketLogo(name);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const lightMark =
    failedSrc !== src &&
    (src === "/logos/maya.svg" ||
      src === "/logos/markets/zenrock.png" ||
      src === "/logos/markets/katana.svg");
  return (
    <span
      className={`${styles.logo} ${lightMark ? styles.lightMark : ""}`}
    >
      {src && failedSrc !== src ? (
        <Image
          src={src}
          alt=""
          width={32}
          height={32}
          unoptimized
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <IconGlobe />
      )}
    </span>
  );
}
function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}
function Title({
  id,
  title,
  caption,
}: {
  id: string;
  title: string;
  caption: string;
}) {
  return (
    <header className={styles.sectionTitle}>
      <h2 id={id}>{title}</h2>
      <p>{caption}</p>
    </header>
  );
}

/** Chains combine execution venues for the overview; expanded rows retain every source. */
function leaderboard(venues: Venue[]) {
  const grouped = new Map<string, Venue & { members: Venue[] }>();
  for (const v of venues) {
    const chain = v.id.startsWith("wrapped-") ? v.id.split("-")[1] : null;
    const id = chain ? `chain-${chain}` : v.id;
    const name = chain
      ? ({
          solana: "Solana",
          base: "Base",
          bsc: "BNB Chain",
          polygon: "Polygon",
          worldchain: "World Chain",
          katana: "Katana",
          starknet: "Starknet",
          aptos: "Aptos",
        }[chain] ?? chain)
      : v.name;
    const previous = grouped.get(id);
    if (previous) {
      previous.volumeUsd += v.volumeUsd;
      previous.pairs += v.pairs;
      previous.members.push(v);
    } else grouped.set(id, { ...v, id, name, members: [v] });
  }
  return [...grouped.values()].sort((a, b) => b.volumeUsd - a.volumeUsd);
}

export function MarketAnalysis({ initial }: { initial: MarketDashboard }) {
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(false),
    [refreshFailed, setRefreshFailed] = useState(false);
  const request = useRef<AbortController | null>(null);
  const [holderFilter, setHolderFilter] = useState<
    "all" | "whales" | HolderKind
  >("cex");
  const [whaleLimit, setWhaleLimit] = useState(8);
  const [query, setQuery] = useState("");
  const [venueFilter, setVenueFilter] = useState<"all" | "cex" | "dex">("dex");
  const [allVenues, setAllVenues] = useState(false);
  const [allTokens, setAllTokens] = useState(false);
  const [activeSection, setActiveSection] = useState("volume");
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    let frame = 0;
    const updateSection = () => {
      frame = 0;
      const boundary =
        (navigation.current?.getBoundingClientRect().bottom ?? 100) + 36;
      let current = sections[0].id;
      for (const section of sections) {
        const heading = document.getElementById(section.id);
        if (heading && heading.getBoundingClientRect().top <= boundary)
          current = section.id;
      }
      setActiveSection(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(updateSection);
    };
    updateSection();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, []);
  const refresh = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setRefreshing(true);
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const r = await fetch("/api/markets", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!r.ok) throw Error();
      setData(await r.json());
      setRefreshFailed(false);
    } catch {
      setRefreshFailed(true);
    } finally {
      clearTimeout(timeout);
      request.current = null;
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5 * 60_000);
    return () => {
      clearInterval(timer);
      request.current?.abort();
    };
  }, [refresh]);
  const m = data.metrics,
    supply = data.supply.data;
  const holders = data.holdings.data?.holders ?? [];
  const cexHolders = holders.filter((h) => h.kind === "cex");
  const cexBalance = cexHolders.some((h) => h.zec !== null)
    ? cexHolders.reduce((sum, h) => sum + (h.zec ?? 0), 0)
    : null;
  const share = (n: number | null) =>
    supply && n !== null ? (n / supply.zec) * 100 : null;
  const holdingShare = (n: number | null) =>
    data.holdingsConsistent ? share(n) : null;
  const holderRows =
    holderFilter === "whales"
      ? (data.holdings.data?.largeAddresses ?? []).map((a) => ({
          id: a.address,
          name: a.label?.label ?? "Unlabeled address",
          kind: a.label ? holderIdentity(a.label).kind : ("other" as const),
          zec: a.zec,
          missing: 0,
          addresses: [
            {
              ...(a.label ?? {
                address: a.address,
                label: "Unlabeled address",
                category: "unknown",
                verified: false,
              }),
              zec: a.zec,
              source: a.source,
            },
          ],
        }))
      : holders;
  const filteredHolders = holderRows.filter(
    (h) =>
      (holderFilter === "all" ||
        holderFilter === "whales" ||
        h.kind === holderFilter) &&
      `${h.name} ${h.addresses.map((a) => `${a.label} ${a.address}`).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const largest = Math.max(1, ...filteredHolders.map((h) => h.zec ?? 0));
  const shownHolders =
    holderFilter === "whales"
      ? filteredHolders.slice(0, whaleLimit)
      : filteredHolders;
  const rows = leaderboard(data.venues).filter(
    (v) => venueFilter === "all" || v.kind === venueFilter,
  );
  const shownRows = allVenues ? rows : rows.slice(0, 8);
  const milestones = m
    ? [10, 25, 50].map((target) => dexMilestone(m.cex, m.dex, target))
    : [];
  const near = data.nearActivity.data,
    maya = data.venues.find((v) => v.id === "maya");
  const chainVolume = (chain: string) => {
    const vs = data.venues.filter((v) => v.id.startsWith(`wrapped-${chain}-`));
    return vs.length ? vs.reduce((s, v) => s + v.volumeUsd, 0) : null;
  };
  const cb = data.wrapped.find((w) => w.asset.id === "cbzec-base");
  const solana = data.wrapped.filter((w) => w.asset.chain === "solana");
  const solSupply = solana.every((w) => w.supply.data && !w.supply.stale)
    ? solana.reduce((s, w) => s + (w.supply.data?.zec ?? 0), 0)
    : null;
  const featured = [
    {
      name: "Solana",
      value: chainVolume("solana"),
      label: "Spot volume · 24h",
      detail:
        solSupply === null
          ? "3 registered ZEC mints"
          : `${compact(solSupply, 2)} ZEC issued · 3 mints`,
      href: "#crosschain",
    },
    {
      name: "NEAR Intents",
      value: near && !data.nearActivity.stale ? near.volumeUsd : null,
      label: "Intent volume · 24h",
      detail: near
        ? `${usd(near.volume30dUsd)} / 30d · outside spot total${data.nearActivity.stale ? " · saved" : ""}`
        : "ZEC token feed unavailable",
      href: "#near-detail",
    },
    {
      name: "Maya",
      value: maya?.volumeUsd ?? null,
      label: "ZEC swaps · 24h",
      detail: data.mayaHistory.data
        ? `${usd(data.mayaHistory.data.volumeAllTimeUsd)} all-time${data.mayaHistory.stale ? " · saved" : ""}${data.mayaNetwork.data && !data.mayaNetwork.stale ? (data.mayaNetwork.data.paused ? " · trading paused" : "") : " · status unavailable"}`
        : "Native ZEC liquidity",
      href: "/zcg/investments",
    },
    {
      name: "Base",
      value: chainVolume("base"),
      label: "Spot volume · 24h",
      detail: cb?.supply.data
        ? `${compact(cb.supply.data.zec, 2)} cbZEC issued${cb.supply.stale ? " · saved" : ""}`
        : "cbZEC + Universal uZEC",
      href: "#crosschain",
    },
  ];
  const tokenRows = allTokens
    ? data.wrapped
    : data.wrapped.filter((w) =>
        ["base", "solana", "bsc"].includes(w.asset.chain),
      );
  const kaminoDeposits =
    data.kamino.data?.reserves.reduce((sum, r) => sum + r.zec, 0) ?? null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>
          <em>ZEC</em> Observatory
        </h1>
        <div className={styles.refresh}>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            aria-label={
              refreshing ? "Updating market data" : "Refresh market data"
            }
            aria-busy={refreshing}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={refreshing ? styles.spinning : undefined}
            >
              <path d="M20 7v5h-5M4 17v-5h5" />
              <path d="M6.1 7a7 7 0 0 1 11.7-1L20 9M4 15l2.2 3A7 7 0 0 0 17.9 17" />
            </svg>
            <span>{refreshing ? "Updating…" : "Refresh"}</span>
          </button>
          <span
            className={styles.refreshStatus}
            role="status"
            data-error={refreshFailed || undefined}
          >
            <i aria-hidden="true" />
            {refreshFailed ? "Refresh failed · saved data" : "Auto · 5 min"}
          </span>
        </div>
      </header>
      <nav
        ref={navigation}
        className={styles.jumpNav}
        aria-label="On this page"
      >
        {sections.map(({ id, label, Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            aria-current={activeSection === id ? "location" : undefined}
          >
            <Icon />
            <span>{label}</span>
          </a>
        ))}
      </nav>

      <section className={styles.mission} aria-labelledby="volume">
        <div className={styles.missionGrid}>
          <div className={styles.race}>
            <div className={styles.missionHeading}>
              <div>
                <h2 id="volume">Spot Volume</h2>
              </div>
              <span className={styles.pill}>24h · USD</span>
            </div>
            <div
              className={styles.bars}
              role="img"
              aria-label={
                m
                  ? `CEX ${pct(m.cexPct)}; DEX ${pct(m.dexPct)} of observed spot volume. Bars share the same scale. Intent routes are separate.`
                  : "Volume comparison unavailable"
              }
            >
              {[
                {
                  label: "CEX",
                  value: m?.cex,
                  percent: m?.cexPct,
                  tone: styles.cex,
                },
                {
                  label: "DEX",
                  value: m?.dex,
                  percent: m?.dexPct,
                  tone: styles.dex,
                },
              ].map((b) => (
                <div key={b.label} className={`${styles.barGroup} ${b.tone}`}>
                  <div className={styles.barLabel}>
                    <strong>{b.label}</strong>
                    <div>
                      <strong>
                        {b.value === undefined ? "—" : usd(b.value)}
                      </strong>
                      <span>{pct(b.percent ?? null)}</span>
                    </div>
                  </div>
                  <div className={styles.track}>
                    <div style={width(b.percent ?? 0)} />
                  </div>
                </div>
              ))}
            </div>
            <p className={styles.coverageLine}>
              <span
                className={
                  data.volumeComplete ? styles.goodDot : styles.warnDot
                }
              />
              {data.volumeComplete ? "Tracked feeds available" : "Partial data"}{" "}
              · Reported spot · Perpetuals excluded{" "}
              <a href="#methodology">Coverage ↗</a>
            </p>
          </div>
          <aside className={styles.target}>
            <span>DEX share · target &gt;50%</span>
            <strong className={styles.heroNumber}>
              {m ? number(m.dexPct) : "—"}
              <small>%</small>
            </strong>
            <div className={styles.goalTrack}>
              <div style={width(m ? m.dexPct * 2 : 0)} />
            </div>
            <div className={styles.gap}>
              <span>
                {m?.reached ? "DEX lead" : "Extra DEX volume to match CEX"}
              </span>
              <strong>
                {m ? usd(m.reached ? m.dex - m.cex : m.gap) : "—"}
                <small> / day</small>
              </strong>
              <span>CEX volume held constant</span>
            </div>
          </aside>
        </div>
        <details className={styles.milestones}>
          <summary>
            <span>Community mission · DEX &gt; CEX</span>
            <span>
              DEX / CEX <strong>{pct(m?.dexCexRatioPct ?? null)}</strong> · 100%
              at parity <b aria-hidden="true">＋</b>
            </span>
          </summary>
          <div className={styles.milestoneBody}>
            <p>
              Daily DEX volume needed for each milestone, holding today’s CEX
              volume constant.
            </p>
            {milestones.some(Boolean) ? (
              <table className={styles.milestoneTable}>
                <thead>
                  <tr>
                    <th scope="col">DEX share</th>
                    <th scope="col">DEX / day</th>
                    <th scope="col">Extra / day</th>
                    <th scope="col">From today</th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map(
                    (target) =>
                      target && (
                        <tr key={target.targetPct}>
                          <th scope="row">
                            {target.targetPct}%{" "}
                            {target.targetPct === 50 && <small>Parity</small>}
                          </th>
                          <td title={`$${number(target.requiredDex)}`}>
                            {usd(target.requiredDex)}
                          </td>
                          <td>
                            {target.achieved
                              ? "—"
                              : `+${usd(target.additionalDex)}`}
                          </td>
                          <td>
                            {target.achieved ? (
                              <span className={styles.successPill}>
                                Reached
                              </span>
                            ) : target.multiple === null ? (
                              "From zero"
                            ) : (
                              `${number(target.multiple, 1)}×`
                            )}
                          </td>
                        </tr>
                      ),
                  )}
                </tbody>
              </table>
            ) : (
              <p>
                {m?.cex === 0
                  ? "DEX already leads the observed spot market."
                  : "Both spot volume feeds are needed to calculate milestones."}
              </p>
            )}
            <div className={styles.milestoneFoot}>
              <span>
                <strong>50% share = 100% DEX/CEX.</strong> DEX leads above this
                point.
              </span>
              <a href="#methodology">How it’s calculated ↗</a>
            </div>
          </div>
        </details>
      </section>

      <div className={styles.featureGrid}>
        {featured.map((f) => (
          <a key={f.name} href={f.href} className={styles.feature}>
            <div className={styles.featureTitle}>
              <Logo name={f.name} />
              <strong>{f.name}</strong>
              <span aria-hidden="true">↗</span>
            </div>
            <span>{f.label}</span>
            <strong className={styles.featureNumber}>
              {f.value === null ? "—" : usd(f.value)}
            </strong>
            <small>{f.detail}</small>
          </a>
        ))}
      </div>

      <section className={styles.panel} aria-labelledby="trading">
        <div className={styles.panelHeader}>
          <Title
            id="trading"
            title="Where ZEC trades"
            caption="Chains combine their tracked DEX pools. Share uses the CEX + DEX total."
          />
          <div className={styles.filters} aria-label="Venue type">
            {(["dex", "cex", "all"] as const).map((f) => (
              <button
                key={f}
                aria-pressed={venueFilter === f}
                onClick={() => {
                  setVenueFilter(f);
                  setAllVenues(false);
                }}
              >
                {f === "all" ? "All" : f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.marketHead} aria-hidden="true">
          <span>Market / network</span>
          <span>Volume · 24h</span>
          <span>Share</span>
        </div>
        <div className={styles.marketList}>
          {shownRows.map((v, i) => (
            <details className={styles.marketRow} key={v.id}>
              <summary>
                <div className={styles.entity}>
                  <span className={styles.rank}>{i + 1}</span>
                  <Logo name={v.name} />
                  <div>
                    <strong>{v.name}</strong>
                    <small>
                      {v.id.startsWith("chain-")
                        ? `${v.members.length} DEX venues · ${v.pairs} pools`
                        : v.kind === "cex"
                          ? "Centralized spot"
                          : v.id === "near-intents"
                            ? "Cross-chain intents"
                            : "DEX spot"}
                    </small>
                  </div>
                </div>
                <strong>{usd(v.volumeUsd)}</strong>
                <span className={styles.marketShare}>
                  {pct(m ? (v.volumeUsd / m.total) * 100 : null)}
                  <span aria-hidden="true">＋</span>
                </span>
              </summary>
              <div className={styles.marketSources}>
                {v.members.map((member) => (
                  <div key={member.id}>
                    <div className={styles.entity}>
                      <Logo name={member.name} />
                      <div>
                        <Out href={member.source}>{member.name}</Out>
                        <small>{stamp(member.asOf)}</small>
                      </div>
                    </div>
                    <div className={styles.marketAmounts}>
                      <span>
                        <small>Volume · 24h</small>
                        <strong>{usd(member.volumeUsd)}</strong>
                      </span>
                      {member.id.startsWith("wrapped-") && (
                        <span>
                          <small>Pool liquidity</small>
                          <strong>
                            {member.liquidityUsd == null
                              ? "—"
                              : usd(member.liquidityUsd)}
                          </strong>
                        </span>
                      )}
                    </div>
                    <p>{member.note}</p>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
        {rows.length === 0 && (
          <p className={styles.empty}>No current data for this selection.</p>
        )}
        {rows.length > 8 && (
          <button
            className={styles.showMore}
            onClick={() => setAllVenues((v) => !v)}
          >
            {allVenues ? "Show fewer" : `View all ${rows.length} markets`}{" "}
            <span aria-hidden="true">↓</span>
          </button>
        )}
        <p className={styles.panelFoot}>
          Spot execution only. NEAR Intents activity is shown separately below.
        </p>
      </section>

      <details id="near-detail" className={styles.nearDetails}>
        <summary>
          <span className={styles.entity}>
            <Logo name="NEAR" />
            <strong>NEAR Intents · public & confidential</strong>
          </span>
          <span>
            {near ? `${usd(near.volumeUsd)} / 24h` : "ZEC activity"}{" "}
            <b aria-hidden="true">＋</b>
          </span>
        </summary>
        <div className={styles.nearBody}>
          <p className={styles.routingNote}>
            Intent routes · outside the spot total. The underlying trades may
            already appear in DEX volume.
          </p>
          <div className={styles.miniStats}>
            {[
              { label: "ZEC · 24 hours", value: near?.volumeUsd },
              { label: "ZEC · 30 days", value: near?.volume30dUsd },
              { label: "ZEC · all-time", value: near?.volumeAllTimeUsd },
            ].map((n) => (
              <div key={n.label}>
                <span>{n.label}</span>
                <strong>{n.value === undefined ? "—" : usd(n.value)}</strong>
              </div>
            ))}
          </div>
          <p>
            <Out href="https://explorer.near-intents.org/?toTokenId=nep141%3Azec.omft.near">
              ZEC explorer
            </Out>{" "}
            · {stamp(near?.asOf ?? null)}
            {data.nearActivity.stale && near ? " · saved snapshot" : ""}.{" "}
            {data.nearProtocol.data
              ? `The explorer’s ${usd(data.nearProtocol.data.volumeUsd)} headline includes all assets.`
              : "The explorer homepage includes all assets."}
          </p>
          <div className={styles.confidential}>
            <div>
              <span>Illustrative TVL · all assets</span>
              <strong>
                {data.nearConfidential.data
                  ? usd(data.nearConfidential.data.tvlUsd)
                  : "—"}
              </strong>
              <small>
                {data.nearConfidential.data
                  ? stamp(data.nearConfidential.data.asOf, true)
                  : "Unavailable"}
                {data.nearConfidential.stale && data.nearConfidential.data
                  ? " · saved"
                  : ""}
              </small>
            </div>
            <p>
              The publisher marks these figures as illustrative. A separate ZEC
              confidential volume total is not publicly disclosed; this TVL is
              outside the benchmark.{" "}
              <Out href="https://revenue.near.org/">TVL source</Out> ·{" "}
              <Out href="https://intents.near.org/confidential">
                How it works
              </Out>
            </p>
          </div>
        </div>
      </details>

      <section aria-labelledby="crosschain">
        <Title
          id="crosschain"
          title="ZEC across chains"
          caption="Verified token identities. Issued tokens represent existing ZEC; they do not increase native supply."
        />
        <div className={styles.panel}>
          <div className={styles.tokenHead} aria-hidden="true">
            <span>Token / issuer</span>
            <span>Network</span>
            <span>Issued supply</span>
            <span>Spot volume · 24h</span>
          </div>
          {tokenRows.map((w) => (
            <details key={w.asset.id} className={styles.tokenRow}>
              <summary>
                <div className={styles.entity}>
                  <Logo name={w.asset.issuer} />
                  <div>
                    <strong>{w.asset.symbol}</strong>
                    <small>{w.asset.issuer}</small>
                  </div>
                </div>
                <span className={styles.network}>
                  <Logo name={w.asset.chainName} />
                  {w.asset.chainName}
                </span>
                <div className={styles.tokenValue}>
                  <strong>
                    {w.supply.data ? number(w.supply.data.zec) : "—"}
                  </strong>
                  <small>
                    {w.supply.stale && w.supply.data
                      ? "Saved supply"
                      : w.supply.data
                        ? "ZEC represented"
                        : "Not verified"}
                  </small>
                </div>
                <div className={styles.tokenValue}>
                  <strong>
                    {w.volumeUsd === null ? "—" : usd(w.volumeUsd)}
                  </strong>
                  <small>
                    {!w.feed.data || w.feed.stale
                      ? "Feed unavailable"
                      : w.feed.data.pools.length === 0
                        ? "No indexed pool"
                        : `${w.feed.data.pools.length} pools${w.feed.data.partial ? " · partial coverage" : ""}`}
                  </small>
                </div>
              </summary>
              <div className={styles.tokenDetail}>
                <div>
                  <span>Exact contract / mint</span>
                  <Out href={w.asset.explorer + w.asset.token}>
                    <code>{w.asset.token}</code>
                  </Out>
                </div>
                <div>
                  <Out href={w.asset.registry}>Issuer registry</Out>
                  {w.supply.data && (
                    <span>
                      Block / slot {w.supply.data.block} ·{" "}
                      {stamp(w.supply.fetchedAt)}
                    </span>
                  )}
                </div>
                <p>
                  {w.supply.data
                    ? `${pct(share(w.supply.data.zec))} of native ZEC supply represented. `
                    : ""}
                  Token supply is not an independent backing audit. Pool
                  coverage is limited to the indexers’ returned markets.
                </p>
              </div>
            </details>
          ))}
          <button
            className={styles.showMore}
            onClick={() => setAllTokens((v) => !v)}
          >
            {allTokens
              ? "Show main networks"
              : `Explore all ${data.wrapped.length} registered tokens · ${new Set(data.wrapped.map((w) => w.asset.chain)).size} networks`}{" "}
            <span aria-hidden="true">↓</span>
          </button>
          <div className={styles.lending}>
            <div className={styles.entity}>
              <Logo name="Kamino" />
              <div>
                <strong>Kamino · ZEC deposits</strong>
                <small>OmniBridge ZEC · Solana lending</small>
              </div>
            </div>
            <div>
              <strong>
                {kaminoDeposits === null
                  ? "—"
                  : `${number(kaminoDeposits)} ZEC`}
              </strong>
              <small>
                {data.kamino.stale
                  ? "Saved / unavailable"
                  : "Included in issued supply above"}
              </small>
            </div>
            <Out href="https://api.kamino.finance/markets/collateral-reserves">
              Verify
            </Out>
          </div>
          <details className={styles.legacyContract}>
            <summary>
              <strong>Solana contract archive</strong>
              <span>renZEC · legacy ＋</span>
            </summary>
            <p>
              Ren 1.0 was sunset. This issuer-published mint is retained for
              completeness and excluded from current ZEC trading and
              represented-supply totals.
            </p>
            <p>
              <Out href="https://explorer.solana.com/address/E99CQ2gFMmbiyK2bwiaFNWUUmwz4r8k2CVEFxwuvQ7ue">
                <code>E99CQ2gFMmbiyK2bwiaFNWUUmwz4r8k2CVEFxwuvQ7ue</code>
              </Out>
            </p>
            <p>
              On-chain tokens:{" "}
              <strong>
                {data.legacySolana.data
                  ? number(data.legacySolana.data.zec, 8)
                  : "Unavailable"}{" "}
                renZEC
              </strong>{" "}
              · {stamp(data.legacySolana.fetchedAt)}
              {data.legacySolana.stale ? " · saved / unavailable" : ""}. Current
              redemption is not verified.
            </p>
            <p>
              <Out href="https://medium.com/renprotocol/renvm-integrates-with-solana-for-interoperability-cee10832356a">
                Original mint registry
              </Out>{" "}
              ·{" "}
              <Out href="https://medium.com/renprotocol/moving-on-from-alameda-da62a823ce93">
                Issuer sunset notice
              </Out>
            </p>
          </details>
          {!!data.kamino.data?.unidentified.length && (
            <p className={styles.scopeNote}>
              A new ZEC-labeled Kamino mint needs issuer verification and is not
              included yet.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="holdings">
        <Title
          id="holdings"
          title="Exchanges & large holders"
          caption="Public balances and CipherScan labels. Open any row to inspect its addresses."
        />
        <div className={styles.supplyStrip}>
          <div>
            <span>Known CEX balances</span>
            <strong>
              {cexBalance === null ? "—" : compact(cexBalance, 2)}{" "}
              <small>ZEC</small>
            </strong>
          </div>
          <div>
            <span>Share of native supply</span>
            <strong>{pct(holdingShare(cexBalance))}</strong>
          </div>
          <div>
            <span>Reconciled native supply</span>
            <strong>
              {supply ? compact(supply.zec, 3) : "—"} <small>ZEC</small>
            </strong>
          </div>
        </div>
        <p className={styles.scopeNote}>
          Observed minimum. Unlabeled and shielded balances cannot be assigned
          to an exchange.
        </p>
        <div className={styles.panel}>
          <div className={styles.rankControls}>
            <div className={styles.filters} aria-label="Balance category">
              {(
                [
                  { id: "cex", label: "CEX" },
                  { id: "dex", label: "DEX & bridges" },
                  { id: "whales", label: "Whales" },
                  { id: "all", label: "All labels" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  aria-pressed={holderFilter === f.id}
                  onClick={() => {
                    setHolderFilter(f.id);
                    setWhaleLimit(8);
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              aria-label="Search entities or addresses"
              placeholder="Find an exchange or address…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setWhaleLimit(8);
              }}
            />
          </div>
          {holderFilter === "whales" && (
            <p className={styles.whaleNote}>
              ≥10,000 ZEC per transparent address. One address is not
              necessarily one owner.
            </p>
          )}
          <div className={styles.holderHead} aria-hidden="true">
            <span>
              {holderFilter === "whales" ? "Address / public label" : "Entity"}
            </span>
            <span>Balance · ZEC</span>
            <span>% of supply</span>
          </div>
          {shownHolders.map((h, i) => (
            <details key={h.id} className={styles.holder}>
              <summary>
                <div className={styles.entity}>
                  <span className={styles.rank}>{i + 1}</span>
                  <Logo name={h.name} />
                  <div>
                    <strong>{h.name}</strong>
                    <small>
                      {holderFilter === "whales"
                        ? `${h.id.slice(0, 9)}…${h.id.slice(-7)}`
                        : `${h.addresses.length} ${h.addresses.length === 1 ? "address" : "addresses"}`}
                      {h.missing ? ` · ${h.missing} unavailable` : ""}
                    </small>
                  </div>
                </div>
                <div className={styles.holderValue}>
                  <strong>{h.zec === null ? "—" : number(h.zec)}</strong>
                  <div className={styles.miniTrack}>
                    <span style={width(((h.zec ?? 0) / largest) * 100)} />
                  </div>
                </div>
                <span className={styles.marketShare}>
                  {pct(holdingShare(h.zec))}
                  <span aria-hidden="true">＋</span>
                </span>
              </summary>
              <div className={styles.addressList}>
                <p>
                  {holderFilter === "whales"
                    ? "Address balance, not total wealth. No owner is inferred from transaction activity."
                    : `${kinds[h.kind]} · labels do not prove complete reserves or solvency.`}
                </p>
                {h.addresses.map((a) => (
                  <div key={a.address}>
                    <div>
                      <Out href={a.source}>
                        <code>{a.address}</code>
                      </Out>
                      <small>
                        {a.category === "unknown"
                          ? "No public ownership label"
                          : a.label + " · "}
                        {a.category === "unknown"
                          ? ""
                          : a.verified
                            ? "CipherScan verified label"
                            : "Unverified label"}
                      </small>
                    </div>
                    <strong>
                      {a.zec === null
                        ? "Unavailable"
                        : `${number(a.zec, 8)} ZEC`}
                    </strong>
                  </div>
                ))}
              </div>
            </details>
          ))}
          {filteredHolders.length === 0 && (
            <p className={styles.empty}>
              {data.holdings.data
                ? "No matching entities."
                : "Address balances unavailable."}
            </p>
          )}
          {holderFilter === "whales" &&
            shownHolders.length < filteredHolders.length && (
              <button
                className={styles.showMore}
                onClick={() => setWhaleLimit((n) => n + 20)}
              >
                Show more addresses · {shownHolders.length}/
                {filteredHolders.length} <span aria-hidden="true">↓</span>
              </button>
            )}
          <div className={styles.panelFoot}>
            <span>
              {data.holdings.data
                ? holderFilter === "whales"
                  ? `${data.holdings.data.largeAddresses.length} large addresses · top ${data.holdings.data.indexedAddresses} scanned`
                  : `${data.holdings.data.resolved}/${data.holdings.data.labelCount} labels resolved`
                : "Registry unavailable"}{" "}
              · {data.holdings.stale && data.holdings.data ? "Saved · " : ""}
              {stamp(data.holdings.fetchedAt)}
            </span>
            <Out href="https://cipherscan.app/rich-list">CipherScan</Out>
          </div>
        </div>
        {holderFilter === "dex" && data.mayaPoolZec !== null && (
          <p className={styles.scopeNote}>
            Maya pool depth: <strong>{number(data.mayaPoolZec)} ZEC</strong>.{" "}
            <Link href="/defi">Explore liquidity →</Link>
          </p>
        )}
      </section>

      <section aria-labelledby="funds">
        <Title
          id="funds"
          title="Funds & treasuries"
          caption="Issuer disclosures, with their original reporting dates. May overlap with exchange custody."
        />
        <div className={styles.fundGrid}>
          {data.disclosures.map(({ data: f, stale }) => (
            <article className={styles.fundCard} key={f.id}>
              <div className={styles.entity}>
                <Logo name={f.name} />
                <div>
                  <h3>{f.name.replace(" · The Zcash ETF", "")}</h3>
                  <small>
                    {f.ticker} · {f.kind === "fund" ? "Fund / ETP" : "Treasury"}
                  </small>
                </div>
              </div>
              <strong className={styles.fundNumber}>
                {compact(f.zec, 2)} <small>ZEC</small>
              </strong>
              <div className={styles.fundMeta}>
                <span>{pct(share(f.zec))} of supply</span>
                <span>{stamp(f.asOf, true)}</span>
              </div>
              <details>
                <summary>
                  Disclosure details <span aria-hidden="true">＋</span>
                </summary>
                <p>{f.method}</p>
                <p>Custody: {f.custody}</p>
                {f.id === "grayscale" &&
                  holders.some((h) => h.id === "grayscale") && (
                    <p>
                      Separately,{" "}
                      {number(
                        holders.find((h) => h.id === "grayscale")?.zec ?? 0,
                      )}{" "}
                      ZEC is visible in labeled addresses. This is a partial
                      view, not an additional holding.
                    </p>
                  )}
              </details>
              <footer>
                <Out href={f.source}>Issuer source</Out>
                {stale && <span>Saved disclosure</span>}
              </footer>
            </article>
          ))}
        </div>
      </section>

      <section
        className={styles.methodology}
        id="methodology"
        aria-label="Sources and methodology"
      >
        <details className={styles.sourceDetails}>
          <summary>
            <strong>Calculation & coverage</strong>
            <span>
              Inspect the methodology <b aria-hidden="true">＋</b>
            </span>
          </summary>
          <div className={styles.methodGrid}>
            <div>
              <h3>Native supply, reconciled</h3>
              <p>
                All CipherScan value pools must sum exactly in zatoshis,
                including the lockbox. Today’s on-chain supply is the
                denominator, not the 21 million maximum.
              </p>
              {supply && (
                <dl className={styles.poolList}>
                  {supply.pools.map((p) => (
                    <div key={p.id}>
                      <dt>{p.id}</dt>
                      <dd>{number(p.zec, 4)} ZEC</dd>
                    </div>
                  ))}
                  <div>
                    <dt>Total · block {number(supply.height, 0)}</dt>
                    <dd>{number(supply.zec, 8)} ZEC</dd>
                  </div>
                </dl>
              )}
              <p>
                {data.supply.stale && supply
                  ? "Saved snapshot · "
                  : "Snapshot · "}
                {stamp(data.supply.fetchedAt)}. This checks the node response’s
                consistency, not proof of reserves.{" "}
                <Out href="https://cipherscan.app/ironwood">
                  Ironwood tracker
                </Out>
                .
              </p>
              <h3>Holdings are not additive</h3>
              <p>
                Funds may use exchange custodians. Wrapped tokens represent
                already-issued native ZEC; Kamino deposits are part of token
                supply. Never add these categories into a new native supply
                total.
              </p>
            </div>
            <div>
              <h3>Observed activity, not the entire market</h3>
              <p>
                CEX uses reported spot markets; quotes older than two hours,
                derivatives, outliers and unknown classifications are excluded.
                Direct feeds replace the same aggregator venues. Provider USD
                conversions can differ; this is not a consolidated trade tape or
                an independent wash-trading audit. Shared Coinbase/Gemini quote
                books and verified HitBTC-family execution aliases count once.
              </p>
              <p>
                DEX includes registered ZEC tokens, native Maya swaps and Unit
                UZEC/USDC spot on Hyperliquid. ZEC perpetual contracts are
                derivatives and excluded from both sides. Pools are deduplicated
                by network and address, including pools containing two ZEC
                tokens. Solana is checked against DEX Screener and up to three
                pages per token on GeckoTerminal.
              </p>
              <p>
                NEAR Intents is a separate routing layer. Its ZEC volume stays
                visible without being added to the DEX venues that may execute
                those trades. These are reported volumes; provider windows and
                pool coverage can differ.
              </p>
              <h3>Share, ratio & milestones</h3>
              <p>
                DEX share is DEX ÷ (CEX + DEX); the DEX/CEX ratio is DEX ÷ CEX.
                At parity they read 50% and 100%, respectively. For target share
                q, required DEX volume is CEX × q ÷ (1 − q), with CEX held
                constant. These are volume targets, not forecasts.
              </p>
              <p>
                Definitions:{" "}
                <Out href="https://defillama.com/dexs">DefiLlama share</Out>
                {" · "}
                <Out href="https://www.theblock.co/data/decentralized-finance/dex-non-custodial/dex-to-cex-spot-trade-volume">
                  The Block ratio
                </Out>
                . This view uses rolling 24h observations; The Block’s chart
                uses monthly totals.
              </p>
              {data.rheaActivity.data && (
                <p>
                  Rhea’s ZEC pool is counted as DEX execution on NEAR.
                  {data.rheaActivity.stale
                    ? " Its saved reading is excluded from current totals."
                    : " The same venue is not added again from an aggregator feed."}
                </p>
              )}
              <h3>Token registry</h3>
              <p>
                Contracts are pinned to issuer records. Solana covers OmniBridge
                ZEC, Zenrock zenZEC and Universal uZEC. Kamino’s complete public
                collateral registry is checked for those mints; newly discovered
                ZEC-labeled mints are flagged for verification. An absence of
                indexed pools is not proof of no trading.
              </p>
              <p>
                Private ZEC volume, unlabeled wallets and undisclosed ownership
                cannot be quantified from public sources. No balance is inferred
                as zero when a source is missing.
              </p>
            </div>
          </div>
        </details>
        <details className={styles.sourceDetails}>
          <summary>
            <strong>Sources & exclusions</strong>
            <span>
              {data.sources.length} feeds <b aria-hidden="true">＋</b>
            </span>
          </summary>
          <div className={styles.sourceList}>
            {data.sources.map((s) => (
              <div key={s.name}>
                <div>
                  <Out href={s.url}>{s.name}</Out>
                  <p>{s.note}</p>
                </div>
                <div>
                  <span
                    className={
                      s.status === "current" ? styles.successPill : styles.pill
                    }
                  >
                    {
                      {
                        current: "Available",
                        saved: "Saved",
                        unavailable: "Unavailable",
                        "not-listed": "No indexed pool",
                        context: "Outside total",
                        partial: "Partial coverage",
                      }[s.status]
                    }
                  </span>
                  <small>{stamp(s.fetchedAt)}</small>
                </div>
              </div>
            ))}
          </div>
          {!!data.marketCoverage?.excluded.length && (
            <div className={styles.exclusions}>
              <h3>Excluded market quotes</h3>
              {data.marketCoverage.excluded.map((e, i) => (
                <p key={`${e.name}-${i}`}>
                  <strong>
                    {e.name} · {e.pair}
                  </strong>
                  <span>{e.reason}</span>
                </p>
              ))}
            </div>
          )}
        </details>
        <footer className={styles.pageFooter}>
          <span>{stamp(data.generatedAt)} · Public data</span>
          <Link href="/zcg/investments">Community investments →</Link>
        </footer>
      </section>
    </div>
  );
}
