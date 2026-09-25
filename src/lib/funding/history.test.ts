import { describe, expect, it } from "vitest";
import {
  HEIGHTS,
  STREAM_IDS,
  ZAT_PER_ZEC,
  allocationBetween,
} from "./consensus";
import {
  HISTORY_META,
  dailySeries,
  issuedThrough,
  seriesCsv,
  streamTotals,
  yearlyTotals,
} from "./history";

describe("daily funding series", () => {
  const points = dailySeries();

  it("starts at genesis and covers every height exactly once", () => {
    expect(points[0].date).toBe("2016-10-28");
    expect(points[0].fromHeight).toBe(0);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].fromHeight).toBe(points[i - 1].toHeight + 1);
    }
    expect(points[points.length - 1].toHeight).toBe(
      HISTORY_META.through.height,
    );
  });

  it("has a daily close for every day except genesis", () => {
    const missing = points
      .filter((p) => p.closeUsd === null)
      .map((p) => p.date);
    expect(missing).toEqual(["2016-10-28"]);
  });

  it("sums the days to the same totals as one consensus range", () => {
    const whole = allocationBetween(0, HISTORY_META.through.height);
    const totals = streamTotals(points);
    for (const t of totals) expect(t.zat, t.id).toBe(whole[t.id]);
    expect(issuedThrough(points)).toEqual(whole);
  });

  it("dates each stream with its era", () => {
    const byId = Object.fromEntries(streamTotals(points).map((t) => [t.id, t]));
    expect(byId.foundersReward.firstDate).toBe("2016-10-28");
    expect(byId.foundersReward.zat).toBe(2_100_000 * ZAT_PER_ZEC);
    const canopyDay = points.find(
      (p) => p.fromHeight <= HEIGHTS.canopy && HEIGHTS.canopy <= p.toHeight,
    );
    expect(byId.devFundZf.firstDate).toBe(canopyDay?.date);
    expect(byId.devFundZf.zat).toBe(262_500 * ZAT_PER_ZEC);
    // Only the genesis day lacks a price, and only the Founders' Reward paid then.
    expect(byId.foundersReward.zatWithoutPrice).toBe(2_476_687_500);
    for (const id of STREAM_IDS.filter((s) => s !== "foundersReward")) {
      expect(byId[id].zatWithoutPrice, id).toBe(0);
    }
  });

  it("groups years that add back up to the stream totals", () => {
    const years = yearlyTotals(points);
    expect(years[0].year).toBe("2016");
    for (const t of streamTotals(points)) {
      expect(
        years.reduce((s, y) => s + y.zat[t.id], 0),
        t.id,
      ).toBe(t.zat);
      expect(years.reduce((s, y) => s + y.usd[t.id], 0)).toBeCloseTo(
        t.usdAtReceipt,
        2,
      );
    }
  });

  it("exports one CSV line per day", () => {
    const csv = seriesCsv(points).trimEnd().split("\n");
    expect(csv).toHaveLength(points.length + 1);
    expect(
      csv[0].startsWith(
        "date,from_height,to_height,close_usd,foundersReward_zec",
      ),
    ).toBe(true);
    expect(csv[1].startsWith("2016-10-28,0,629,,24.76687500")).toBe(true);
  });
});

describe("date of height", () => {
  it("finds the day a block belongs to", async () => {
    const { dateOfHeight } = await import("./history");
    expect(dateOfHeight(0)).toBe("2016-10-28");
    expect(dateOfHeight(1_046_400)).toBe("2020-11-18");
    expect(dateOfHeight(3_428_143)).toBe("2026-07-28");
    expect(dateOfHeight(99_999_999)).toBeNull();
  });
});
