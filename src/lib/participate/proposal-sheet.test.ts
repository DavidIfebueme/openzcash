import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/zcg/csv";
import { PROPOSAL_SHEET_COLUMNS, proposalDraftErrors, proposalDraftFromCells, proposalLinkIdentity, proposalSheetCsv, proposalSheetTsv, readProposalSheet, sheetDateToIso, type ProposalSheetDraft } from "./proposal-sheet";
const source = "https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/494";
const draft: ProposalSheetDraft = { submitted: "2026-10-14", title: "Local test proposal", applicant: "Test applicant", platformUrl: source, forumUrl: "https://forum.zcashcommunity.com/t/local/58207", status: "Approved", decided: "2026-10-15" };
const cells = ["10/14/2026",draft.title,draft.applicant,source,"", "ZCG to discuss", "", "=G2-A2", "900000", "BR", "Organization"];
const rows = [[...PROPOSAL_SHEET_COLUMNS, "Decision Turnaround Days", "Amount Funded in 2021 (in USD)", "Country", "Organization or Individual"], cells];
describe("proposal register handoff", () => {
 it("matches canonical source links, never a title, and preserves the seven existing fields", () => {
  const data=readProposalSheet(rows, `${source}#issuecomment-123`, "https://docs.google.com/sheet", "2026-10-15T12:00:00Z");
  expect(data.match).toEqual({row:2,cells:cells.slice(0,7)}); expect(data.matchCount).toBe(1);
  expect(proposalDraftFromCells(data.match!.cells)).toMatchObject({title:draft.title,status:"ZCG to discuss",decided:"",submitted:"2026-10-14"});
  expect(readProposalSheet(rows, source.replace("494","495"), "", "").match).toBeNull();
 });
 it("blocks ambiguous identity and changed columns", () => {
  expect(readProposalSheet([...rows,cells],source,"","")).toMatchObject({match:null,matchCount:2});
  expect(()=>readProposalSheet([["Date",...PROPOSAL_SHEET_COLUMNS.slice(1)],cells],source,"","")).toThrow("SHEET_LAYOUT_CHANGED");
  for(const link of ["http://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/494", "https://github.com.evil.test/ZcashCommunityGrants/zcashcommunitygrants/issues/494", "https://user:pass@github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/494"]) expect(proposalLinkIdentity(link)).toBeNull();
 });
 it("exports only A:G, preserving all financial and calculated columns by exclusion", () => {
  const tsv=proposalSheetTsv(draft).split("\t"); expect(tsv).toHaveLength(7); expect(tsv[0]).toBe("10/14/2026"); expect(tsv[6]).toBe("10/15/2026");
  const csv=parseCsv(proposalSheetCsv(draft)); expect(csv).toHaveLength(2); expect(csv[0]).toEqual([...PROPOSAL_SHEET_COLUMNS]); expect(csv[1]).toEqual(tsv);
  expect(csv.flat()).not.toContain("900000"); expect(csv.flat()).not.toContain("Decision Turnaround Days");
 });
 it("contains spreadsheet formulas and embedded row separators in both copy and CSV", () => {
  const hostile={...draft,title:'=HYPERLINK("https://evil.test")\n\tTitle',applicant:'+cmd\rname'};
  const tsv=proposalSheetTsv(hostile); expect(tsv.split("\t")).toHaveLength(7); expect(tsv).not.toContain("\n"); expect(tsv.split("\t")[1]).toMatch(/^'=/); expect(tsv.split("\t")[2]).toMatch(/^'\+/);
  expect(parseCsv(proposalSheetCsv(hostile))[1]).toEqual(tsv.split("\t"));
 });
 it("does not invent a decision date or payment from a signed result", () => {
  expect(proposalDraftErrors({...draft,decided:""})).toContain("Confirm the committee decision date.");
  expect(proposalDraftErrors({...draft,decided:"2026-10-13"})).toContain("The decision date must be on or after submission.");
  expect(proposalDraftErrors({...draft,status:"Application Withdrawn",decided:""})).toEqual([]);
  expect(proposalDraftErrors({...draft,forumUrl:"https://evil.test/t/1"})).toContain("Check the Zcash Forum topic link.");
 });
 it("parses dates without accepting impossible calendar dates", () => {
  expect(sheetDateToIso("2/29/24")).toBe("2024-02-29"); expect(sheetDateToIso("10/5/2026")).toBe("2026-10-05");
  for(const date of ["2/29/2026","2026-02-30","13/1/2026","unknown"]) expect(sheetDateToIso(date)).toBe("");
 });
});
