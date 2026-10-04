import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CommunityCredit } from "./community-credit";

describe("screen contribution credit", () => {
  it("keeps the existing design attribution for Coinholder verification", () => {
    const html = renderToStaticMarkup(<CommunityCredit screen="coinholder-verification" />);
    expect(html).toContain('id="community-credit"');
    expect(html).toContain("Page design by <strong>vaspholdings</strong>");
    expect(html).toContain("Built by OpenZcash");
  });
  it("attributes the history contribution without assigning project or design authorship", () => {
    const html = renderToStaticMarkup(<CommunityCredit screen="project-history" />);
    expect(html).toContain("Community contribution by <strong>socrates1024</strong>");
    expect(html).toContain("Designed and built by OpenZcash");
    expect(html).not.toContain("Page design by");
    expect(renderToStaticMarkup(<CommunityCredit screen="project-history" compact />)).toContain('href="#community-credit"');
  });
});
