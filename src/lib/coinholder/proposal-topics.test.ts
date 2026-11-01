import { describe, expect, it } from "vitest";
import { proposalTopic } from "./proposal-topics";

describe("proposal display topics", () => {
  it.each([
    "Critical Zebra Block Discovery DoS (CVE-2026-44499)",
    "Zebra High-Severity Mempool DoS Disclosure (GHSA-7jp4-mq53-4cvq)",
    "Responsible vulnerability disclosure",
    "Security research retrospective",
    "Retroactive bug bounty request",
  ])("identifies explicit security research in %s", (title) => {
    expect(proposalTopic({ title, category: "Research & Development" })).toBe("Security research");
  });

  it("preserves general research and other source categories", () => {
    expect(proposalTopic({ title: "New consensus research", category: "Research & Development" })).toBe("Research & Development");
    expect(proposalTopic({ title: "Maya Protocol: Zebra migration and ZEC signing hardening", category: "Integration" })).toBe("Integration");
    expect(proposalTopic({ title: "Educational series about CVE-2026-44499", category: "Education" })).toBe("Education");
  });

  it("uses a neutral topic when the source category is missing", () => {
    expect(proposalTopic({ title: "CVE-2026-44499 disclosure", category: null })).toBe("Uncategorized");
  });
});
