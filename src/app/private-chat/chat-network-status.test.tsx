// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ChatNetworkStatus } from "./chat-network-status";
import { NETWORK_REFRESH_MS } from "@/lib/private-chat/network-health";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("fetches public status only from this origin and replaces stale success after a failed refresh", async () => {
  vi.useFakeTimers();
  const ok = { state: "ok", up: 1, total: 1 };
  const request = vi.fn()
    .mockResolvedValueOnce(Response.json({ checkedAt: Date.now(), services: { validators: ok, signers: ok, api: ok }, mixnodes: { state: "ok", count: 60 }, gateways: { state: "ok", count: 627 }, gateway: { state: "ok", performance: 99, reason: "eligible" } }))
    .mockRejectedValue(new Error("offline"));
  vi.stubGlobal("fetch", request);
  const { unmount } = render(<ChatNetworkStatus />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(screen.getByText("Checks passing", { selector: "span" })).toBeInTheDocument();
  expect(screen.getByText("99%")).toBeInTheDocument();
  expect(request).toHaveBeenCalledWith("/api/private-chat/network-status", expect.objectContaining({ credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" }));
  expect(screen.getByRole("link", { name: "Nym Status ↗", hidden: true })).toHaveAttribute("rel", "noopener noreferrer");
  await act(async () => { await vi.advanceTimersByTimeAsync(NETWORK_REFRESH_MS); });
  expect(screen.getByText("Status unavailable")).toBeInTheDocument();
  expect(screen.queryByText("99%")).not.toBeInTheDocument();
  unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(NETWORK_REFRESH_MS); });
  expect(request).toHaveBeenCalledTimes(2);
});
it("stops polling in the background and clears an expired green status when the tab returns", async () => {
  vi.useFakeTimers();
  const ok = { state: "ok", up: 1, total: 1 };
  let resume!: (response: Response) => void;
  const request = vi.fn()
    .mockResolvedValueOnce(Response.json({ checkedAt: Date.now(), services: { validators: ok, signers: ok, api: ok }, mixnodes: { state: "ok", count: 60 }, gateways: { state: "ok", count: 627 }, gateway: { state: "ok", performance: 99, reason: "eligible" } }))
    .mockImplementationOnce(() => new Promise<Response>(resolve => { resume = resolve; }));
  vi.stubGlobal("fetch", request);
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  render(<ChatNetworkStatus />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  hidden.mockReturnValue(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(4 * 60_000); });
  expect(request).toHaveBeenCalledTimes(1);
  hidden.mockReturnValue(false);
  fireEvent(document, new Event("visibilitychange"));
  expect(screen.getByText("Status unavailable")).toBeInTheDocument();
  expect(screen.queryByText("99%")).not.toBeInTheDocument();
  await act(async () => { resume(new Response("unavailable", { status: 503 })); });
  expect(request).toHaveBeenCalledTimes(2);
});
