import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { NsmBlock, NsmSnapshot } from "@/lib/network/nsm";
import { NsmLiveFeed } from "./nsm-live-feed";

const block = (height: number, nsmZat: number | null): NsmBlock => ({
  height,
  time: "2026-11-13T16:30:00.000Z",
  feesZat: nsmZat === null ? null : (nsmZat * 10) / 6,
  nsmZat,
  minerFeesZat: nsmZat === null ? null : (nsmZat * 4) / 6,
  ruleHolds: nsmZat === null ? null : true,
});

const snapshot = (blocks: NsmBlock[]): NsmSnapshot => ({
  source: {
    name: "Zcash Info",
    url: "https://zcashinfo.com/",
    docsUrl: "https://api.zcashinfo.com/docs",
  },
  fetchedAt: "2026-11-13T16:30:20.000Z",
  stale: false,
  height: 3_569_402,
  observedAt: "2026-11-13T16:30:00.000Z",
  targetBlockSeconds: 25,
  balanceZat: 37_773_210_016,
  seedZat: 36_858_445_520,
  addedZat: 914_764_496,
  blocksSinceActivation: 25_998,
  averagePerBlockZat: 35_185,
  averagePerDayZat: 121_600_000,
  reissuance: {
    height: 8_939_664,
    blocksRemaining: 5_370_262,
    estimatedAt: "2031-02-14T14:05:33.000Z",
    perBlockAtBalanceZat: 5_194,
  },
  blocks,
});

const render = (blocks: NsmBlock[]) =>
  renderToStaticMarkup(
    <NsmLiveFeed initial={snapshot(blocks)} zecUsd={900} />,
  );

describe("NSM live feed · which blocks added to the balance", () => {
  it("counts only blocks with a reported, positive contribution", () => {
    const html = render([
      block(3_569_402, 156_000),
      block(3_569_401, 0),
      block(3_569_400, 60_000),
    ]);
    expect(html).toContain("2 of the last 3 blocks added to the balance");
    expect(html).not.toContain("not reported");
    expect(html).toContain("Block #3,569,402");
    expect(html).not.toContain("Block #3,569,401");
  });

  it("keeps a block with an unreported split visible without counting it", () => {
    const html = render([
      block(3_569_402, 156_000),
      block(3_569_401, null),
      block(3_569_400, 0),
    ]);
    expect(html).toContain("1 of the last 3 blocks added to the balance");
    expect(html).toContain("1 not reported");
    expect(html).toContain("Block #3,569,401");
    expect(html).toContain("fee split not reported");
  });

  it("claims nothing when no split was reported at all", () => {
    const html = render([block(3_569_402, null), block(3_569_401, null)]);
    expect(html).toContain("0 of the last 2 blocks added to the balance");
    expect(html).toContain("2 not reported");
  });

  it("says so when every recent block was empty", () => {
    const html = render([block(3_569_402, 0), block(3_569_401, 0)]);
    expect(html).toContain("0 of the last 2 blocks added to the balance");
    expect(html).toContain("None of the recent blocks added to the balance.");
  });

  it("shows the feed as unavailable, with no figures, when there is no reading", () => {
    const html = renderToStaticMarkup(
      <NsmLiveFeed initial={null} zecUsd={900} />,
    );
    expect(html).toContain("NSM balance unavailable right now");
    expect(html).not.toContain("ZEC</span>");
  });
});
