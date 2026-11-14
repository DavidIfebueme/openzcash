// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GovernanceViews, ViewLink } from "./governance-views";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

const PANELS = {
  how: (
    <p>
      How panel <ViewLink view="now">See the schedule</ViewLink>
    </p>
  ),
  now: <p>Now panel</p>,
  polls: <p id="poll-comparison">Polls panel</p>,
  upgrades: <p>Upgrades panel</p>,
  who: <p>Who panel</p>,
};

// A fresh element each time, so a rerender reads the address again.
const views = () => (
  <GovernanceViews
    panels={PANELS}
    counts={{ polls: 10, upgrades: 12 }}
    live="now"
  />
);

const visiblePanels = () =>
  screen.getAllByRole("tabpanel").map((panel) => panel.dataset.view);

beforeEach(() => window.history.replaceState(null, "", "/governance"));
afterEach(cleanup);

describe("governance views", () => {
  it("opens on how it works and keeps the other views in the document", () => {
    const { container } = render(views());
    expect(visiblePanels()).toEqual(["how"]);
    expect(container.querySelectorAll("[data-view]")).toHaveLength(5);
    expect(
      screen
        .getByRole("tab", { name: "How it works" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    expect(
      screen
        .getByRole("tab", { name: "Polls, 10 on record" })
        .getAttribute("aria-selected"),
    ).toBe("false");
  });

  it("shows the record counts and marks the open decision", () => {
    render(views());
    expect(
      screen.getByRole("tab", { name: "Polls, 10 on record" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("tab", { name: "Network upgrades, 12 on record" }),
    ).toBeTruthy();
    const marked = screen
      .getAllByRole("tab")
      .filter((tab) => tab.querySelector('span[aria-hidden="true"]'));
    expect(marked.map((tab) => tab.textContent)).toEqual(["Being decided now"]);
  });

  it("swaps the view in place and keeps it in the address", () => {
    const { rerender } = render(views());
    fireEvent.click(screen.getByRole("tab", { name: "Who does what" }));
    expect(window.location.pathname).toBe("/governance");
    expect(window.location.search).toBe("?view=who");
    rerender(views());
    expect(visiblePanels()).toEqual(["who"]);
  });

  it("opens a shared poll comparison link on the polls", () => {
    window.history.replaceState(null, "", "/governance?question=sprout");
    render(views());
    expect(visiblePanels()).toEqual(["polls"]);
  });

  it("opens the view that holds a linked anchor", () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.history.replaceState(null, "", "/governance#poll-comparison");
    const { rerender } = render(views());
    expect(window.location.search).toBe("?view=polls");
    expect(window.location.hash).toBe("#poll-comparison");
    expect(scrollIntoView).not.toHaveBeenCalled();
    rerender(views());
    expect(visiblePanels()).toEqual(["polls"]);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.instances[0]).toBe(
      document.getElementById("poll-comparison"),
    );
  });

  it("moves between tabs with the arrow keys", () => {
    const { rerender } = render(views());
    const list = screen.getByRole("tablist");
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(window.location.search).toBe("?view=now");
    rerender(views());
    const now = screen.getByRole("tab", { name: "Being decided now" });
    expect(document.activeElement).toBe(now);
    expect(now.tabIndex).toBe(0);
    expect(screen.getByRole("tab", { name: "How it works" }).tabIndex).toBe(-1);
    expect(screen.getByRole("tabpanel").tabIndex).toBe(0);
    fireEvent.keyDown(list, { key: "End" });
    expect(window.location.search).toBe("?view=who");
    rerender(views());
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(window.location.search).toBe("?view=how");
    rerender(views());
    fireEvent.keyDown(list, { key: "ArrowLeft" });
    expect(window.location.search).toBe("?view=who");
  });

  it("leaves other keys alone", () => {
    render(views());
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "a" });
    expect(window.location.search).toBe("");
  });

  it("follows a link from one view to another without navigating", () => {
    const { rerender } = render(views());
    const link = screen.getByRole("link", { name: "See the schedule" });
    expect(link.getAttribute("href")).toBe("?view=now");
    expect(fireEvent.click(link)).toBe(false);
    expect(window.location.search).toBe("?view=now");
    rerender(views());
    expect(visiblePanels()).toEqual(["now"]);
  });

  it("lets a modified click open the view in a new tab", () => {
    render(views());
    const link = screen.getByRole("link", { name: "See the schedule" });
    expect(fireEvent.click(link, { metaKey: true })).toBe(true);
    expect(window.location.search).toBe("");
  });
});
