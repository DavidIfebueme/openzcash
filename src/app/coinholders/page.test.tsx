import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reader = vi.hoisted(() => ({ readCoinholderDashboard: vi.fn() }));
vi.mock("@/lib/coinholder/analytics/server", () => reader);
vi.mock("@/components/coinholder-analytics/dashboard", () => ({
  CoinholderDashboardView: ({ initial }: { initial: { round: { id: string } } }) =>
    createElement("section", { "data-round": initial.round.id }, "Voting activity"),
}));
import Page, { metadata } from "./page";

beforeEach(() => reader.readCoinholderDashboard.mockResolvedValue({ round: { id: "q3-2026" } }));

describe("Coinholders analytics entry", () => {
  it("mounts historical analytics within the native OpenZcash page", async () => {
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('data-round="q3-2026"');
    expect(html).toContain("Voting activity");
    expect(html).not.toMatch(/Sign in|Community navigation|Sub-DAOs/);
  });

  it("describes distinct activity, revealed shares and final weights in share metadata", () => {
    expect(metadata.description).toContain("recorded casts");
    expect(metadata.description).toContain("revealed shares");
    expect(metadata.description).toContain("final ZEC weights");
  });
});
