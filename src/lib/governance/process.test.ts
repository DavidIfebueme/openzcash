import { describe, expect, it } from "vitest";
import { FACTS, PIECES, ROLES, STEPS, TERMS, phases } from "./process";

describe("how a change becomes a rule", () => {
  it("names three pieces, in the order they act", () => {
    expect(PIECES.map((piece) => piece.id)).toEqual([
      "community",
      "organizations",
      "network",
    ]);
  });

  it("has seven steps and every one belongs to a piece", () => {
    const ids = PIECES.map((piece) => piece.id);
    expect(STEPS).toHaveLength(7);
    for (const step of STEPS) expect(ids).toContain(step.piece);
  });

  it("groups the steps by piece without reordering them", () => {
    const grouped = phases();
    expect(grouped.map((phase) => phase.piece.id)).toEqual([
      "community",
      "organizations",
      "network",
    ]);
    expect(grouped.map((phase) => phase.steps.length)).toEqual([4, 2, 1]);
    expect(
      grouped.flatMap((phase) => phase.steps.map((step) => step.number)),
    ).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(grouped[2].steps[0].name).toBe("Adoption");
  });

  it("answers each question in a few words", () => {
    expect(FACTS).toHaveLength(3);
    for (const fact of FACTS) {
      expect(fact.question.endsWith("?")).toBe(true);
      expect(fact.answer.split(" ").length).toBeLessThanOrEqual(4);
    }
  });

  it("gives the final say to exactly one role, listed last", () => {
    const final = ROLES.filter((role) => role.finalSay);
    expect(final).toHaveLength(1);
    expect(ROLES.at(-1)).toBe(final[0]);
  });

  it("keeps roles and terms unique", () => {
    expect(new Set(ROLES.map((role) => role.who)).size).toBe(ROLES.length);
    expect(new Set(TERMS.map((term) => term.term)).size).toBe(TERMS.length);
  });
});
