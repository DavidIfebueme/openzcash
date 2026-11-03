import { describe, expect, it } from "vitest";
import { randomOrder } from "./order";
import { sampleOpportunities } from "./model";

describe("unbiased opportunity order", () => {
  it("gives every item each position equally across all possible draws", () => {
    const permutations = [];
    for (const first of [0, 1 / 3, 2 / 3]) {
      for (const second of [0, 0.5]) {
        const draws = [first, second];
        permutations.push(
          randomOrder(["wallet", "test", "contest"], () => draws.shift()!),
        );
      }
    }
    expect(new Set(permutations.map((p) => p.join())).size).toBe(6);
    for (const item of ["wallet", "test", "contest"]) {
      for (const position of [0, 1, 2]) {
        expect(permutations.filter((p) => p[position] === item)).toHaveLength(
          2,
        );
      }
    }
  });

  it("mixes the complete catalog without changing or dropping any records", () => {
    const ids = sampleOpportunities.map((o) => o.id);
    const original = [...ids];
    const result = randomOrder(ids, () => 0);
    expect(ids).toEqual(original);
    expect(result).not.toEqual(original);
    expect(result.slice().sort()).toEqual(original.slice().sort());
    expect(randomOrder([], () => 0)).toEqual([]);
  });
});
