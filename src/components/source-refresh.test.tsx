// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const refresh = vi.hoisted(() => vi.fn());
const router = { refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
import { SourceRefresh } from "./source-refresh";
beforeEach(() => { vi.useFakeTimers(); refresh.mockClear(); Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("updates a visible page and stops after unmount", () => {
  const { unmount } = render(<SourceRefresh />);
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(refresh).toHaveBeenCalledTimes(1);
  unmount();
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(refresh).toHaveBeenCalledTimes(1);
});
it("pauses in the background and refreshes when the page becomes visible", () => {
  render(<SourceRefresh />);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  act(() => { vi.advanceTimersByTime(120_000); });
  expect(refresh).not.toHaveBeenCalled();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(refresh).toHaveBeenCalledTimes(1);
});
it("preserves an unfinished search", () => {
  const { getByRole } = render(<><SourceRefresh /><input aria-label="Search" /></>);
  getByRole("textbox").focus();
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(refresh).not.toHaveBeenCalled();
});
