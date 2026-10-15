// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReviewFinish, ProposalSheetHandoff } from "./review-finish";
import type { ProposalRecord } from "@/lib/participate/workspace/domain/proposal-record";
import { PROPOSAL_SHEET_COLUMNS } from "@/lib/participate/proposal-sheet";
vi.mock("@/lib/participate/workspace/data/zcg-source-metadata",()=>({zcgSourceMetadata:()=>undefined}));
const record={recordId:"test-proposal",revision:1,title:"Local test",kind:"NATIVE_PROPOSAL",submittedAt:"2026-10-14T15:00:00Z",originalDecisionDate:null,application:{applicant:"Test team",requestedAmountUsd:"900000"}} as ProposalRecord;
const endpoint="/api/communities/local/archives/test-proposal", roundId="a05403ac-b3b1-48c9-b4dd-c5d4aed1dc0d";
const published={publication:"PUBLISHED",round:{id:roundId,proposal:{recordId:record.recordId,revision:1}},tally:{signed:5,eligible:5,outcome:"APPROVED",approve:3,reject:1,abstain:1},progress:{signed:5,eligible:5}};
const context={checkedAt:"2026-10-15T12:00:00Z",sheetUrl:"https://docs.google.com/sheet#gid=123",columns:[...PROPOSAL_SHEET_COLUMNS],statuses:["Approved","Rejected","ZCG to discuss"],matchCount:1,match:{row:734,cells:["10/14/2026","Existing official title","Named applicant",`https://openzcash.org/zcg/participate?record=${record.recordId}`,"","ZCG to discuss",""]}};
const fetcher=vi.fn(), copy=vi.fn();
const response=(value:unknown)=>Promise.resolve(new Response(JSON.stringify(value),{status:200}));
beforeEach(()=>{vi.stubGlobal("fetch",fetcher);Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:copy.mockResolvedValue(undefined)}});});
afterEach(()=>{cleanup();vi.resetAllMocks();vi.unstubAllGlobals();});
it("keeps a collecting review out of sheet handoff",async()=>{
 fetcher.mockImplementation((url:string)=>response(url.includes("/decisions")?{...published,publication:"COLLECTING",tally:undefined,progress:{signed:4,eligible:5}}:{record}));
 render(<ReviewFinish endpoint={endpoint} recordId={record.recordId} revision={1} roundId={roundId} visible />);
 await screen.findByText("4 of 5 responses recorded"); expect(screen.queryByText("Prepare proposal row")).toBeNull();expect(fetcher.mock.calls).toHaveLength(2);
});
it("shows only the current review's anchor, never a different event's verification",async()=>{
 fetcher.mockImplementation((url:string)=>response(url.includes("/decisions")?published:url.includes("/activity")?{items:[{id:"unrelated",kind:"REVIEW_DECIDED",review:{roundId:"other",revision:1},state:"VERIFIED"}]}:{record}));
 render(<ReviewFinish endpoint={endpoint} recordId={record.recordId} revision={1} roundId={roundId} visible />);
 await screen.findByText("Approved · 5 of 5 signed");expect(screen.getByText("Receipt not linked yet")).toBeTruthy();expect(screen.queryByText("Verified at last check")).toBeNull();
 expect(fetcher).toHaveBeenCalledWith(`${endpoint}/activity?round=${roundId}`,expect.objectContaining({cache:"no-store"}));
});
it("requires manual official status/date review and copies seven cells without touching Sheets",async()=>{
 fetcher.mockImplementation(()=>response(context));render(<ProposalSheetHandoff record={record} />);
 fireEvent.click(screen.getByRole("button",{name:"Prepare proposal row"}));await screen.findByText("Existing proposal · Row 734");
 expect((screen.getByLabelText("Proposal title") as HTMLInputElement).value).toBe("Existing official title");
 expect((screen.getByLabelText("Sheet status") as HTMLSelectElement).value).toBe("ZCG to discuss");
 expect((screen.getByLabelText("Committee decision date") as HTMLInputElement).value).toBe("");
 const button=screen.getByRole("button",{name:"Copy A–G"}) as HTMLButtonElement;expect(button.disabled).toBe(true);
 fireEvent.change(screen.getByLabelText("Sheet status"),{target:{value:"Approved"}});fireEvent.click(screen.getByRole("checkbox"));expect(button.disabled).toBe(true);expect(screen.getByText("Confirm the committee decision date.")).toBeTruthy();
 fireEvent.change(screen.getByLabelText("Committee decision date"),{target:{value:"2026-10-15"}});expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
 fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(button);
 await screen.findByText(/Row copied. Paste into A734:G734/);expect(copy.mock.calls[0][0].split("\t")).toHaveLength(7);expect(copy.mock.calls[0][0]).not.toContain("900000");
 expect(screen.getByRole("link",{name:"Open Google Sheets ↗"}).getAttribute("href")).toContain("range=A734%3AG734");expect(fetcher.mock.calls).toHaveLength(1);
});
it("blocks exports when duplicate rows or a layout failure require intervention",async()=>{
 fetcher.mockImplementation(()=>response({...context,match:null,matchCount:2}));render(<ProposalSheetHandoff record={record} />);
 fireEvent.click(screen.getByRole("button",{name:"Prepare proposal row"}));await screen.findByRole("alert");expect(screen.queryByRole("button",{name:"Copy A–G"})).toBeNull();expect(copy).not.toHaveBeenCalled();
});
it("rejects stale revision results instead of exporting a different review",async()=>{
 fetcher.mockImplementation((url:string)=>response(url.includes("/decisions")?published:{record:{...record,revision:2}}));
 render(<ReviewFinish endpoint={endpoint} recordId={record.recordId} revision={1} roundId={roundId} visible />);
 await waitFor(()=>expect(screen.getByRole("alert").textContent).toContain("Could not confirm this revision"));expect(screen.queryByText("Prepare proposal row")).toBeNull();
});
