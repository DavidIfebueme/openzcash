import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/synced", () => ({ Synced: () => null }));

import Page from "./page";

const html = renderToStaticMarkup(await Page());
const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) =>
  m[1]
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"'),
);

describe("methodology page copy", () => {
  it("names the GitHub labels the importer actually matches", () => {
    expect(html).toContain("Ready For ZCG Review");
    expect(html).not.toContain("Grant Application / Ready For Review");
  });

  it("discloses the Lockbox snapshot-plus-accrual model", () => {
    expect(html).toContain(
      "0.06249999 ZEC per block since NU7 and 0.1875 ZEC before it",
    );
    expect(html).toContain("snapshot");
  });

  it("renders the sources and the five named rules in order", () => {
    expect(headings).toEqual([
      "Where the data comes from",
      "Rule 1 · Source precedence",
      "Rule 2 · Refresh is retrieval, not source edit",
      "How each classification is tagged",
      "Why the two “discretionary” figures differ",
      "Rule 3 · USD vs ZEC",
      "Rule 4 · Payment ≠ delivery",
      "Rule 5 · Reconciliation limits",
      "What this page does not claim",
      "Reproduce it yourself",
      "Corrections",
    ]);
  });

  it("exposes stable anchors so other pages can cite a rule", () => {
    for (const id of [
      "sources",
      "precedence",
      "refresh",
      "usd-vs-zec",
      "payment-not-delivery",
      "reconciliation",
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it("keeps USD and ZEC non-additive", () => {
    expect(html).toContain("must not be added together");
  });

  it("points CSV at the data endpoints and links reconciliation", () => {
    expect(html).toContain("/api/zcg/data/");
    expect(html).toContain("Disbursement rows carry provenance");
    expect(html).toContain('href="/zcg/reconciliation"');
  });
});
