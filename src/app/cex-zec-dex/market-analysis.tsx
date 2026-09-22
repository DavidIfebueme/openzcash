"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import type { MarketDashboard } from "@/lib/markets/sources";
import { simulateShift, type HolderKind } from "@/lib/markets/model";
import styles from "./markets.module.css";

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
    : "Not available";
}
const width = (value: number) =>
  ({ "--fill": `${Math.max(0, Math.min(100, value))}%` }) as CSSProperties;
const kinds: Record<HolderKind, string> = {
  cex: "Exchange / custody",
  dex: "DEX / bridge",
  fund: "Fund addresses",
  treasury: "Public treasury",
  other: "Other public label",
};
function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
      <span aria-hidden="true"> ↗</span>
    </a>
  );
}
function SectionTitle({
  id,
  step,
  title,
  description,
}: {
  id: string;
  step: string;
  title: string;
  description: string;
}) {
  return (
    <header className={styles.sectionTitle}>
      <div>
        <p className={styles.eyebrow}>{step}</p>
        <h2 id={id}>{title}</h2>
      </div>
      <p>{description}</p>
    </header>
  );
}

export function MarketAnalysis({ initial }: { initial: MarketDashboard }) {
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const request = useRef<AbortController | null>(null);
  const [holderFilter, setHolderFilter] = useState<"all" | HolderKind>("cex");
  const [query, setQuery] = useState("");
  const [venueFilter, setVenueFilter] = useState<"all" | "cex" | "dex">("all");
  const [migration, setMigration] = useState(0);
  const refresh = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setRefreshing(true);
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch("/api/markets", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Refresh failed");
      setData((await response.json()) as MarketDashboard);
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
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5 * 60_000);
    return () => {
      clearInterval(interval);
      request.current?.abort();
    };
  }, [refresh]);
  const m = data.metrics;
  const holders = data.holdings.data?.holders ?? [];
  const cexHolders = holders.filter((h) => h.kind === "cex");
  const cexBalance = cexHolders.reduce((n, h) => n + (h.zec ?? 0), 0);
  const hasCexBalance = cexHolders.some((h) => h.zec !== null);
  const supply = data.supply.data;
  const denominator = supply && data.holdingsConsistent ? supply.zec : null;
  const share = (n: number | null) =>
    denominator && n !== null ? (n / denominator) * 100 : null;
  const filteredHolders = holders.filter(
    (h) =>
      (holderFilter === "all" || h.kind === holderFilter) &&
      `${h.name} ${h.addresses.map((a) => `${a.label} ${a.address}`).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const largest = Math.max(1, ...filteredHolders.map((h) => h.zec ?? 0));
  const venues = data.venues.filter(
    (v) => venueFilter === "all" || v.kind === venueFilter,
  );
  const simulation = m ? simulateShift(m.cex, m.dex, migration) : null;
  const cexCount = data.venues.filter((v) => v.kind === "cex").length;
  const dexCount = data.venues.filter((v) => v.kind === "dex").length;
  const unmapped = data.venues.filter(
    (v) => v.kind === "cex" && !cexHolders.some((h) => h.id === v.id),
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Zcash market observatory</p>
          <h1>
            CEX <span className={styles.bracket}>&lt;</span>{" "}
            <span className={styles.zec}>ZEC</span>{" "}
            <span className={styles.bracket}>&gt;</span> DEX
          </h1>
          <p>
            Follow the volume. Understand the custody. Build the next chapter.
          </p>
        </div>
        <div className={styles.refresh}>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            <span aria-hidden="true">↻</span>{" "}
            {refreshing ? "Checking sources…" : "Refresh data"}
          </button>
          <span role="status">
            {refreshFailed
              ? "Refresh failed · showing previous data"
              : "Auto-checks every 5 min while open"}
          </span>
        </div>
      </header>
      <nav className={styles.jumpNav} aria-label="On this page">
        <a href="#volume">01 · The mission</a>
        <a href="#holdings">02 · Where ZEC sits</a>
        <a href="#funds">03 · Funds & treasuries</a>
        <a href="#methodology">04 · Verify the data</a>
      </nav>

      <section className={styles.mission} aria-labelledby="volume">
        <div className={styles.missionTop}>
          <p className={styles.eyebrow}>01 / The community mission</p>
          <span className={styles.window}>Rolling 24 hours · USD</span>
        </div>
        <div className={styles.missionGrid}>
          <div className={styles.race}>
            <h2 id="volume">
              When does DEX
              <br />
              overtake CEX?
            </h2>
            <p className={styles.intro}>
              The milestone is more than{" "}
              <strong>50% of observed trading activity</strong> on DEXs and
              intent protocols. Here is today’s distance.
            </p>
            <div
              className={styles.bars}
              role="img"
              aria-label={
                m
                  ? `Observed volume: CEX ${pct(m.cexPct)}, DEX and intents ${pct(m.dexPct)}. Both bars use the same total-volume scale.`
                  : "Volume comparison unavailable"
              }
            >
              {[
                {
                  label: "CEX",
                  desc: "Centralized spot markets",
                  value: m?.cex,
                  percent: m?.cexPct,
                  tone: styles.cex,
                },
                {
                  label: "DEX + intents",
                  desc: "Decentralized & cross-chain activity",
                  value: m?.dex,
                  percent: m?.dexPct,
                  tone: styles.dex,
                },
              ].map((b) => (
                <div key={b.label} className={`${styles.barGroup} ${b.tone}`}>
                  <div className={styles.barLabel}>
                    <div>
                      <strong>{b.label}</strong>
                      <span>{b.desc}</span>
                    </div>
                    <div>
                      <strong>
                        {b.value === undefined ? "—" : usd(b.value)}
                      </strong>
                      <span>{pct(b.percent ?? null)}</span>
                    </div>
                  </div>
                  <div className={styles.track}>
                    <div
                      className={styles.fill}
                      style={width(b.percent ?? 0)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.coverageLine}>
              <span
                className={
                  data.volumeComplete ? styles.goodDot : styles.warnDot
                }
              />
              <span>
                {cexCount} CEX · {dexCount} DEX / intent venues ·{" "}
                {data.volumeComplete
                  ? "Tracked feeds available"
                  : "Partial coverage · some feeds unavailable"}
              </span>
              <a href="#methodology">Coverage details ↗</a>
            </div>
          </div>
          <aside className={styles.target}>
            <p className={styles.eyebrow}>
              {m?.reached
                ? "Milestone reached in this sample"
                : "DEX share of observed volume"}
            </p>
            <div className={styles.heroNumber}>
              {m ? m.dexPct.toFixed(2) : "—"}
              <span>%</span>
            </div>
            <div className={styles.goalLine}>
              <span>Today</span>
              <strong>Goal &gt; 50%</strong>
            </div>
            <div className={styles.goalTrack}>
              <div style={width(m ? Math.min(100, m.dexPct * 2) : 0)} />
              <span />
            </div>
            <div className={styles.gap}>
              <span>
                {m?.reached ? "DEX lead" : "Additional DEX volume to match CEX"}
              </span>
              <strong>
                {m ? usd(m.reached ? m.dex - m.cex : m.gap) : "—"}
                <small> / day</small>
              </strong>
              <p>
                {m?.reached
                  ? "In the currently observed sources. Keep checking the coverage and timing."
                  : "If CEX volume stays at its current level. Exceed this amount to take the lead."}
              </p>
            </div>
            <div className={styles.targetFooter}>
              <span>DEX scale needed for parity</span>
              <strong>
                {m?.multiplier == null
                  ? "—"
                  : m.reached
                    ? "Already ahead"
                    : `${number(m.multiplier, 1)}×`}
              </strong>
            </div>
          </aside>
        </div>
        <div className={styles.readout}>
          <span className={styles.readoutMark}>↗</span>
          <p>
            {m ? (
              <>
                <strong>
                  {m.reached
                    ? "DEX leads the observed sample."
                    : m.tied
                      ? "The observed sample is at parity."
                      : `CEX still represents ${pct(m.cexPct)} of this sample.`}
                </strong>{" "}
                {m.gap > 0 && (
                  <>
                    At a constant combined volume, moving{" "}
                    <strong>{usd(m.shiftToParity)} per day</strong> from CEX to
                    DEX would bring both sides to parity.{" "}
                  </>
                )}
                This is a changing activity benchmark, not a forecast.{" "}
                {data.volumeComplete
                  ? "Source coverage is broader than any single protocol, but is not the entire market."
                  : "The displayed gap uses available feeds and may change materially when missing sources recover."}
              </>
            ) : (
              "A current comparison requires both CEX and DEX data. Missing volume is not treated as zero; check source health below."
            )}
          </p>
        </div>
      </section>

      <section
        className={styles.analysisGrid}
        aria-label="Explore the volume comparison"
      >
        <div className={styles.simulator}>
          <p className={styles.eyebrow}>Explore the path · scenario only</p>
          <h3>What if trading moved?</h3>
          <p>
            Shift part of today’s CEX volume to DEX. Total activity stays the
            same.
          </p>
          <div className={styles.sliderLabel}>
            <label htmlFor="migration">CEX volume moved</label>
            <output htmlFor="migration">{migration.toFixed(1)}%</output>
          </div>
          <input
            id="migration"
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={migration}
            disabled={!m}
            onChange={(e) => setMigration(Number(e.target.value))}
          />
          <div className={styles.sliderEnds}>
            <span>0%</span>
            <button
              type="button"
              disabled={!m}
              onClick={() =>
                setMigration(
                  m && m.cex > 0
                    ? Math.min(
                        100,
                        Math.ceil((m.shiftToParity / m.cex) * 1000) / 10 + 0.1,
                      )
                    : 0,
                )
              }
            >
              Find the crossover →
            </button>
            <span>100%</span>
          </div>
          <div className={styles.simResult} aria-live="polite">
            <div>
              <span>DEX share in this scenario</span>
              <strong>{pct(simulation?.dexPct ?? null)}</strong>
            </div>
            <span
              className={simulation?.reached ? styles.successPill : styles.pill}
            >
              {simulation?.reached
                ? "DEX takes the lead"
                : simulation?.tied
                  ? "At parity"
                  : "Below the milestone"}
            </span>
          </div>
        </div>
        <div className={styles.guide}>
          <p className={styles.eyebrow}>Read the comparison correctly</p>
          <h3>
            Activity and ownership
            <br />
            are different questions.
          </h3>
          <p>
            A coin can trade many times in a day. Volume measures activity;
            balances measure ZEC held at a point in time.
          </p>
          <div className={styles.guideRule} />
          <p>
            CEX numbers are venue-reported spot volume. DEX includes native and
            wrapped ZEC plus intent activity. Futures, ETF share trading and
            duplicated venue feeds stay outside the comparison.
          </p>
          <a href="#methodology">
            See the inclusion rules <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <details className={styles.venueDetails}>
        <summary>
          <span>Explore every trading venue</span>
          <span>
            {data.venues.length} included venues{" "}
            <span aria-hidden="true">＋</span>
          </span>
        </summary>
        <div className={styles.detailsBody}>
          <div className={styles.filters} aria-label="Venue type">
            {(["all", "cex", "dex"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={venueFilter === f}
                onClick={() => setVenueFilter(f)}
              >
                {f === "all" ? "All venues" : f.toUpperCase()}
              </button>
            ))}
          </div>
          <div className={styles.tableScroll}>
            <table>
              <caption>
                Rolling 24-hour activity · percentages of the included CEX + DEX
                total
              </caption>
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>24h volume</th>
                  <th>Share</th>
                  <th>Source time</th>
                </tr>
              </thead>
              <tbody>
                {venues.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Out href={v.source}>{v.name}</Out>
                      <small>
                        {v.kind.toUpperCase()} ·{" "}
                        {v.pairs
                          ? `${v.pairs} spot market${v.pairs > 1 ? "s" : ""}`
                          : "Token activity"}
                      </small>
                      <p>{v.note}</p>
                    </td>
                    <td>{usd(v.volumeUsd)}</td>
                    <td>{pct(m ? (v.volumeUsd / m.total) * 100 : null)}</td>
                    <td>{stamp(v.asOf)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.rheaContext && (
            <p className={styles.fine}>
              Rhea Finance additionally reports{" "}
              {usd(data.rheaContext.volumeUsd)} / 24h. Shown outside the
              headline because routing overlap with NEAR cannot be fully
              removed.
            </p>
          )}
        </div>
      </details>

      <section className={styles.holdingsSection} aria-labelledby="holdings">
        <SectionTitle
          id="holdings"
          step="02 / Where ZEC sits"
          title="The visible custody map."
          description="Ranked ZEC balances in publicly labeled addresses. Open a row to inspect every address behind the number."
        />
        <div className={styles.supplyStrip}>
          <div>
            <span>Known CEX / custody balances</span>
            <strong>
              {hasCexBalance ? compact(cexBalance, 2) : "—"} <small>ZEC</small>
            </strong>
            <p>
              {cexHolders.length} entities ·{" "}
              {cexHolders.reduce((s, h) => s + h.addresses.length, 0)} labeled
              addresses
            </p>
          </div>
          <div>
            <span>Share of on-chain supply</span>
            <strong>{pct(share(hasCexBalance ? cexBalance : null))}</strong>
            <p>Publicly observed minimum</p>
          </div>
          <div>
            <span>Reconciled on-chain supply</span>
            <strong>
              {supply ? compact(supply.zec, 3) : "—"} <small>ZEC</small>
            </strong>
            <p>
              {supply ? (
                <>
                  Block{" "}
                  <Out href={`https://cipherscan.app/block/${supply.height}`}>
                    {number(supply.height, 0)}
                  </Out>
                </>
              ) : (
                "Source unavailable"
              )}
            </p>
          </div>
        </div>
        <p className={styles.scopeNote}>
          <strong>
            These are visible balances, not full exchange reserves.
          </strong>{" "}
          Unlabeled and shielded holdings cannot be assigned to an owner.
          Custody addresses may hold customer or fund assets. A label does not
          establish solvency.
        </p>
        <div className={styles.holdingsPanel}>
          <div className={styles.rankControls}>
            <div className={styles.filters} aria-label="Balance category">
              {(
                [
                  { id: "cex", label: "CEX & custody" },
                  { id: "dex", label: "DEX & bridges" },
                  { id: "all", label: "All public labels" },
                ] as const
              ).map((f) => (
                <button
                  type="button"
                  key={f.id}
                  aria-pressed={holderFilter === f.id}
                  onClick={() => setHolderFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              aria-label="Search entities or addresses"
              placeholder="Find an entity or address…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className={styles.rankHead} aria-hidden="true">
            <span>Entity / address coverage</span>
            <span>Balance · ZEC</span>
            <span>% of supply</span>
            <span />
          </div>
          <div className={styles.ranking}>
            {filteredHolders.map((h, i) => (
              <details key={h.id} className={styles.holder}>
                <summary>
                  <div className={styles.entity}>
                    <span className={styles.rank}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <strong>{h.name}</strong>
                      <small>
                        {h.addresses.length} address
                        {h.addresses.length !== 1 ? "es" : ""} · {kinds[h.kind]}
                        {h.missing > 0 ? ` · ${h.missing} unavailable` : ""}
                      </small>
                    </span>
                  </div>
                  <div className={styles.holderValue}>
                    <strong>
                      {h.zec === null ? "Unavailable" : number(h.zec)}
                    </strong>
                    <div className={styles.miniTrack}>
                      <span style={width(((h.zec ?? 0) / largest) * 100)} />
                    </div>
                  </div>
                  <div className={styles.supplyPercent}>
                    {pct(share(h.zec))}
                  </div>
                  <span className={styles.plus} aria-hidden="true">
                    ＋
                  </span>
                </summary>
                <div className={styles.addressList}>
                  {h.addresses.map((a) => (
                    <div key={a.address}>
                      <div>
                        <Out href={a.source}>
                          <code>{a.address}</code>
                        </Out>
                        <small>
                          {a.label} ·{" "}
                          {a.verified
                            ? "Label marked verified by CipherScan"
                            : "Unverified source label"}
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
          </div>
          {filteredHolders.length === 0 && (
            <p className={styles.empty}>
              {data.holdings.data
                ? "No entities match this filter."
                : "Address balances are temporarily unavailable. No zero balances have been substituted."}
            </p>
          )}
          <footer className={styles.rankFooter}>
            <span>
              {data.holdings.data
                ? `${data.holdings.data.resolved} / ${data.holdings.data.labelCount} public labels resolved`
                : "Registry unavailable"}{" "}
              · {data.holdings.stale ? "Saved data · " : ""}
              {stamp(data.holdings.fetchedAt)}
              <br />
              Bars compare balances with the largest entity shown.
            </span>
            <Out href="https://cipherscan.app/rich-list">
              Explore CipherScan
            </Out>
          </footer>
        </div>
        {unmapped.length > 0 && (
          <details className={styles.unmapped}>
            <summary>
              {unmapped.length} trading venues without a matched public wallet{" "}
              <span aria-hidden="true">＋</span>
            </summary>
            <p>
              The volume source reports these venues, but CipherScan’s registry
              does not identify their ZEC wallets. Their balances are unknown,
              not zero.
            </p>
            <div>
              {unmapped.map((v) => (
                <span key={v.id}>{v.name}</span>
              ))}
            </div>
          </details>
        )}
        {holderFilter === "dex" && data.mayaPoolZec !== null && (
          <p className={styles.scopeNote}>
            Maya additionally reports{" "}
            <strong>{number(data.mayaPoolZec)} ZEC</strong> of pool depth. This
            protocol balance is shown separately from labeled bridge addresses.{" "}
            <Link href="/defi">Explore liquidity →</Link>
          </p>
        )}
      </section>

      <section aria-labelledby="funds">
        <SectionTitle
          id="funds"
          step="03 / Public institutional disclosures"
          title="Funds, ETPs & treasury holders."
          description="Issuer-reported ZEC, with an explicit reporting date. These positions may already sit inside the custodial addresses above."
        />
        <div className={styles.fundGrid}>
          {data.disclosures.map(({ data: f, stale }) => (
            <article key={f.id} className={styles.fundCard}>
              <div className={styles.fundTop}>
                <span className={styles.ticker}>{f.ticker}</span>
                <span className={styles.pill}>
                  {f.kind === "fund" ? "Fund / ETP" : "Company treasury"}
                </span>
              </div>
              <h3>{f.name}</h3>
              <strong className={styles.fundNumber}>
                {number(f.zec)} <small>ZEC</small>
              </strong>
              <div className={styles.fundMeta}>
                <span>{pct(share(f.zec))} of on-chain supply</span>
                <span>As of {stamp(f.asOf, true)}</span>
              </div>
              <p>{f.method}</p>
              <div className={styles.custody}>
                <span>Custody / attribution</span>
                <strong>{f.custody}</strong>
              </div>
              <footer>
                <Out href={f.source}>Issuer source</Out>
                {stale && <span>Saved disclosure</span>}
              </footer>
              {f.id === "grayscale" &&
                holders.find((h) => h.id === "grayscale") && (
                  <details className={styles.fundWallets}>
                    <summary>Compare with labeled addresses</summary>
                    <p>
                      {number(
                        holders.find((h) => h.id === "grayscale")!.zec ?? 0,
                      )}{" "}
                      ZEC visible in CipherScan’s Grayscale-labeled addresses.
                      This partial wallet view and the issuer’s total are
                      alternative evidence, not amounts to add.
                    </p>
                  </details>
                )}
            </article>
          ))}
        </div>
        <div className={styles.nonAdditive}>
          <span aria-hidden="true">≠</span>
          <p>
            <strong>Do not add these balances to exchange custody.</strong>{" "}
            Grayscale lists Coinbase Custody as its custodian. Without a
            complete ownership reconciliation, a combined “institutional +
            exchange” total would risk counting the same coins twice. An ETF
            filing or derivatives exposure alone does not verify any ZEC
            holdings.
          </p>
        </div>
      </section>

      <section className={styles.methodology} aria-labelledby="methodology">
        <SectionTitle
          id="methodology"
          step="04 / Open methodology"
          title="A number you can inspect."
          description="Sources, timestamps and exclusions travel with the analysis. Missing coverage remains visible."
        />
        <div className={styles.methodGrid}>
          <div>
            <h3>One denominator. All value pools.</h3>
            <p>
              Balance percentages use CipherScan’s mainnet{" "}
              <code>chainSupply</code>, including the lockbox. The value pools
              must sum exactly to that supply in zatoshis before the supply is
              accepted. The 21 million maximum is not used as today’s
              denominator.
            </p>
            {supply && (
              <dl className={styles.poolList}>
                {supply.pools.map((p) => (
                  <div key={p.id}>
                    <dt>{p.id}</dt>
                    <dd>{number(p.zec, 4)} ZEC</dd>
                  </div>
                ))}
                <div className={styles.poolTotal}>
                  <dt>Reconciled total</dt>
                  <dd>{number(supply.zec, 8)} ZEC</dd>
                </div>
              </dl>
            )}
            <p className={styles.fine}>
              {data.supply.stale
                ? "Saved node snapshot · "
                : "Node snapshot · "}
              {stamp(data.supply.fetchedAt)}. Reconciliation verifies internal
              consistency of the node response; it is not an independent reserve
              audit.
            </p>
          </div>
          <div>
            <h3>What this comparison includes.</h3>
            <ul>
              <li>
                Rolling 24-hour USD activity from the available sources.
                Provider timestamps differ; old CEX quotes over two hours are
                excluded.
              </li>
              <li>
                Spot CEX, verified Unit UZEC and Universal uZEC markets, Maya,
                and NEAR Intents’ ZEC token activity. NEAR is an intent
                protocol, not an AMM.
              </li>
              <li>
                Each venue is included once. Wallet interfaces are not added on
                top of their underlying protocol. Rhea is contextual because
                routing overlap is unresolved.
              </li>
              <li>
                Futures, perpetuals, ETF share turnover, outliers and unknown
                venue classifications are excluded. Reported volume is not
                independently audited for wash trading.
              </li>
              <li>
                All CipherScan labels are checked, including those outside the
                top 500. Grayscale and Unit labels are reclassified by economic
                role; original labels remain on each address.
              </li>
            </ul>
            <h3>Coverage has a boundary.</h3>
            <p>
              Public addresses and issuer disclosures cannot reveal every
              exchange wallet, private trade or shielded owner. This page tracks
              the identified public sources; it does not claim a complete global
              ownership census. Missing values stay unavailable, and saved
              disclosures keep their original dates.
            </p>
          </div>
        </div>
        <details className={styles.sourceDetails}>
          <summary>
            Source health & exclusions <span aria-hidden="true">＋</span>
          </summary>
          <div className={styles.detailsBody}>
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
                        s.status === "current"
                          ? styles.successPill
                          : styles.pill
                      }
                    >
                      {s.status === "current"
                        ? "Fetched"
                        : s.status === "not-listed"
                          ? "ZEC pool not listed"
                          : s.status === "context"
                            ? "Outside headline"
                            : s.status === "saved"
                              ? "Saved data"
                              : "Unavailable"}
                    </span>
                    <small>{stamp(s.fetchedAt)}</small>
                  </div>
                </div>
              ))}
            </div>
            {data.marketCoverage && (
              <>
                <h3>
                  {data.marketCoverage.included} of{" "}
                  {data.marketCoverage.received} returned markets included
                </h3>
                <div className={styles.tableScroll}>
                  <table>
                    <caption>Markets excluded by the stated rules</caption>
                    <thead>
                      <tr>
                        <th>Venue / pair</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.marketCoverage.excluded.map((e, i) => (
                        <tr key={`${e.name}-${e.pair}-${i}`}>
                          <td>
                            {e.name}
                            <small>{e.pair}</small>
                          </td>
                          <td>{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </details>
        <footer className={styles.pageFooter}>
          <span>
            Snapshot assembled {stamp(data.generatedAt)} · public data only
          </span>
          <a href="/api/markets" target="_blank" rel="noreferrer">
            Open the complete data · JSON ↗
          </a>
        </footer>
      </section>
    </div>
  );
}
