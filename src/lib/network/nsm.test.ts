import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./economics", () => ({ getNetworkEconomics: vi.fn() }));
vi.mock("./zecblock", () => ({ getNetworkActivity: vi.fn() }));

const fetchMock = vi.fn();
/** The reading taken on 2026-11-13 at height 3,569,402 (Zcash Info). */
const HEIGHT = 3_569_402;
const BALANCE = 37_773_210_016;
const TIME = Math.floor(Date.parse("2026-11-13T16:30:00Z") / 1_000);

type Fees = { fees: number | null; nsm: number | null; miner: number | null };
const FEES: Fees[] = [
  { fees: 0, nsm: 0, miner: 0 },
  { fees: 260_000, nsm: 156_000, miner: 104_000 },
  { fees: 97_826, nsm: 58_695, miner: 39_131 },
];

function block(index: number, split: Fees, status = "PENDING") {
  return {
    height: HEIGHT - index,
    hash: (index + 1).toString(16).padStart(64, "0"),
    time: TIME - index * 25,
    difficulty: 89_000_000,
    tx_count: 3,
    size: 2_000,
    miner: { pool_name: "ViaBTC" },
    total_minted_zatoshis: 52_083_333,
    miner_subsidy_zatoshis: 41_666_668,
    transaction_fees_zatoshis: split.fees,
    miner_fee_share_zatoshis: split.miner,
    nsm_fee_contribution_zatoshis: split.nsm,
    status,
  };
}

function dashboard(overrides: { info?: object; blocks?: object[] } = {}) {
  return {
    info: {
      best_block: HEIGHT,
      chain_tip: HEIGHT,
      difficulty: 89_000_000,
      status: "synced",
      target_block_spacing_secs: 25,
      work_per_difficulty: 8_192,
      nu7_activation_height: 3_543_405,
      nsm_value_balance_zat: BALANCE,
      ...overrides.info,
    },
    pools: {
      total_supply_zatoshis: 1_703_972_072_802_307,
      transparent_zatoshis: 1_202_979_841_331_558,
      ironwood_zatoshis: 418_175_561_328_444,
      orchard_zatoshis: 32_095_607_249_138,
      sapling_zatoshis: 41_892_460_574_195,
      sprout_zatoshis: 1_222_421_094_946,
      lockbox_zatoshis: 7_606_181_224_026,
    },
    recent_blocks:
      overrides.blocks ?? FEES.map((split, index) => block(index, split)),
  };
}

const respond = (data: unknown) => ({ ok: true, json: async () => data });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(TIME * 1_000 + 20_000));
  fetchMock.mockReset().mockImplementation(async () => respond(dashboard()));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the NSM value balance from the public node feed", () => {
  it("reports the balance, its seed and what fees have added since NU7", async () => {
    const { getNsmSnapshot } = await import("./nsm");
    const nsm = await getNsmSnapshot();
    expect(nsm).toMatchObject({
      stale: false,
      height: HEIGHT,
      observedAt: "2026-11-13T16:30:00.000Z",
      targetBlockSeconds: 25,
      balanceZat: BALANCE,
      seedZat: 36_858_445_520,
      addedZat: BALANCE - 36_858_445_520,
      blocksSinceActivation: HEIGHT - 3_543_405 + 1,
      source: { name: "Zcash Info" },
    });
  });

  it("averages the additions over the 25-second blocks since NU7", async () => {
    const { getNsmSnapshot } = await import("./nsm");
    const nsm = (await getNsmSnapshot())!;
    const perBlock = (BALANCE - 36_858_445_520) / (HEIGHT - 3_543_405 + 1);
    expect(nsm.averagePerBlockZat).toBeCloseTo(perBlock, 6);
    expect(nsm.averagePerDayZat).toBeCloseTo(perBlock * 3_456, 3);
  });

  it("places reissuance at block 8,939,664, 25 seconds a block from the tip", async () => {
    const { getNsmSnapshot } = await import("./nsm");
    const nsm = (await getNsmSnapshot())!;
    const remaining = 8_939_664 - HEIGHT;
    expect(nsm.reissuance).toEqual({
      height: 8_939_664,
      blocksRemaining: remaining,
      estimatedAt: new Date((TIME + remaining * 25) * 1_000).toISOString(),
      // ceiling(1375 x balance / 10^10)
      perBlockAtBalanceZat: 5_194,
    });
  });

  it("lists each recent block's fee split and checks it against ZIP 235", async () => {
    const { getNsmSnapshot } = await import("./nsm");
    const nsm = (await getNsmSnapshot())!;
    expect(nsm.blocks).toEqual([
      { height: HEIGHT, time: "2026-11-13T16:30:00.000Z", feesZat: 0, nsmZat: 0, minerFeesZat: 0, ruleHolds: true },
      { height: HEIGHT - 1, time: "2026-11-13T16:29:35.000Z", feesZat: 260_000, nsmZat: 156_000, minerFeesZat: 104_000, ruleHolds: true },
      { height: HEIGHT - 2, time: "2026-11-13T16:29:10.000Z", feesZat: 97_826, nsmZat: 58_695, minerFeesZat: 39_131, ruleHolds: true },
    ]);
  });

  it("flags a split that does not follow the rule and leaves a missing one unknown", async () => {
    fetchMock.mockImplementation(async () =>
      respond(
        dashboard({
          blocks: [
            block(0, { fees: 100_000, nsm: 50_000, miner: 50_000 }),
            block(1, { fees: null, nsm: null, miner: null }),
          ],
        }),
      ),
    );
    const { getNsmSnapshot } = await import("./nsm");
    const nsm = (await getNsmSnapshot())!;
    expect(nsm.blocks.map((b) => b.ruleHolds)).toEqual([false, null]);
    expect(nsm.blocks[1]).toMatchObject({ feesZat: null, nsmZat: null });
  });

  it("flags a miner share that is not the rest of the fees", async () => {
    fetchMock.mockImplementation(async () =>
      respond(
        dashboard({
          blocks: [block(0, { fees: 100_000, nsm: 60_000, miner: 100_000 })],
        }),
      ),
    );
    const { getNsmSnapshot } = await import("./nsm");
    expect((await getNsmSnapshot())!.blocks[0].ruleHolds).toBe(false);
  });

  it("leaves stale blocks out of the list", async () => {
    fetchMock.mockImplementation(async () =>
      respond(
        dashboard({
          blocks: [block(0, FEES[1]), block(1, FEES[2], "STALE")],
        }),
      ),
    );
    const { getNsmSnapshot } = await import("./nsm");
    expect((await getNsmSnapshot())!.blocks.map((b) => b.height)).toEqual([
      HEIGHT,
    ]);
  });
});

describe("when the feed cannot vouch for the balance", () => {
  it("is unavailable, never zero, when the node does not report it", async () => {
    fetchMock.mockImplementation(async () =>
      respond(dashboard({ info: { nsm_value_balance_zat: undefined } })),
    );
    const { getNsmSnapshot } = await import("./nsm");
    expect(await getNsmSnapshot()).toBeNull();
  });

  it("is unavailable when the balance is below its seed before reissuance", async () => {
    fetchMock.mockImplementation(async () =>
      respond(dashboard({ info: { nsm_value_balance_zat: 36_858_445_519 } })),
    );
    const { getNsmSnapshot } = await import("./nsm");
    expect(await getNsmSnapshot()).toBeNull();
  });

  it("is unavailable before NU7", async () => {
    fetchMock.mockImplementation(async () =>
      respond(
        dashboard({
          info: { best_block: 3_543_404, chain_tip: 3_543_404 },
          blocks: [{ ...block(0, FEES[0]), height: 3_543_404 }],
        }),
      ),
    );
    const { getNsmSnapshot } = await import("./nsm");
    expect(await getNsmSnapshot()).toBeNull();
  });

  it("is unavailable when the request fails with nothing cached", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, json: async () => ({}) }));
    const { getNsmSnapshot } = await import("./nsm");
    expect(await getNsmSnapshot()).toBeNull();
  });

  it("keeps the last reading, marked stale, when a later request fails", async () => {
    const { getNsmSnapshot } = await import("./nsm");
    expect((await getNsmSnapshot())!.stale).toBe(false);
    fetchMock.mockImplementation(async () => ({ ok: false, json: async () => ({}) }));
    vi.setSystemTime(new Date(TIME * 1_000 + 60_000));
    const later = (await getNsmSnapshot())!;
    expect(later.balanceZat).toBe(BALANCE);
    expect(later.stale).toBe(true);
  });

  it("marks the reading stale when the node is behind the tip", async () => {
    fetchMock.mockImplementation(async () =>
      respond(dashboard({ info: { status: "syncing" } })),
    );
    const { getNsmSnapshot } = await import("./nsm");
    expect((await getNsmSnapshot())!.stale).toBe(true);
  });
});
