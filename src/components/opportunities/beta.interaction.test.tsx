// @vitest-environment jsdom
import type { AnchorHTMLAttributes, ImgHTMLAttributes } from "react";
import { act, cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OpportunitiesLayout } from "./frame";
import { OpportunitiesRoutes } from "./routes";
import { Editor } from "./editor";
import { curatedItems, type Catalog } from "./catalog";
const navigation = vi.hoisted(() => ({ path: "/opportunities", search: "", refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.path, useSearchParams: () => new URLSearchParams(navigation.search), useRouter: () => navigation }));
vi.mock("next/link", () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }));
vi.mock("next/image", () => ({ default: ({ unoptimized: _u, ...props }: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => { void _u; return <img {...props} alt={props.alt ?? ""} />; } })); // eslint-disable-line @next/next/no-img-element
const items = [...curatedItems].reverse();
function Directory() { return <OpportunitiesLayout catalog={{ items, sources: [{ id: "zec-bounties", status: "available", checkedAt: "2026-11-03" }] }}><OpportunitiesRoutes /></OpportunitiesLayout>; }
beforeEach(() => {
  navigation.path = "/opportunities"; navigation.search = "";
  navigation.refresh.mockClear();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
it("shows jobs and programs with no local account, application or publication controls", () => {
  render(<Directory />);
  expect(screen.getByRole("button", { name: "Jobs" })).toBeTruthy();
  expect(screen.queryByText("My work")).toBeNull();
  expect(screen.queryByRole("button", { name: /sign in|apply for|submit entry|publish/i })).toBeNull();
  expect(screen.getByRole("link", { name: "Prepare activity" }).getAttribute("href")).toBe("/opportunities/prepare");
});
it("preserves the initial mixed order and filter return path through details", () => {
  const view = render(<Directory />);
  const titles = () => Array.from(view.container.querySelectorAll(".directory-card h2")).map((x) => x.textContent);
  expect(titles()).toEqual(items.map((x) => x.title));
  navigation.search = "type=Job"; view.rerender(<Directory />);
  expect(titles()).toEqual(items.filter((x) => x.kind === "Job").map((x) => x.title));
  navigation.path = "/opportunities/tasks/shielded-labs-cryptographer"; view.rerender(<Directory />);
  expect(screen.getByRole("link", { name: "Back to opportunities" }).getAttribute("href")).toBe("/opportunities?type=Job");
  expect(screen.getByRole("link", { name: "View role at Shielded Labs" }).getAttribute("href")).toBe("https://shieldedlabs.net/jobs/");
  expect(screen.getByRole("link", { name: "Read the guide" }).getAttribute("href")).toBe("https://shieldedlabs.net/jobs/");
  navigation.path = "/opportunities"; navigation.search = ""; view.rerender(<Directory />);
  expect(titles()).toEqual(items.map((x) => x.title));
});
it("directs Crosslink to incentives and HashSmash to Yukon without a local reward", () => {
  navigation.path = "/opportunities/tasks/crosslink-incentives";
  const view = render(<Directory />);
  expect(screen.getByRole("link", { name: "View Crosslink incentives" }).getAttribute("href")).toBe("/ongoing-test/crosslink?tab=incentives");
  navigation.path = "/opportunities/tasks/hashsmash"; view.rerender(<Directory />);
  expect(screen.getByRole("link", { name: "Participate on Yukon" }).getAttribute("href")).toBe("https://www.yukon.org/hashsmash");
  expect(screen.queryByText(/first place|example reward|november/i)).toBeNull();
});
it("provides all stock images as downloads, with searchable artwork", () => {
  navigation.path = "/opportunities/art"; render(<Directory />);
  expect(screen.getAllByRole("link", { name: /^Download / })).toHaveLength(29);
  fireEvent.change(screen.getByRole("textbox", { name: "Search artwork" }), { target: { value: "yukon" } });
  expect(screen.getAllByRole("link", { name: /^Download / })).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Download HashSmash · Yukon" }).hasAttribute("download")).toBe(true);
});
it("uses fresh page data instead of records retained by the shared layout", () => {
  const initial: Catalog = { items, sources: [] };
  const removed = items[0];
  const fresh: Catalog = { items: items.slice(1).reverse(), sources: [] };
  const view = render(<OpportunitiesLayout catalog={initial}><OpportunitiesRoutes catalog={initial} /></OpportunitiesLayout>);
  view.rerender(<OpportunitiesLayout catalog={initial}><OpportunitiesRoutes catalog={fresh} /></OpportunitiesLayout>);
  expect(Array.from(view.container.querySelectorAll(".directory-card h2")).map((x) => x.textContent)).toEqual(items.slice(1).map((x) => x.title));
  expect(screen.queryByRole("link", { name: "View " + removed.title })).toBeNull();
  navigation.path = "/opportunities/tasks/" + removed.id;
  view.rerender(<OpportunitiesLayout catalog={initial}><OpportunitiesRoutes catalog={fresh} /></OpportunitiesLayout>);
  expect(screen.getByText("This opportunity is no longer listed")).toBeTruthy();
  expect(screen.queryByRole("link", { name: removed.actionLabel })).toBeNull();
});
it("refreshes visible listings periodically and on focus, but leaves preparation alone", () => {
  vi.useFakeTimers();
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  const view = render(<Directory />);
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(navigation.refresh).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue("hidden");
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(navigation.refresh).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue("visible");
  fireEvent.focus(window);
  expect(navigation.refresh).toHaveBeenCalledTimes(2);
  navigation.path = "/opportunities/prepare"; view.rerender(<Directory />);
  fireEvent.focus(window);
  act(() => { vi.advanceTimersByTime(60_000); });
  expect(navigation.refresh).toHaveBeenCalledTimes(2);
});
it("preserves an in-progress brief when refreshed layout data arrives", () => {
  navigation.path = "/opportunities/prepare"; navigation.search = "provider=gleyo";
  const initial: Catalog = { items, sources: [] };
  const view = render(<OpportunitiesLayout catalog={initial}><OpportunitiesRoutes catalog={initial} /></OpportunitiesLayout>);
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "My unfinished quest" } });
  const fresh = { ...initial, items: [...items].reverse() };
  view.rerender(<OpportunitiesLayout catalog={fresh}><OpportunitiesRoutes catalog={fresh} /></OpportunitiesLayout>);
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("My unfinished quest");
});
it("prepares a quest with artwork and copies a brief without account creation or a network submission", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  render(<Editor initialProvider="gleyo" />);
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Try a private wallet" } });
  fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "Explore a wallet and share a useful onboarding report." } });
  fireEvent.change(screen.getByLabelText(/Tasks · up to 5/), { target: { value: "Read the guide\nWrite a short report" } });
  fireEvent.change(screen.getByLabelText("XP (optional)"), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: "Change cover" }));
  const dialog = screen.getByRole("dialog", { name: "Choose a cover" });
  expect(within(dialog).getAllByRole("button", { name: /^Choose / })).toHaveLength(29);
  fireEvent.click(within(dialog).getByRole("button", { name: "Choose Zingo!" }));
  fireEvent.click(screen.getByRole("button", { name: "Review & take to platform" }));
  fireEvent.click(screen.getByRole("button", { name: "Copy brief" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  expect(writeText.mock.calls[0][0]).toContain("XP: 100");
  expect(writeText.mock.calls[0][0]).toContain("/opportunities/art/zingo.png");
  expect(writeText.mock.calls[0][0]).not.toContain("ZEC reward pool:");
  expect(screen.getByRole("link", { name: "Continue to Gleyo" }).getAttribute("href")).toBe("https://gleyo.app/");
  expect(screen.getByRole("link", { name: "Download cover" }).hasAttribute("download")).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});
