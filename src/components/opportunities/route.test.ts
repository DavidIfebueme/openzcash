import { expect, it } from "vitest";
import { APPS, placeOf } from "@/lib/design-routes";
import { opportunityRoute } from "./route";
import {
  sampleCampaigns,
  sampleOpportunities,
  sampleOrganizers,
} from "./model";

it("exposes valid shareable beta routes and rejects unknown records", () => {
  for (const segments of [
    [],
    ["new"],
    ["campaigns", "new"],
    ["communities", "new"],
    ...sampleOpportunities.map((o) => ["tasks", o.id]),
    ...sampleCampaigns.map((c) => ["campaigns", c.id]),
    ...sampleOrganizers.map((o) => ["communities", o.id]),
  ]) {
    expect(opportunityRoute(segments)?.title).toContain("Beta");
  }
  for (const segments of [
    ["unknown"],
    ["tasks", "unknown"],
    ["tasks", "new"],
    ["campaigns", "unknown"],
    ["tasks", sampleOpportunities[0].id, "submit"],
  ]) {
    expect(opportunityRoute(segments)).toBeNull();
  }
});

it("integrates the beta in ecosystem navigation and preserves its parent on details", () => {
  const page = APPS.flatMap((app) => app.pages).find(
    (p) => p.href === "/opportunities",
  );
  expect(page).toMatchObject({ label: "Opportunities", beta: true });
  expect(placeOf("/opportunities")?.app.id).toBe("ecosystem");
  expect(
    placeOf("/opportunities/tasks/test-crosslink")?.detail?.parent.href,
  ).toBe("/opportunities");
});
