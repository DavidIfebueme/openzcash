import "server-only";
import { z } from "zod";
import { cachedFeed, type Feed } from "./cache";
import { PUBLIC_ADDRESS_ATTRIBUTIONS } from "./attributions";
import {
  parseKaminoRegistry,
  parseKaminoMetrics,
  LEGACY_SOLANA_ZEC,
  WRAPPED_ASSETS,
  parseWrappedPools,
  wrappedUrl,
  aggregateWrappedPools,
  resolveWrappedCoverage,
  readGeckoPoolCoverage,
  parseSolanaSupply,
  rpcHex,
  tokenUnits,
  type WrappedAsset,
  geckoPoolsUrl,
} from "./wrapped";
import {
  spotBenchmark,
  groupHolders,
  parseCustodyRegistry,
  parseAddressDetail,
  parseCypherpunk,
  parseGrayscale,
  parse21Shares,
  parseHyperliquid,
  parseMarkets,
  parseNearExplorer,
  parseNearConfidential,
  parseSupply,
  type AddressBalance,
  type Disclosure,
  type Venue,
} from "./model";
import {
  parseMayaHealth,
  parseMayaNetwork,
  mayaIndexCurrent,
  parseMayaPool,
  parseSwapSummary,
} from "@/lib/defi/maya-activity-model";

export const CIPHER = "https://api.mainnet.cipherscan.app";
export const NEAR_VOLUME =
  "https://explorer.near-intents.org/?toTokenId=nep141%3Azec.omft.near";
const PAPRIKA = "https://api.coinpaprika.com/v1";
const MAYA = "https://midgard.mayachain.info/v2";
const THOR = "https://gateway.liquify.com/chain/thorchain_midgard/v2";
const numeric = z
  .union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)])
  .transform(Number)
  .pipe(z.number().finite().nonnegative());
const iso = () => new Date().toISOString();

async function request(url: string, init?: RequestInit, timeoutMs = 12_000) {
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json,text/html",
      "User-Agent": "OpenZcash/1.0 (+https://openzcash.org)",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Public source unavailable");
  return res;
}
async function json(
  url: string,
  init?: RequestInit,
  timeoutMs?: number,
): Promise<unknown> {
  return (await request(url, init, timeoutMs)).json();
}
async function html(url: string): Promise<string> {
  return (await request(url)).text();
}

// Spread indexer requests across SSR/API bundles in the same server process.
// Fail a saturated queue rather than extending the page's wait indefinitely.
const geckoSchedule = globalThis as typeof globalThis & {
  __openZcashGeckoNext?: number;
};
async function geckoJson(url: string) {
  const now = Date.now();
  const start = Math.max(now, geckoSchedule.__openZcashGeckoNext ?? 0);
  if (start - now > 20_000) throw new Error("Pool indexer busy");
  geckoSchedule.__openZcashGeckoNext = start + 1_000;
  if (start > now)
    await new Promise((resolve) => setTimeout(resolve, start - now));
  return json(url);
}

const exchangeTypes = cachedFeed(
  () => json(`${PAPRIKA}/exchanges`),
  24 * 3_600_000,
);
const markets = cachedFeed(async () => {
  const [m, e] = await Promise.all([
    json(`${PAPRIKA}/coins/zec-zcash/markets`),
    exchangeTypes(),
  ]);
  if (!e.data || e.stale) throw new Error("Venue classification unavailable");
  return parseMarkets(m, e.data, Date.now());
});
const supply = cachedFeed(async () =>
  parseSupply(await json(`${CIPHER}/api/blockchain-info`)),
);
const holdings = cachedFeed(async () => {
  const [labelRaw, richRaw] = await Promise.all([
    json(`${CIPHER}/api/labels`),
    json(`${CIPHER}/api/rich-list?limit=500`),
  ]);
  const registry = parseCustodyRegistry(labelRaw, richRaw, PUBLIC_ADDRESS_ATTRIBUTIONS);
  const { labels, balances } = registry;
  const missing = labels.filter((a) => !balances.has(a.address));
  const deadline = Date.now() + 30_000;
  // Include the ENTIRE registry, including labels outside the top 500 and zero
  // balances. Bound concurrency so a refresh is gentle on the public explorer.
  for (let i = 0; i < missing.length && Date.now() < deadline; i += 3)
    await Promise.all(
      missing.slice(i, i + 3).map(async (a) => {
        try {
          balances.set(
            a.address,
            parseAddressDetail(
              await json(
                `${CIPHER}/api/address/${a.address}?limit=1`,
                undefined,
                Math.max(1, deadline - Date.now()),
              ),
              a.address,
            ),
          );
        } catch {
          /* Display unavailable, never infer a zero from absence. */
        }
      }),
    );
  const addresses: AddressBalance[] = labels.map((a) => ({
    ...a,
    zec: balances.get(a.address) ?? null,
    source: `https://cipherscan.app/address/${a.address}`,
  }));
  return {
    holders: groupHolders(addresses),
    labelCount: labels.length,
    cipherLabelCount: registry.cipherLabelCount,
    publicLabelCount: registry.publicLabelCount,
    resolved: addresses.filter((a) => a.zec !== null).length,
    largeAddresses: registry.addresses.filter((a) => a.zec >= 10_000),
    indexedAddresses: registry.addresses.length,
    largeAddressThreshold: 10_000,
    indexedZec: registry.addresses.reduce((sum, a) => sum + a.zec, 0),
  };
}, 10 * 60_000);

const near = cachedFeed(async () => {
  const n = parseNearExplorer(await html(NEAR_VOLUME), Date.now());
  return {
    ...n,
    id: "near-intents",
    name: "NEAR Intents",
    kind: "dex" as const,
    role: "routing" as const,
    volumeUsd: n.volumeUsd,
    pairs: 0,
    asOf: n.asOf,
    source: NEAR_VOLUME,
    note: "Public explorer's ZEC token volume, counted once. Includes intent-based cross-chain activity; not total NEAR protocol volume.",
  };
});
const hyper = cachedFeed(async (): Promise<Venue> => {
  const h = parseHyperliquid(
    await json("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "spotMetaAndAssetCtxs" }),
    }),
  );
  return {
    id: "hyperliquid",
    name: "Hyperliquid · UZEC",
    kind: "dex",
    volumeUsd: h.volumeUsd,
    pairs: 1,
    asOf: iso(),
    source: "https://app.hyperliquid.xyz/trade/UZEC/USDC",
    note: "Verified Unit Zcash / USDC spot market. USDC notional treated as USD. Perpetual futures and unrelated ZEC-named tokens excluded.",
  };
});
const nearConfidential = cachedFeed(
  async () =>
    parseNearConfidential(await html("https://revenue.near.org/"), Date.now()),
  3_600_000,
);
const nearTotal = cachedFeed(async () =>
  parseNearExplorer(
    await html("https://explorer.near-intents.org/"),
    Date.now(),
    "all",
  ),
);
async function rpc(asset: WrappedAsset, method: string, params: unknown[]) {
  if (!asset.rpc)
    throw new Error("Supply reader not available for this network");
  return json(asset.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
}
const wrappedFeeds = WRAPPED_ASSETS.map((asset) => ({
  asset,
  read: cachedFeed(
    async () => {
      const asOf = iso();
      const reads = await Promise.allSettled([
        json(wrappedUrl(asset)).then((raw) => {
          const pools = parseWrappedPools(raw, asset, asOf);
          // The endpoint returns at most 30 pools; a full page may be truncated.
          return {
            pools,
            partial: Array.isArray(raw) && raw.length >= 30,
            limited: Array.isArray(raw) && raw.length >= 30,
            failedSources: 0,
          };
        }),
        ...(["solana", "base", "bsc"].includes(asset.chain)
          ? [
              readGeckoPoolCoverage(
                asset,
                (page) => geckoJson(geckoPoolsUrl(asset, page)),
                asOf,
              ),
            ]
          : []),
      ]);
      return resolveWrappedCoverage(reads);
    },
    5 * 60_000,
    (coverage) => coverage.failedSources > 0,
  ),
  supply: cachedFeed(async () => {
    if (asset.chain === "solana")
      return parseSolanaSupply(
        await rpc(asset, "getTokenSupply", [
          asset.token,
          { commitment: "finalized" },
        ]),
      );
    // Pin both ERC-20 reads to the same block, and verify the network.
    const [chain, blockRaw] = await Promise.all([
      rpc(asset, "eth_chainId", []),
      rpc(asset, "eth_blockNumber", []),
    ]);
    if (Number(BigInt(rpcHex(chain))) !== asset.chainId)
      throw new Error("Wrong RPC network");
    const block = rpcHex(blockRaw);
    const [total, decimals] = await Promise.all(
      ["0x18160ddd", "0x313ce567"].map((data) =>
        rpc(asset, "eth_call", [{ to: asset.token, data }, block]),
      ),
    );
    return {
      zec: tokenUnits(
        BigInt(rpcHex(total)).toString(),
        Number(BigInt(rpcHex(decimals))),
      ),
      block: BigInt(block).toString(),
    };
  }, 10 * 60_000),
}));
const legacySolana = cachedFeed(
  async () => ({
    asset: LEGACY_SOLANA_ZEC,
    ...parseSolanaSupply(
      await rpc(LEGACY_SOLANA_ZEC, "getTokenSupply", [
        LEGACY_SOLANA_ZEC.token,
        { commitment: "finalized" },
      ]),
    ),
  }),
  10 * 60_000,
);
const kamino = cachedFeed(async () => {
  const { reserves, unidentified } = parseKaminoRegistry(
    await json("https://api.kamino.finance/markets/collateral-reserves"),
  );
  const all = await Promise.all(
    [...new Set(reserves.map((r) => r.lendingMarket))].map(async (market) =>
      parseKaminoMetrics(
        await json(
          `https://api.kamino.finance/kamino-market/${market}/reserves/metrics`,
        ),
        reserves.filter((r) => r.lendingMarket === market),
      ),
    ),
  );
  return { reserves: all.flat(), unidentified };
}, 10 * 60_000);
const mayaHistory = cachedFeed(async () => {
  const to = Math.floor(Date.now() / 1000);
  const [all, month] = await Promise.all([
    json(`${MAYA}/history/swaps?pool=ZEC.ZEC`),
    json(`${MAYA}/history/swaps?pool=ZEC.ZEC&from=${to - 30 * 86400}&to=${to}`),
  ]);
  const allTime = parseSwapSummary(all),
    last30d = parseSwapSummary(month);
  if (!allTime || !last30d || Math.abs(last30d.to - to) > 120)
    throw new Error("Maya history unavailable");
  return {
    volumeAllTimeUsd: allTime.volumeUsd,
    volume30dUsd: last30d.volumeUsd,
  };
});
const MAYA_NETWORK =
  "https://mayanode.mayachain.info/mayachain/inbound_addresses";
const mayaNetwork = cachedFeed(async () =>
  parseMayaNetwork(await json(MAYA_NETWORK)),
);
const maya = cachedFeed(async () => {
  const to = Math.floor(Date.now() / 1000);
  const from = to - 86400;
  const url = `${MAYA}/history/swaps?pool=ZEC.ZEC&from=${from}&to=${to}`;
  const [raw, poolRaw, healthRaw] = await Promise.all([
    json(url),
    json(`${MAYA}/pool/ZEC.ZEC`),
    json(`${MAYA}/health`),
  ]);
  const s = parseSwapSummary(raw);
  const p = parseMayaPool(poolRaw);
  const h = parseMayaHealth(healthRaw);
  if (
    !s ||
    !p ||
    !mayaIndexCurrent(h, Date.now()) ||
    Math.abs(s.from - from) > 120 ||
    Math.abs(s.to - to) > 120
  )
    throw new Error("Maya window not verified");
  const venue: Venue = {
    id: "maya",
    name: "Maya Protocol",
    kind: "dex",
    volumeUsd: s.volumeUsd,
    pairs: 1,
    asOf: new Date(s.to * 1000).toISOString(),
    source: url,
    note: "ZEC pool swaps, including trade and synth assets. Midgard USD cents converted to dollars. Zero is a reported value.",
  };
  return { venue, zec: p.zec, status: p.status };
});
const thor = cachedFeed(async () => {
  const pools = z
    .array(z.object({ asset: z.string(), assetDepth: numeric }))
    .parse(await json(`${THOR}/pools`));
  const pool = pools.find((p) => p.asset === "ZEC.ZEC");
  if (!pool) return { venue: null, listed: false, zec: null };
  const to = Math.floor(Date.now() / 1000);
  const from = to - 86400;
  const url = `${THOR}/history/swaps?pool=ZEC.ZEC&from=${from}&to=${to}`;
  const s = parseSwapSummary(await json(url));
  if (!s || Math.abs(s.to - to) > 120 || Math.abs(s.from - from) > 120)
    throw new Error("THORChain window unavailable");
  const venue: Venue = {
    id: "thorchain",
    name: "THORChain",
    kind: "dex",
    volumeUsd: s.volumeUsd,
    pairs: 1,
    asOf: new Date(s.to * 1000).toISOString(),
    source: url,
    note: "Direct ZEC pool volume; counted once at protocol level.",
  };
  return { venue, listed: true, zec: pool.assetDepth / 1e8 };
});
const rhea = cachedFeed(async () => {
  const raw = await json(
    "https://api.geckoterminal.com/api/v2/networks/near/pools/refv1-6065",
  );
  const p = z
    .object({
      data: z.object({
        attributes: z.object({
          address: z.literal("refv1-6065"),
          volume_usd: z.object({ h24: numeric }),
        }),
        relationships: z.object({
          base_token: z.object({
            data: z.object({ id: z.literal("near_zec.omft.near") }),
          }),
        }),
      }),
    })
    .parse(raw);
  return {
    id: "rhea-finance",
    name: "Rhea Finance · NEAR",
    kind: "dex" as const,
    volumeUsd: p.data.attributes.volume_usd.h24,
    pairs: 1,
    asOf: iso(),
    source: "https://www.geckoterminal.com/near/pools/refv1-6065",
    note: "ZEC omft pool execution on NEAR. Exact pool and token identity verified; routed NEAR Intents volume is not added.",
  };
});
const cypherpunk = cachedFeed(
  async () => parseCypherpunk(await html("https://www.cypherpunk.com/")),
  3_600_000,
);
const shares21 = cachedFeed(
  async () =>
    parse21Shares(
      await json("https://api.primary.21shares.com/api/product_details/ZCASH"),
    ),
  3_600_000,
);
const grayscale = cachedFeed(
  async () => parseGrayscale(await html("https://www.thezcashetf.com/")),
  3_600_000,
);

// An explicitly dated issuer disclosure, not a fabricated live quote. Used
// only when the issuer's public page is blocked or changes its HTML contract.
const GRAYSCALE_DISCLOSURE: Disclosure = {
  id: "grayscale",
  name: "Grayscale · The Zcash ETF",
  ticker: "ZCSH",
  kind: "fund",
  zec: 464514.8551,
  asOf: "2026-09-08",
  source: "https://www.thezcashetf.com/",
  custody: "Coinbase Custody",
  method:
    "Issuer's dated Total ZEC in Fund disclosure, checked September 22, 2026. Successor to Zcash Trust; not an additional holding. Live retrieval is currently unavailable.",
};

export type SourceStatus = {
  name: string;
  status:
    | "current"
    | "saved"
    | "unavailable"
    | "not-listed"
    | "context"
    | "partial";
  url: string;
  fetchedAt: string | null;
  note: string;
};
function status<T>(
  name: string,
  url: string,
  feed: Feed<T>,
  note: string,
): SourceStatus {
  return {
    name,
    url,
    status:
      feed.data === null ? "unavailable" : feed.stale ? "saved" : "current",
    fetchedAt: feed.fetchedAt,
    note,
  };
}

async function collectMarketDashboard() {
  const [
    m,
    s,
    h,
    n,
    hy,
    ma,
    th,
    rh,
    cp,
    etp,
    gray,
    wrapped,
    nc,
    nt,
    mh,
    ka,
    legacy,
    mn,
  ] = await Promise.all([
    markets(),
    supply(),
    holdings(),
    near(),
    hyper(),
    maya(),
    thor(),
    rhea(),
    cypherpunk(),
    shares21(),
    grayscale(),
    Promise.all(
      wrappedFeeds.map(async ({ asset, read, supply }) => {
        const [feed, balance] = await Promise.all([read(), supply()]);
        return { asset, feed, supply: balance };
      }),
    ),
    nearConfidential(),
    nearTotal(),
    mayaHistory(),
    kamino(),
    legacySolana(),
    mayaNetwork(),
  ]);
  // A failed or stale volume source stays visible in coverage but cannot
  // silently enter a rolling-day comparison alongside fresh numbers.
  const tracked = m.data && !m.stale ? [...m.data.venues] : [];
  for (const feed of [n, hy])
    if (feed.data && !feed.stale) tracked.push(feed.data);
  if (ma.data && !ma.stale) tracked.push(ma.data.venue);
  if (th.data?.venue && !th.stale) tracked.push(th.data.venue);
  if (rh.data && !rh.stale) tracked.push(rh.data);
  const wrappedMarkets = aggregateWrappedPools(
    wrapped.flatMap(({ feed }) =>
      feed.data && !feed.stale ? feed.data.pools : [],
    ),
  );
  tracked.push(...wrappedMarkets.venues);
  const { venues, metrics } = spotBenchmark(tracked);
  venues.sort((a, b) => b.volumeUsd - a.volumeUsd);
  const volumeComplete =
    ![m, hy, ma, th, rh, ...wrapped.map((u) => u.feed)].some(
      (f) => f.stale || !f.data,
    ) && !wrapped.some((w) => w.feed.data?.partial);
  const sourceStatuses: SourceStatus[] = [
    status(
      "renZEC · legacy Solana mint",
      LEGACY_SOLANA_ZEC.explorer + LEGACY_SOLANA_ZEC.token,
      legacy,
      "Historical Ren 1.0 token supply only. Excluded from active volumes and represented-ZEC totals; current redemption is not verified.",
    ),
    status(
      "CoinPaprika spot markets",
      `${PAPRIKA}/coins/zec-zcash/markets`,
      m,
      "All returned ZEC markets examined; classification from the exchange registry.",
    ),
    {
      ...status(
        "NEAR Intents",
        NEAR_VOLUME,
        n,
        "ZEC routed activity, shown separately from spot execution to avoid counting routes and underlying markets together.",
      ),
      ...(n.data && !n.stale ? { status: "context" as const } : {}),
    },
    status(
      "Kamino ZEC deposits",
      "https://api.kamino.finance/markets/collateral-reserves",
      ka,
      "All listed collateral reserves scanned by exact registered mint. Deposits are existing issued tokens, not additional supply or swap volume.",
    ),
    status(
      "NEAR confidential TVL",
      "https://revenue.near.org/",
      nc,
      "Publisher labels figures illustrative. All-asset TVL, not verified ZEC trading volume; excluded from the comparison.",
    ),
    ...wrapped
      .filter((w) => w.asset.rpc)
      .map((w) =>
        status(
          `${w.asset.symbol} supply · ${w.asset.issuer} · ${w.asset.chainName}`,
          w.asset.explorer + w.asset.token,
          w.supply,
          "Direct token supply at a recorded block or finalized slot; not a proof-of-reserves audit.",
        ),
      ),
    status(
      "Hyperliquid",
      "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot",
      hy,
      "UZEC/USDC spot market identified by token ID and market name.",
    ),
    status(
      "Maya",
      `${MAYA}/doc`,
      ma,
      "Exact rolling 24-hour window; synchronized Midgard with a block less than five minutes old required.",
    ),
    status(
      "Maya network status",
      MAYA_NETWORK,
      mn,
      "ZEC inbound halt and trading-pause flags. Pool status alone does not confirm trading is active.",
    ),
    ...wrapped.map(({ asset, feed }) => ({
      ...status(
        `${asset.issuer} ${asset.symbol} · ${asset.chainName}`,
        wrappedUrl(asset),
        feed,
        "Issuer-listed contract; DEX Screener pools plus up to three GeckoTerminal pages for Solana, Base and BNB Chain, deduplicated by chain and pool. No indexed market does not prove zero activity. Indexer coverage is bounded.",
      ),
      ...(feed.data && !feed.stale
        ? {
            status: feed.data.partial
              ? ("partial" as const)
              : feed.data.pools.length === 0
                ? ("not-listed" as const)
                : ("current" as const),
          }
        : {}),
    })),
    {
      ...status(
        "THORChain",
        `${THOR}/pools`,
        th,
        th.data?.listed
          ? "Native ZEC pool."
          : "No ZEC pool in the returned pool registry. Not recorded as an API failure or invented trading volume.",
      ),
      ...(th.data && !th.data.listed && !th.stale
        ? { status: "not-listed" as const }
        : {}),
    },
    status(
      "Rhea Finance",
      "https://www.geckoterminal.com/near/pools/refv1-6065",
      rh,
      "Direct ZEC pool execution on NEAR; counted once in spot volume. NEAR Intents routing is a separate layer.",
    ),
    status(
      "CipherScan supply",
      `${CIPHER}/api/blockchain-info`,
      s,
      "Mainnet node supply reconciled exactly against all value pools, including Ironwood and the lockbox.",
    ),
    status(
      "CipherScan addresses",
      `${CIPHER}/api/labels`,
      h,
      "Every CipherScan label is retained, including addresses outside the rich list. Sourced public attributions are marked separately and never treated as CipherScan-verified ownership.",
    ),
    status(
      "Cypherpunk",
      "https://www.cypherpunk.com/",
      cp,
      "Issuer-reported treasury; latest disclosed transaction date retained.",
    ),
    status(
      "21shares",
      "https://api.primary.21shares.com/api/product_details/ZCASH",
      etp,
      "Securities outstanding × ZEC entitlement; issuer valuation date retained.",
    ),
    status(
      "Grayscale",
      "https://www.thezcashetf.com/",
      gray,
      "Dated September 8 disclosure available if live retrieval fails. Never added to custodian wallet balances.",
    ),
  ];
  const disclosures = [
    {
      data: gray.data ?? GRAYSCALE_DISCLOSURE,
      stale: gray.stale,
      fetchedAt: gray.fetchedAt,
    },
    ...(cp.data
      ? [{ data: cp.data, stale: cp.stale, fetchedAt: cp.fetchedAt }]
      : []),
    ...(etp.data
      ? [{ data: etp.data, stale: etp.stale, fetchedAt: etp.fetchedAt }]
      : []),
  ];
  const transparent = s.data?.pools.find((p) => p.id === "transparent")?.zec;
  const observed = h.data?.holders.reduce((sum, a) => sum + (a.zec ?? 0), 0);
  const holdingsConsistent =
    transparent != null &&
    observed != null &&
    observed <= transparent &&
    (h.data?.indexedZec ?? Infinity) <= transparent;
  return {
    generatedAt: iso(),
    kamino: ka,
    legacySolana: legacy,
    nearActivity: n,
    nearProtocol: nt,
    nearConfidential: nc,
    mayaHistory: mh,
    mayaNetwork: mn,
    wrapped: wrapped.map((w) => ({
      ...w,
      volumeUsd:
        w.feed.data && !w.feed.stale && w.feed.data.pools.length
          ? wrappedMarkets.pools
              .filter((p) => p.assetId === w.asset.id)
              .reduce((sum, p) => sum + p.volumeUsd, 0)
          : null,
    })),
    metrics,
    volumeComplete,
    venues,
    marketCoverage: m.data
      ? {
          received: m.data.received,
          included: m.data.included,
          excluded: m.data.excluded,
        }
      : null,
    supply: s,
    holdings: h,
    holdingsConsistent,
    disclosures,
    sources: sourceStatuses,
    rheaActivity: rh,
    mayaPoolZec: ma.data?.zec ?? null,
    thorPoolZec: th.data?.zec ?? null,
  };
}
const dashboardSnapshot = cachedFeed(
  collectMarketDashboard,
  5 * 60_000,
  (data) =>
    data.sources.some(
      (source) =>
        (source.status === "unavailable" || source.status === "saved") &&
        source.name !== "Grayscale",
    ) || data.wrapped.some((w) => (w.feed.data?.failedSources ?? 0) > 0),
  { key: "zec-observatory:dashboard:v2", staleWhileRevalidate: true },
);

/** One atomic, dated snapshot for server rendering and the refresh endpoint. */
export async function getMarketDashboard(options?: { waitForRefresh?: boolean }) {
  const feed = await dashboardSnapshot(options);
  if (!feed.data) throw new Error("Market snapshot unavailable");
  return {
    ...feed.data,
    snapshot: {
      updatedAt: feed.fetchedAt!,
      refreshing: feed.refreshing === true,
      stale: feed.stale,
      refreshFailed: feed.error !== null,
      refreshAfter: feed.refreshAfter!,
    },
  };
}

export type MarketDashboard = Awaited<ReturnType<typeof getMarketDashboard>>;

const snapshotProcess = globalThis as typeof globalThis & {
  __openZcashMarketWarmTimer?: ReturnType<typeof setInterval>;
};

/** Railway is always on: warm once at boot and renew due feeds off the request path. */
export function startMarketSnapshots() {
  if (snapshotProcess.__openZcashMarketWarmTimer) return;
  const warm = () => {
    void getMarketDashboard({ waitForRefresh: true }).catch(() => {});
  };
  warm();
  snapshotProcess.__openZcashMarketWarmTimer = setInterval(warm, 60_000);
  snapshotProcess.__openZcashMarketWarmTimer.unref();
}
