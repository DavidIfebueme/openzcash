import { describe, expect, it } from "vitest";
import registry from "@/data/ecosystem/registry.json";
import snapshot from "@/data/ecosystem/snapshot.json";
import type { Catalog } from "@/lib/ecosystem/types";
import { isGrantFunded } from "@/lib/ecosystem/catalog";
import { historyIdentities } from "./identities";
import { buildProjectHistory } from "./build";
import type { FinanceRecords } from "./types";

const identities = historyIdentities({ registry, snapshot } as unknown as Catalog);
const finance: FinanceRecords = { proposals: [], payments: [], proposalsAvailable: true, paymentsAvailable: true, importedAt: null };
const history = (id: string) => buildProjectHistory(identities.find(item => item.id === id)!, identities, finance, snapshot.collectedAt);

describe("reviewed source mapping boundaries", () => {
  it("keeps ZecKit status notes as context instead of creating additional grants", () => {
    const result = history("zeckit");
    expect(result.grants.map(grant => grant.title)).toEqual(["Zebra Regtest CI Kit (ZRK)"]);
    const context = result.timeline.filter(event => event.source.label === "Grant status context");
    expect(context).toHaveLength(2);
    expect(context.every(event => event.kind === "context" && event.grantId === null)).toBe(true);
    expect(context.map(event => event.date)).toEqual(["2026-07-20", "2026-02-20"]);
    expect(context.every(event => event.detail.includes("not a separate award"))).toBe(true);
  });
  it("does not classify a project as funded from a contextual approval alone", () => {
    const project = structuredClone(identities.find(item => item.id === "zeckit")!.project!);
    project.funding.events = [{ title: "Past decision context", status: "approved", kind: "context", sourceUrl: "https://example.org/context" }];
    expect(isGrantFunded(project)).toBe(false);
  });
  it("carries every already-curated community DAO reference without new amounts", () => {
    const mapped = identities.filter(item => item.daoFundingSources?.length);
    expect(mapped).toHaveLength(11);
    expect(mapped.flatMap(item => item.daoFundingSources!)).toHaveLength(25);
    for (const identity of mapped) {
      const result = history(identity.id);
      const dao = result.timeline.filter(event => event.source.label === "ZecHub DAO proposal");
      expect(dao).toHaveLength(identity.daoFundingSources!.length);
      for (const event of dao) {
        expect(event).toMatchObject({ kind: "context", grantId: null, evidence: "source_record" });
        expect(event.source.url).toMatch(/^https:\/\/daodao\.zone\/dao\/.+\/proposals\/A[0-9]+$/);
        expect(event.detail).toContain("proposal creation, not approval or payment");
        expect(event).not.toHaveProperty("budgetUsdCents");
        expect(event).not.toHaveProperty("recordedZecZat");
      }
      expect(result.gaps.some(gap => gap.includes("DAO payments and totals are not included"))).toBe(true);
    }
  });
  it("links Ghana’s new application by its verified forum topic, not by a name guess", () => {
    const identity = identities.find(item => item.id === "community-zcash-ghana")!;
    expect(identity.applicationTopics).toContain(57632);
    const current: FinanceRecords = { ...finance, proposals: [{ id: "ghana-q4", program: "zcg", title: "Zcash Ghana (October 2026 - December 2026)", status: "approved", submittedDate: "2026-09-16", decisionDate: "2026-09-28", requestedUsdCents: "1260000", platformLink: "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/428", forumLink: "https://forum.zcashcommunity.com/t/zcash-ghana-october-2026-december-2026/57632", source: { label: "Synthetic ledger fixture", url: "https://example.org/ledger", observedAt: "2026-10-01" } }] };
    const result = buildProjectHistory(identity, identities, current, snapshot.collectedAt);
    expect(result.grants[0]).toMatchObject({ title: current.proposals[0].title, requestedUsdCents: "1260000", approvedUsdCents: null });
    expect(result.grants[0].milestones).toEqual([]);
  });
  it("keeps a DAO-funded community visible while ZCG/Coinholder amounts stay unlinked", () => {
    const result = history("community-zcash-club-queretaro");
    expect(result.grants).toEqual([]);
    expect(result.timeline.find(event => event.id === "dao-context-A178")).toMatchObject({ date: "2026-09-12", source: { observedAt: "2026-09-30" } });
    expect(result.gaps).toContain("No project-specific ZCG/Coinholder grant identity is linked. This does not establish that the project is unfunded.");
  });
});
