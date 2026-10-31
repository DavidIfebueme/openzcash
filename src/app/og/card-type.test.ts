import { describe, expect, it } from "vitest";
import { CARD_LIMITS } from "@/lib/seo/card-params";
import {
  TITLE_MAX_LINES,
  titleBlock,
  clampedBlock,
  titleSize,
  typeset,
} from "./card-type";

describe("text blocks", () => {
  // Satori narrows a balanced block to half its width when it is also
  // clamped, and truncates text that fits (the site card lost its tagline).
  it("never balance and clamp the same block", () => {
    for (const style of [
      titleBlock(76, 1.08, 3),
      clampedBlock(1),
      clampedBlock(2),
    ]) {
      expect("lineClamp" in style && "textWrap" in style).toBe(false);
    }
  });

  it("let words without break opportunities wrap inside the card", () => {
    expect(titleBlock(76, 1.08, 3).wordBreak).toBe("break-word");
    expect(clampedBlock(2).wordBreak).toBe("break-word");
  });

  it("keep a title to its line budget", () => {
    expect(titleBlock(50, 1.08, TITLE_MAX_LINES)).toMatchObject({
      maxHeight: 162,
      overflow: "hidden",
    });
  });
});

describe("titleSize", () => {
  it("sets short titles large", () => {
    expect(titleSize({ title: "Grants" })).toBe(96);
    expect(
      titleSize({ title: "ZODL Q1 & Q2 2026 Core Protocol Development" }),
    ).toBe(76);
  });

  it("steps down as titles grow, keeping two lines", () => {
    expect(
      titleSize({ title: "Orchard Counterfeiting Vulnerability Bug Bounty" }),
    ).toBe(68);
    expect(
      titleSize({
        title: "Ziggurat 3.0 - Network Wide Testing and Active Validation",
      }),
    ).toBe(58);
  });

  it("keeps long titles legible when the category and figure move outside the body", () => {
    const title =
      "Taylor Hornby - Bonus Grant for Orchard Counterfeiting Vulnerability Bug Bounty";
    expect(
      titleSize({ title, section: "ZCG", kicker: "Grant to Taylor Hornby" }),
    ).toBe(58);
    expect(
      titleSize({
        title,
        section: "ZCG",
        kicker: "k".repeat(CARD_LIMITS.kicker),
        stat: "1 of 1 milestone paid",
      }),
    ).toBe(58);
  });

  it("sets the site card larger than any page card", () => {
    expect(titleSize({ title: "Zcash funding, in the open" }, true)).toBe(96);
  });
});

describe("typeset", () => {
  it("curls apostrophes, possessives and quotes", () => {
    expect(typeset("Zcash's Founders' Reward")).toBe(
      "Zcash’s Founders’ Reward",
    );
    expect(typeset("the \"Dev Fund\" and 'record'")).toBe(
      "the “Dev Fund” and ‘record’",
    );
  });

  it("never draws a dash: a spaced hyphen or any dash becomes a middle dot kept on the line before it", () => {
    expect(typeset("Ziggurat 3.0 - Network Wide Testing")).toBe(
      "Ziggurat 3.0\u00a0· Network Wide Testing",
    );
    expect(typeset("Taylor Hornby – Bonus")).toBe("Taylor Hornby\u00a0· Bonus");
    expect(typeset("One — two")).toBe("One\u00a0· two");
    expect(typeset("One—two")).toBe("One\u00a0· two");
    expect(typeset("Oct 2016–Nov 2020")).toBe("Oct 2016-Nov 2020");
    expect(typeset("anything – or — else")).not.toMatch(/[–—]/);
  });

  it("leaves hyphenated words alone", () => {
    expect(typeset("zk-SNARK read-only")).toBe("zk-SNARK read-only");
  });
});
