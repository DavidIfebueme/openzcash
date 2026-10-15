// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({committee:vi.fn(),sheet:vi.fn()}));
vi.mock("@/lib/participate/service",()=>({participantCookies:(value:string|null)=>value,readCommitteeWorkspace:mocks.committee}));
vi.mock("@/lib/cache/memo",()=>({cached:(_key:string,_ttl:number,read:()=>unknown)=>read()}));
vi.mock("@/lib/zcg/sheets",()=>({fetchSheetCsv:mocks.sheet,ZCG_GIDS:{proposals:"1164534734"},ZCG_SHEET_ID:"test-public-sheet"}));
import { GET } from "./route";
import { PROPOSAL_SHEET_COLUMNS } from "@/lib/participate/proposal-sheet";
const link="https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/494";
const request=(proposalUrl=link)=>new Request(`http://localhost/api/participate/sheet-handoff?proposalUrl=${encodeURIComponent(proposalUrl)}`,{headers:{cookie:"zcap_session=test"}});
beforeEach(()=>{vi.resetAllMocks();mocks.committee.mockResolvedValue({access:"MEMBER"});mocks.sheet.mockResolvedValue(`${PROPOSAL_SHEET_COLUMNS.join(",")}\n10/14/2026,Test,Applicant,${link},,ZCG to discuss,`);});
it("requires committee access before reading the public register",async()=>{
 for(const access of ["SIGNED_OUT","DENIED","RESTRICTED"]) {mocks.committee.mockResolvedValue({access});expect((await GET(request())).status).toBe(403);}
 expect(mocks.sheet).not.toHaveBeenCalled();
});
it("reads only the configured sheet, retains its shape and returns no-store",async()=>{
 const response=await GET(request());expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("no-store");
 expect(mocks.sheet).toHaveBeenCalledWith("1164534734");expect(await response.json()).toMatchObject({match:{row:2},matchCount:1,columns:[...PROPOSAL_SHEET_COLUMNS]});
});
it("rejects arbitrary URLs and stops on schema drift or upstream failures",async()=>{
 expect((await GET(request("http://127.0.0.1/private"))).status).toBe(400);expect(mocks.sheet).not.toHaveBeenCalled();
 mocks.sheet.mockResolvedValue("different,columns");expect((await GET(request())).status).toBe(409);
 mocks.sheet.mockRejectedValue(new Error("private upstream details"));const response=await GET(request());expect(response.status).toBe(503);expect(await response.json()).toEqual({error:"SHEET_UNAVAILABLE"});
});
