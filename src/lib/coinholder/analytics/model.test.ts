import { describe, expect, it } from "vitest";
import raw from "../../../../data/coinholder/q3-2026-summary.json";
import metadata from "../../../../data/coinholder/q3-2026-metadata.json";
import { buildCoinholderDashboard, calculateCoinholderOutcome, coinholderUnitsToZec, COINHOLDER_SUMMARY_SHA256, COINHOLDER_SUMMARY_URLS, COINHOLDER_METADATA_URL, COINHOLDER_ROUND_ID, parseCoinholderActivity } from "@/lib/coinholder/analytics/model";

const source = { state: "snapshot" as const, checkedAt: "2026-10-09T04:00:00.000Z", snapshotFetchedAt: "2026-10-09T03:59:27.000Z", sha256: COINHOLDER_SUMMARY_SHA256, url: COINHOLDER_SUMMARY_URLS[0], metadataUrl: COINHOLDER_METADATA_URL, warning: null };
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

describe("Q3 Coinholder results", () => {
  it("matches all 37 real proposal options and separates voting power from people", () => {
    const dashboard = buildCoinholderDashboard(raw, metadata, source);
    expect(dashboard.summary).toEqual({ proposalCount: 37, fundedCount: 17, rejectedCount: 20, quorumMetCount: 37, minVotingPowerZec: "2179029.875", maxVotingPowerZec: "2181452.875" });
    expect(dashboard.proposals[0]).toMatchObject({ id: "24", ballot: 1, title: "Zcash Grants Hub", totalZec: "2181451.875", options: [{ id: "accept", weightUnits: "636064", zec: "79508.000" }, { id: "reject", zec: "1391627.875" }, { id: "lower", zec: "32.625" }, { id: "abstain", zec: "710283.375" }] });
    expect(dashboard.proposals.find((proposal) => proposal.ballot === 14)).toMatchObject({ publishedOutcome: "Funded", computedOutcome: "FUNDED", correction: { text: expect.any(String) } });
    expect(dashboard.round.voteStartAt).toBeNull();
    expect(dashboard.round.voteEndAt).toBe("2026-09-29T20:00:00.000Z");
    expect(dashboard.proposals[0].verifyUrl).toBe("/coinholders/verify/q3-2026/24");
    expect(dashboard.source.metadataUrl).toBe("/api/coinholders/verify?round=q3-2026&format=json");
    expect(JSON.stringify(dashboard)).not.toMatch(/ballot_count|voterCount|totalEligible/);
  });

  it("converts integer eighths exactly even above floating point precision", () => {
    expect(coinholderUnitsToZec(0n)).toBe("0.000");
    expect(coinholderUnitsToZec(1n)).toBe("0.125");
    expect(coinholderUnitsToZec(9007199254740993n)).toBe("1125899906842624.125");
    expect(() => coinholderUnitsToZec(-1n)).toThrow();
  });

  it("includes Abstain in minimum weight but excludes it from the strict majority", () => {
    expect(calculateCoinholderOutcome({ accept: 2n, reject: 1n, lower: 0n, abstain: 3_359_997n })).toMatchObject({ computedOutcome: "FUNDED", quorumMet: true, acceptSharePercent: 66.67 });
    expect(calculateCoinholderOutcome({ accept: 2n, reject: 1n, lower: 1n, abstain: 3_359_996n })).toMatchObject({ computedOutcome: "REJECTED", quorumMet: true, acceptSharePercent: 50 });
    expect(calculateCoinholderOutcome({ accept: 3_359_999n, reject: 0n, lower: 0n, abstain: 0n })).toMatchObject({ computedOutcome: "REJECTED", quorumMet: false });
    expect(calculateCoinholderOutcome({ accept: 0n, reject: 0n, lower: 0n, abstain: 3_360_000n })).toMatchObject({ computedOutcome: "REJECTED", acceptSharePercent: 0 });
  });

  it("does not mistake withheld active results or a different election for finalized zero counts", () => {
    expect(() => buildCoinholderDashboard({ ...raw, status: 1 }, metadata, source)).toThrow();
    expect(() => buildCoinholderDashboard({ ...raw, vote_round_id: "another-round" }, metadata, source)).toThrow();
    const invalid = copy(raw);
    invalid.proposals[0].options[0].total_value = Number.MAX_SAFE_INTEGER + 1;
    expect(() => buildCoinholderDashboard(invalid, metadata, source)).toThrow();
  });

  it("rejects incomplete, duplicate or mismatched proposal mappings", () => {
    expect(() => buildCoinholderDashboard({ ...raw, proposals: raw.proposals.slice(1) }, metadata, source)).toThrow();
    const duplicate = copy(raw);
    duplicate.proposals[0].id = duplicate.proposals[1].id;
    expect(() => buildCoinholderDashboard(duplicate, metadata, source)).toThrow();
    const mismatch = copy(metadata);
    mismatch.rows[0].accept += 0.125;
    expect(() => buildCoinholderDashboard(raw, mismatch, source)).toThrow();
    const wrongOutcome = copy(metadata);
    wrongOutcome.rows[0].published = "Funded";
    expect(() => buildCoinholderDashboard(raw, wrongOutcome, source)).toThrow();
  });

  it("requires distinct option indices and known Q3 meanings", () => {
    const duplicate = copy(raw);
    duplicate.proposals[0].options[1].index = 0;
    expect(() => buildCoinholderDashboard(duplicate, metadata, source)).toThrow();
    const unknown = copy(raw);
    unknown.proposals[0].options[0].label = "Send funds";
    expect(() => buildCoinholderDashboard(unknown, metadata, source)).toThrow();
  });

  it("never emits arbitrary metadata links", () => {
    const hostile = copy(metadata);
    hostile.rows[0].note = "A note";
    hostile.rows[0].noteUrl = "https://forum.zcashcommunity.com.attacker.example/unsafe";
    expect(buildCoinholderDashboard(raw, hostile, source).proposals[0].correction?.url).toBeNull();
  });
});

function activityFixture() {
  const txHash = "A".repeat(64);
  const transaction = { txHash, height: 100, at: "2026-09-18T03:01:20.000Z", kind: "MsgCastVoteBatch", typeUrl: "/svote.v1.MsgCastVoteBatch", proposalIds: [1, 1], castCount: 2, txBytes: 1024, sourceUrl: `https://zvote.zfnd.org/shielded-vote/v1/tx/${txHash}` };
  const minutes = [{ at: "2026-09-18T03:01:00Z", count: 2, cumulative: 2 }];
  const hours = [{ at: "2026-09-18T03:00:00Z", count: 2, cumulative: 2 }];
  return {
    activity: { schemaVersion: 1, roundId: COINHOLDER_ROUND_ID, chainId: "zvote-1", fetchedAt: source.checkedAt, sourceUrls: ["https://zvote.zfnd.org/shielded-vote/v1/round/" + COINHOLDER_ROUND_ID], unit: "Encrypted vote commitments", complete: true, coverage: { fromHeight: 1, toHeight: 1000, firstAt: transaction.at, lastAt: transaction.at, reason: null }, totals: { transactions: 1, castMessages: 2 }, minutes, hours, proposals: [{ id: 1, transactions: 1, castMessages: 2, minutes, hours }], recentTransactions: [transaction], evidence: {} },
    sidecar: { roundId: COINHOLDER_ROUND_ID, chainId: "zvote-1", complete: true, transactions: [transaction] }
  };
}

describe("Coinholder activity evidence", () => {
  it("keeps cast messages distinct from transactions and accepts multiple casts per proposal", () => {
    const { activity, sidecar } = activityFixture();
    expect(parseCoinholderActivity(activity, sidecar)).toMatchObject({ totals: { transactions: 1, castMessages: 2 }, transactions: [{ castCount: 2 }] });
  });

  it("rejects a foreign round, duplicate transaction or an untrusted input link", () => {
    const { activity, sidecar } = activityFixture();
    expect(() => parseCoinholderActivity({ ...activity, roundId: "another" }, sidecar)).toThrow();
    expect(() => parseCoinholderActivity(activity, { ...sidecar, transactions: [...sidecar.transactions, ...sidecar.transactions] })).toThrow();
    expect(() => parseCoinholderActivity(activity, { ...sidecar, transactions: [{ ...sidecar.transactions[0], sourceUrl: "https://example.com/tx" }] })).toThrow();
  });

  it("rejects a chart that disagrees with the records or proposal totals", () => {
    const { activity, sidecar } = activityFixture();
    expect(() => parseCoinholderActivity({ ...activity, minutes: [{ ...activity.minutes[0], cumulative: 3 }] }, sidecar)).toThrow();
    const shifted = copy(activity);
    shifted.minutes[0].at = "2026-09-18T03:02:00Z";
    shifted.proposals[0].minutes[0].at = "2026-09-18T03:02:00Z";
    expect(() => parseCoinholderActivity(shifted, sidecar)).toThrow();
  });

  it("preserves a partial index rather than promoting it to complete", () => {
    const { activity, sidecar } = activityFixture();
    expect(parseCoinholderActivity({ ...activity, complete: false }, { ...sidecar, complete: false }).complete).toBe(false);
    expect(() => parseCoinholderActivity(activity, { ...sidecar, complete: false })).toThrow();
  });
});
