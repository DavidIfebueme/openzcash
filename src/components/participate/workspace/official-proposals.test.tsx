// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useOfficialProposals } from "./official-proposals";
const initial = { version: 1 as const, readAt: "2026-10-13T04:00:00.000Z", proposals: [] };
beforeEach(() => { vi.useFakeTimers(); Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("refreshes the whole queue in one read per minute and retains it on failure", async () => {
  const next = { ...initial, proposals: [{issueNumber:486, title:"Konclave", url:"https://github.com/ZcashCommunityGrants/zcashcommunitygrants/issues/486", applicant:"author", submitted:"2026-10-13", requestedUsd:18000, outcome:"under_review"}] };
  const fetcher = vi.fn().mockResolvedValueOnce({ok:true,json:async()=>next}).mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch",fetcher);
  const { result } = renderHook(() => useOfficialProposals(initial,true));
  expect(fetcher).not.toHaveBeenCalled();
  await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
  expect(result.current.snapshot).toEqual(next); expect(fetcher).toHaveBeenCalledTimes(1);
  await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
  expect(result.current.snapshot).toEqual(next); expect(result.current.unavailable).toBe(true);
});
it("does not poll a hidden page or a non-native archive view", async () => {
  const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
  Object.defineProperty(document,"visibilityState",{configurable:true,value:"hidden"});
  renderHook(()=>useOfficialProposals(initial,true));
  renderHook(()=>useOfficialProposals(null,false));
  await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
  expect(fetcher).not.toHaveBeenCalled();
});
