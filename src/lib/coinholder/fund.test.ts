import { describe, expect, it } from "vitest";
import { formatPaidZec, payoutSummary, type PayoutEntry } from "./fund";
import { PAYOUTS } from "./program";
import { ROUNDS } from "./rounds";

const fundedUsdCents = (roundId: string) =>
  ROUNDS.find((r) => r.id === roundId)!
    .proposals.filter((p) => p.outcome === "funded")
    .reduce((sum, p) => sum + (p.requestedUsdCents ?? 0), 0);

describe("payoutSummary · the payouts FPF has reported", () => {
  const s = payoutSummary(PAYOUTS, ROUNDS);

  it("lists the three paid rounds, oldest first, with nothing pending", () => {
    expect(s.rows.map((r) => r.roundId)).toEqual([
      "q4-2025",
      "q1-2026",
      "q3-2026",
    ]);
    expect(s.pending).toBeNull();
  });

  it("prices each payout from the USD paid and the ZEC sent", () => {
    const by = Object.fromEntries(s.rows.map((r) => [r.roundId, r]));
    expect(by["q4-2025"].zecUsd).toBeCloseTo(279.19, 2);
    expect(by["q1-2026"].zecUsd).toBeCloseTo(346.63, 2);
    expect(by["q3-2026"].zecUsd).toBeCloseTo(1146.09, 2);
  });

  it("records the Q3 2026 payout of October 16, 2026: 17 grants, $8,389,992, 7,320.535 ZEC", () => {
    const q3 = s.rows.find((r) => r.roundId === "q3-2026")!;
    expect(q3).toMatchObject({
      date: "Oct 16, 2026",
      grants: 17,
      usd: 8_389_992,
      zec: 7320.535,
    });
    expect(q3.usd * 100).toBe(fundedUsdCents("q3-2026"));
  });

  it("pays every funded grant of a round in full, the vetoed ECC grant aside", () => {
    for (const row of s.rows)
      expect(Math.round(row.usd * 100), row.roundId).toBe(
        fundedUsdCents(row.roundId),
      );
  });

  it("totals every payout: 22 grants, $8,556,933 and 7,887.125 ZEC", () => {
    expect(s.totalGrants).toBe(22);
    expect(s.totalUsd).toBe(8_556_933);
    expect(s.totalZec).toBeCloseTo(7887.125, 3);
  });

  it("keeps an approved, unpaid round out of the rows and returns it as pending", () => {
    const before: PayoutEntry[] = PAYOUTS.map((p) =>
      p.roundId === "q3-2026"
        ? { ...p, status: "approved", zec: null, date: "Pending" }
        : p,
    );
    const s0 = payoutSummary(before, ROUNDS);
    expect(s0.rows.map((r) => r.roundId)).toEqual(["q4-2025", "q1-2026"]);
    expect(s0.pending?.roundId).toBe("q3-2026");
    expect(s0.totalGrants).toBe(5);
    expect(s0.totalZec).toBeCloseTo(566.59, 2);
  });
});

describe("PAYOUTS · consistency with the round data", () => {
  const q3 = ROUNDS.find((r) => r.id === "q3-2026")!;
  const q3Payout = PAYOUTS.find((p) => p.roundId === "q3-2026")!;
  const NOTE =
    /^Paid October 16, 2026: ([\d,]+\.\d{4}) ZEC, the \$([\d,]+) at \$1,146\.09 per ZEC\.$/;

  it("reports a ZEC amount for every round it marks paid", () => {
    for (const p of PAYOUTS)
      if (p.status === "paid") expect(p.zec, p.round).toBeGreaterThan(0);
  });

  it("lists payouts oldest first", () => {
    const dates = PAYOUTS.map((p) => Date.parse(p.date));
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it("gives each funded Q3 proposal a payment note whose ZEC add up to the round's payout", () => {
    const funded = q3.proposals.filter((p) => p.outcome === "funded");
    expect(funded).toHaveLength(17);
    let zat = 0;
    for (const p of funded) {
      const note = p.notes?.map((n) => n.match(NOTE)).find(Boolean);
      expect(note, p.title).toBeTruthy();
      const zec = Number(note![1].replace(/,/g, ""));
      const usd = Number(note![2].replace(/,/g, ""));
      expect(usd * 100, p.title).toBe(p.requestedUsdCents);
      expect(zec, p.title).toBeCloseTo(usd / 1146.09, 4);
      zat += Math.round(zec * 1e8);
    }
    expect(zat / 1e8).toBe(q3Payout.zec);
  });
});

describe("formatPaidZec", () => {
  it("keeps the sheet's three decimals and never fewer than two", () => {
    expect(formatPaidZec(7320.535)).toBe("7,320.535");
    expect(formatPaidZec(7887.125)).toBe("7,887.125");
    expect(formatPaidZec(436.77)).toBe("436.77");
    expect(formatPaidZec(5)).toBe("5.00");
  });
});

describe("/api/zcg/coinholder/round · payouts", () => {
  it("serves the payouts by round with the Q3 2026 figures", async () => {
    const { GET } = await import("@/app/api/zcg/coinholder/round/route");
    const body = await (await GET()).json();
    expect(body.payouts).toMatchObject({
      totalZec: expect.closeTo(7887.125, 3),
      totalUsd: 8_556_933,
      totalGrants: 22,
      pendingRound: null,
    });
    expect(body.payouts.rounds.at(-1)).toMatchObject({
      round: "Q3 2026",
      paidOn: "Oct 16, 2026",
      grants: 17,
      usd: 8_389_992,
      zec: 7320.535,
      zecUsd: 1146.09,
    });
  });
});
