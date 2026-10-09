// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import archive from "../../../../data/coinholder/q3-2026-reveals.json";
import summary from "../../../../data/coinholder/q3-2026-summary.json";
import { COINHOLDER_REVEALS_SHA256, parseCoinholderRevealHistory } from "@/lib/coinholder/analytics/reveals";

vi.mock("server-only", () => ({}));

type Archive = typeof archive;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const parseChanged = (change: (value: Archive) => void) => {
  const value = copy(archive);
  change(value);
  return () => parseCoinholderRevealHistory(value, summary);
};

describe("verified Coinholder revealed-share history", () => {
  it("preserves the audited source hash and all 148 exact final option counters", () => {
    const bytes = readFileSync(new URL("../../../../data/coinholder/q3-2026-reveals.json", import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(COINHOLDER_REVEALS_SHA256);
    const original = JSON.stringify(archive);
    const history = parseCoinholderRevealHistory(archive, summary);
    expect(history).toMatchObject({ unit: "revealed shares", interval: "day", complete: true, sha256: COINHOLDER_REVEALS_SHA256 });
    expect(history.days).toHaveLength(13);
    expect(history.proposals).toHaveLength(37);
    expect(history.days[0]).toMatchObject({ at: "2026-09-17T00:00:00Z", until: "2026-09-18T00:00:00Z", total: 282, cumulativeTotal: 282 });
    expect(history.days[12]).toMatchObject({ until: "2026-09-30T00:00:00Z", cumulativeTotal: 145620, cumulative: { accept: 76874, reject: 47116, lower: 7448, abstain: 14182 } });
    expect(history.proposals[0].days[0]).toMatchObject({ counts: { accept: 11, reject: 0, lower: 0, abstain: 1 }, total: 12 });
    expect(history.proposals[23].days[12].cumulative).toEqual({ accept: 802, reject: 2308, lower: 371, abstain: 454 });
    expect(history.proposals[2].days[12].cumulative.lower).toBe(0);
    expect(JSON.stringify(history)).not.toContain("weights");
    expect(JSON.stringify(archive)).toBe(original);
  });

  it.each([
    ["wrong round", (value: Archive) => { value.roundId = "00".repeat(32); }],
    ["wrong chain", (value: Archive) => { value.chainId = "another-chain"; }],
    ["wrong unit", (value: Archive) => { value.unit = "votes"; }],
    ["untrusted summary hash", (value: Archive) => { value.source.summarySha256 = "00".repeat(32); }],
    ["reordered option mapping", (value: Archive) => { value.optionIndices.reverse(); }],
    ["missing proposal", (value: Archive) => { delete (value.days[0].counts as Record<string, number[]>)["1"]; }],
    ["extra proposal", (value: Archive) => { (value.days[0].counts as Record<string, number[]>)["38"] = [0, 0, 0, 0]; }],
    ["missing zero option", (value: Archive) => { value.days[0].counts["1"].pop(); }],
    ["negative count", (value: Archive) => { value.days[0].counts["1"][0] = -1; }],
    ["fractional count", (value: Archive) => { value.days[0].counts["1"][0] = 0.5; }],
    ["unsafe count", (value: Archive) => { value.days[0].counts["1"][0] = Number.MAX_SAFE_INTEGER + 1; }],
    ["missing day", (value: Archive) => { value.days.pop(); }]
  ] as const)("rejects %s without inventing missing counts", (_name, change) => {
    expect(parseChanged(change)).toThrow(ZodError);
  });

  it.each([
    ["reordered days", (value: Archive) => { [value.days[0], value.days[1]] = [value.days[1], value.days[0]]; }, /Nonconsecutive UTC reveal days/],
    ["non-midnight bucket", (value: Archive) => { value.days[0].at = "2026-09-17T00:01:00Z"; }, /Nonconsecutive UTC reveal days/],
    ["invented daily delta", (value: Archive) => { value.days[0].counts["1"][0]++; }, /delta or cumulative mismatch/],
    ["wrong cumulative counter", (value: Archive) => { value.days[0].cumulative["1"][0]++; }, /delta or cumulative mismatch/],
    ["wrong daily total", (value: Archive) => { value.days[0].total++; }, /daily total mismatch/],
    ["snapshot height mismatch", (value: Archive) => { value.days[0].snapshotHeight++; }, /Invalid reveal boundary heights/],
    ["nonconsecutive boundary heights", (value: Archive) => { value.boundaries[0].after.height++; }, /Unexpected reveal header source|Invalid reveal boundary heights/],
    ["boundary header after cutoff", (value: Archive) => { value.boundaries[0].before.at = "2026-09-18T00:00:00Z"; }, /Invalid reveal UTC boundary bracket/],
    ["boundary successor before cutoff", (value: Archive) => { value.boundaries[0].after.at = "2026-09-17T23:59:59Z"; }, /Invalid reveal UTC boundary bracket/],
    ["wrong interim status", (value: Archive) => { value.boundaries[0].state.status = 3; }, /Unexpected historical reveal status/],
    ["incorrect final counter", (value: Archive) => { value.final.state.counts["1"][0]++; value.final.state.total++; }, /Final revealed-share counts do not match/],
    ["untrusted state URL", (value: Archive) => { value.boundaries[0].state.sourceUrl = "https://example.com/state"; }, /Unexpected reveal state source/],
    ["changed archive metadata", (value: Archive) => { value.source.trust = "independently verified"; }, /Historical reveal archive hash mismatch/]
  ] as const)("rejects %s before serving a history", (_name, change, message) => {
    expect(parseChanged(change)).toThrow(message);
  });

  it("rejects a nonzero creation baseline and decreasing cumulative counters", () => {
    expect(parseChanged(value => { value.baseline.state.counts["1"][0] = 1; value.baseline.state.total = 1; })).toThrow(/Invalid zero reveal baseline/);
    expect(parseChanged(value => {
      const state = value.boundaries[1].state;
      state.total -= state.counts["1"][0];
      state.counts["1"][0] = 0;
    })).toThrow(/delta or cumulative mismatch/);
  });

  it("checks every final option against the official summary, including zero-valued options", () => {
    const altered = copy(summary);
    altered.proposals[0].options[0].ballot_count!++;
    expect(() => parseCoinholderRevealHistory(archive, altered)).toThrow(/Final revealed-share counts do not match/);
    altered.proposals[0].options.pop();
    expect(() => parseCoinholderRevealHistory(archive, altered)).toThrow(ZodError);
  });

  it("rejects unpublished interim weights and mismatched optional final weights", () => {
    expect(parseChanged(value => {
      Object.assign(value.boundaries[0].state, { weights: Object.fromEntries(Array.from({ length: 37 }, (_, index) => [String(index + 1), [0, 0, 0, 0]])) });
    })).toThrow(/Unpublished or mismatched reveal state weights/);
    expect(parseChanged(value => {
      Object.assign(value.final.state, { weights: Object.fromEntries(Array.from({ length: 37 }, (_, index) => [String(index + 1), [0, 0, 0, 0]])) });
    })).toThrow(/Unpublished or mismatched reveal state weights/);
  });
});
