import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ROUNDS } from "@/lib/coinholder/rounds";
import { proposalDecision } from "@/lib/coinholder/proposal-decision";
import { verifyRound } from "@/lib/coinholder/verify";
import { ProposalGraph } from "./proposal-graph";
import { segmentLabelY } from "./proposal-graph-layout";

const q3 = ROUNDS.find(r => r.id === "q3-2026")!;
const y = (position: number) => 650 - 560 * position;
const clearOf = (baseline: number, line: number) => baseline <= line - 10 || baseline >= line + 18;

describe("proposal graph label placement", () => {
  it("leaves a clear label centered", () => {
    expect(segmentLabelY(0, 100, [10, 90])).toBe(54);
  });

  it("moves away from overlapping reference lines while staying in the segment", () => {
    const baseline = segmentLabelY(0, 100, [50, 64])!;
    expect(baseline).not.toBe(54);
    expect([50, 64].every(line => clearOf(baseline, line))).toBe(true);
    expect(baseline).toBeGreaterThanOrEqual(16);
    expect(baseline).toBeLessThanOrEqual(92);
  });

  it("keeps tiny or crowded segments unlabelled instead of obscuring a reference line", () => {
    expect(segmentLabelY(0, 20, [])).toBeNull();
    expect(segmentLabelY(0, 30, [15])).toBeNull();
  });

  it.each([4, 13, 14])("renders ballot #%s labels clear of both lines without rescaling votes", ballot => {
    const row = verifyRound(q3).rows.find(r => r.ballot === ballot)!;
    const data = proposalDecision(q3, row)!;
    const html = renderToStaticMarkup(<ProposalGraph data={data} digits={3} />);
    const lines = [y(data.quorumPosition), y(data.majorityPosition)];
    for (const label of html.matchAll(/<text[^>]*y="([^"]+)"[^>]*data-option="([^"]+)"/g)) {
      const baseline = Number(label[1]);
      const option = data.options.find(o => o.key === label[2])!;
      expect(lines.every(line => clearOf(baseline, line))).toBe(true);
      expect(baseline - 12).toBeGreaterThan(y(option.start + option.size));
      expect(baseline + 4).toBeLessThan(y(option.start));
    }
    expect(html).toContain('data-option="approve"');
    const accept = data.options[0];
    expect(html).toContain(`y="${y(accept.start + accept.size)}" width="206" height="${560 * accept.size}"`);
  });

  it("never overlaps the label bounds or moves labels into another option across historical rounds", () => {
    for (const round of ROUNDS) for (const row of verifyRound(round).rows) {
      const data = proposalDecision(round, row);
      if (!data) continue;
      const lines = [y(data.quorumPosition), ...(data.directional > 0 ? [y(data.majorityPosition)] : [])];
      for (const option of data.options) {
        const top = y(option.start + option.size), bottom = y(option.start);
        const baseline = segmentLabelY(top, bottom, lines);
        if (baseline === null) continue;
        expect(lines.every(line => clearOf(baseline, line))).toBe(true);
        expect(baseline - 12).toBeGreaterThan(top);
        expect(baseline + 4).toBeLessThan(bottom);
      }
    }
  });
});
