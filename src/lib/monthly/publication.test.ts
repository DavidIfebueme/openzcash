import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { editionSchema, editionLabel, monthlyEditions, monthlyReadingSets, readingSetSchema } from "./catalog";
import { fitPage, pageFromHash, pageManifestSchema, sourceUrl } from "./reader";
import { publicationTarget, publicationView } from "./reading-set";

const publicFile = (path: string) => join(process.cwd(), "public", path);
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");

describe("monthly publication integrity", () => {
  it("offers closed August and September editions without the retired September sample", () => {
    expect(monthlyEditions.map((edition) => edition.id).sort()).toEqual(monthlyReadingSets.map((set) => set.id).sort());
    const august = monthlyEditions.find((edition) => edition.id === "2026-08")!;
    const september = monthlyEditions.find((edition) => edition.id === "2026-09")!;
    expect(editionLabel(august)).toBe("August 2026");
    expect(editionLabel(september)).toBe("September 2026");
    expect(september.periodStart).toBe("2026-09-01");
    expect(september.periodEnd).toBe("2026-09-30");
    expect(monthlyEditions.some((edition) => edition.id === "2026-09-01-to-10")).toBe(false);
    expect(august.periodEnd).toBe("2026-08-31");
    expect(monthlyEditions.some((edition) => edition.kind === "reference")).toBe(false);
    expect(editionSchema.safeParse({...august, periodEnd:"2026-09-10"}).success).toBe(false);
    expect(editionSchema.safeParse({...august, periodStart:"2026-08-02"}).success).toBe(false);
  });
  it("has unique editions and at most one standard issue per publication month", () => {
    expect(new Set(monthlyEditions.map((e) => e.id)).size).toBe(monthlyEditions.length);
    const standard = monthlyEditions.filter((e) => e.kind === "monthly");
    expect(new Set(standard.map((e) => e.month)).size).toBe(standard.length);
  });

  for (const edition of [...monthlyEditions, ...monthlyReadingSets.map((set) => set.documents.operations)]) {
    it(`${edition.id} / ${edition.sha256.slice(0, 12)}: serves the exact reviewed PDF with its own complete page register`, () => {
      const pdf = readFileSync(publicFile(edition.pdf));
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.length).toBe(edition.bytes);
      expect(hash(pdf)).toBe(edition.sha256);
      expect(edition.assetBase).toContain(`/${edition.id}/${edition.sha256.slice(0, 12)}`);
      expect(existsSync(publicFile(edition.cover))).toBe(true);
      const pages = pageManifestSchema.parse(JSON.parse(readFileSync(publicFile(edition.manifest), "utf8")));
      expect(pages).toHaveLength(edition.pageCount);
      for (const [i, page] of pages.entries()) {
        expect(page.number).toBe(i + 1);
        expect(page.text.trim().length).toBeGreaterThan(0);
        expect(existsSync(publicFile(`${edition.assetBase}/page-${String(page.number).padStart(3, "0")}.jpg`))).toBe(true);
        for (const link of page.links) {
          expect(link.x + link.w).toBeLessThanOrEqual(1.001);
          expect(link.y + link.h).toBeLessThanOrEqual(1.001);
          if ("page" in link) expect(link.page).toBeLessThanOrEqual(edition.pageCount);
        }
      }
    });
  }

  it("preserves the approved ten-page reading order and public Operations handoff", () => {
    const latest = monthlyEditions[0];
    const pages = pageManifestSchema.parse(JSON.parse(readFileSync(publicFile(latest.manifest), "utf8")));
    expect(latest.designVersion).toBe("Editorial 4.0 / Covers 2");
    expect(pages).toHaveLength(10);
    expect(pages[5].title.toLowerCase()).toContain("wallet");
    expect(pages[8].title.toLowerCase()).toContain("products");
    expect(pages[9].links).toContainEqual(expect.objectContaining({url:`https://openzcash.org/monthly/${latest.id}?publication=operations#1`}));
    for (const set of monthlyReadingSets) for (const edition of Object.values(set.documents)) {
      const manifest = JSON.parse(readFileSync(publicFile(edition.manifest), "utf8"));
      expect(JSON.stringify(manifest)).not.toMatch(/localhost|127\.0\.0\.1|monthly-preview/);
    }
  });

  it("rejects incomplete bundles and mismatched publication cutoffs", () => {
    const set = monthlyReadingSets[0];
    expect(set).toBeDefined();
    expect(readingSetSchema.safeParse({...set, documents:{monthly:set.documents.monthly}}).success).toBe(false);
    expect(readingSetSchema.safeParse({...set, evidenceCutoff:"2026-09-11"}).success).toBe(false);
    const otherIssue = set.id === "2026-01" ? "2026-02" : "2026-01";
    expect(readingSetSchema.safeParse({...set, documents:{...set.documents, operations:{...set.documents.operations, id:otherIssue}}}).success).toBe(false);
  });

  it("keeps the PDF module, worker and fonts from the same pinned distribution", () => {
    const dir = publicFile("/monthly/pdfjs/5.6.205");
    const distribution = JSON.parse(readFileSync(join(dir, "distribution.json"), "utf8"));
    expect(distribution.version).toBe("5.6.205");
    expect(Object.keys(distribution.files)).toContain("pdf.worker.min.mjs");
    for (const [file, expected] of Object.entries(distribution.files)) expect(hash(readFileSync(join(dir, file)))).toBe(expected);
  });

  it("rejects inconsistent dates, external assets and changed page geometry", () => {
    const sample = monthlyEditions[0];
    for (const patch of [{ periodStart: "2027-01-01" }, { periodEnd: "2026-10-01" }, { pdf: "https://example.com/report.pdf" }, { pageWidth: 1920 }]) {
      expect(editionSchema.safeParse({ ...sample, ...patch }).success).toBe(false);
    }
  });
});

describe("reader navigation", () => {
  it("resolves a public cross-publication link inside the matching reader only", () => {
    const path = "/monthly/2026-09-01-to-10";
    expect(publicationTarget(`https://openzcash.org${path}?publication=operations#1`, path, "http://127.0.0.1:4194"))
      .toEqual({view:"operations",page:1});
    for (const href of [`https://example.com${path}?publication=operations#1`, "https://openzcash.org/monthly/2026-10?publication=operations#1"])
      expect(publicationTarget(href,path,"https://openzcash.org")).toBeNull();
    expect(publicationView("voter")).toBe("operations");
    expect(publicationView("unknown")).toBe("monthly");
  });
  it("bounds deep links and rejects invalid page fragments", () => {
    expect(pageFromHash("#7", 44)).toBe(7);
    expect(pageFromHash("#999", 44)).toBe(44);
    for (const value of ["", "#0", "#-1", "#NaN", "#2.5", "#Infinity"]) expect(pageFromHash(value, 44)).toBe(1);
  });

  it.each([[1440, 900], [947, 533], [360, 580], [740, 210], [0, 0]])("fits the whole page in a %i × %i stage", (width, height) => {
    const fitted = fitPage(width, height);
    expect(fitted.width).toBeLessThanOrEqual(width);
    expect(fitted.height).toBeLessThanOrEqual(height);
    expect(fitted.width).toBeGreaterThanOrEqual(0);
    expect(fitted.height).toBeGreaterThanOrEqual(0);
    if (fitted.width) expect(Math.abs(fitted.width / (16 / 9) - fitted.height)).toBeLessThan(1);
  });

  it("only opens ordinary source links from the report", () => {
    expect(sourceUrl("https://openzcash.org/wallets")).toBe("https://openzcash.org/wallets");
    for (const value of ["javascript:alert(1)", "data:text/html,test", "//example.com", "/monthly", "https://user:password@example.com"]) expect(sourceUrl(value)).toBeNull();
  });
});
