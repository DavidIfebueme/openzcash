import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RepositoryFreshness } from "./freshness";
describe("repository freshness disclosure", () => {
  it("makes an old snapshot explicit instead of implying current versions", () => {
    const html = renderToStaticMarkup(createElement(RepositoryFreshness, { snapshotAt: "2026-09-08T00:00:00Z", asOf: "2026-10-04T00:00:00Z" }));
    expect(html).toContain("26 days ago");
    expect(html).toContain("Newer releases may exist");
  });
  it("uses the same seven-day boundary as the publication audit", () => {
    expect(renderToStaticMarkup(createElement(RepositoryFreshness, { snapshotAt: "2026-09-27T00:00:00Z", asOf: "2026-10-04T12:00:00Z" }))).toContain("Newer releases may exist");
  });
  it("keeps a recent snapshot quiet and uses an explicit server reference time", () => {
    expect(renderToStaticMarkup(createElement(RepositoryFreshness, { snapshotAt: "2026-10-03", asOf: "2026-10-04" }))).toBe("");
  });
});
