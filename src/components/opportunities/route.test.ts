import { expect, it } from "vitest";
import { legacyOpportunityRedirect, opportunityRoute } from "./route";
import { curatedItems } from "./catalog";
it("resolves catalog, artwork and preparation routes without a registration route", () => {
  for (const path of [[], ["art"], ["prepare"], ["platforms"], ...curatedItems.map((x) => ["tasks", x.id])]) expect(opportunityRoute(path)).toBeTruthy();
  expect(opportunityRoute(["register"])).toBeNull(); expect(opportunityRoute(["tasks", "unrecognized"])).toBeNull();
  expect(opportunityRoute(["tasks", "zec-previous-source-id"])).toBeTruthy();
});
it("moves former signup / publishing journeys to the provider flow and preserves shared challenges", () => {
  expect(legacyOpportunityRedirect(["new"])).toBe("/opportunities/prepare");
  expect(legacyOpportunityRedirect(["communities", "new"])).toBe("/opportunities/platforms");
  expect(legacyOpportunityRedirect(["tasks", "hashsmash-november"])).toBe("/opportunities/tasks/hashsmash");
  expect(legacyOpportunityRedirect(["tasks", "test-crosslink"])).toBe("/opportunities/tasks/crosslink-incentives");
  expect(legacyOpportunityRedirect(["tasks", "0xramp-pay-brasil"])).toBe("/opportunities");
});
