import { describe, expect, it } from "vitest";
import { bundledZipCorpus, searchKnowledge, searchTerms } from "./knowledge";
import { latestZipAnswer, zipCatalogEvidence, requestedZips } from "./zip-catalog";

describe("ZIP catalog retrieval and date semantics", () => {
  it("retrieves every numbered ZIP by its own number within the context budget", () => {
    for (const doc of bundledZipCorpus.documents.filter((d) => d.number !== null)) {
      const found = searchKnowledge(`Explain ZIP ${doc.number}`);
      expect(found.some((d) => d.url === doc.url), doc.id).toBe(true);
      expect(JSON.stringify(found).length).toBeLessThanOrEqual(5000);
    }
  });
  it("preserves the pool-specific section of a derivation excerpt", () => {
    const docs = searchKnowledge("ZIP 32 Orchard child key derivation");
    expect(docs.some((d) => d.section?.includes("Orchard"))).toBe(true);
  });
  it("keeps words such as constructor safe in the larger technical corpus", () => expect(searchTerms("constructor prototype")).toEqual(["constructor", "prototype"]));
  it("separates Created sorting, highest number, missing dates and publication", () => {
    const data = JSON.parse(zipCatalogEvidence("latest ZIP", bundledZipCorpus, false).content).data;
    expect(data.numberedDocuments).toBe(bundledZipCorpus.documents.filter((d) => d.number !== null).length);
    expect(data.selectedBy).toContain("not publication date");
    expect(data.notes).toContain("NOT verified first publication");
    expect(data.selected[0].number).not.toBe(data.highestNumber.number);
    expect(data.missingCreatedDates).toBeGreaterThan(0);
  });
  it("reports unknown identifiers instead of substituting a similar ZIP", () => {
    expect(requestedZips("Compare ZIP 0310 and ZIP 99999")).toEqual([310, 99999]);
    expect(requestedZips("Compare ZIPs 214 e 1015")).toEqual([214, 1015]);
    const data = JSON.parse(zipCatalogEvidence("ZIP 99999", bundledZipCorpus, false).content).data;
    expect(data.selected).toEqual([]); expect(data.missingNumbers).toEqual([99999]);
  });
  it("answers only plain single-intent latest questions directly, with provenance", () => {
    expect(latestZipAnswer("Qual é o último ZIP?", bundledZipCorpus, false, true)).toMatch(/Created.*259/);
    expect(latestZipAnswer("What is the latest ZIP?", bundledZipCorpus, false, false)).toContain("not verified first publication");
    expect(latestZipAnswer("What is the latest ZIP?", bundledZipCorpus, true, false)).toBeUndefined();
    expect(latestZipAnswer("What is the latest ZIP? Answer in French.", bundledZipCorpus, false, false)).toBeUndefined();
    expect(latestZipAnswer("What is the latest ZIP and is it activated?", bundledZipCorpus, false, false)).toBeUndefined();
  });
});
