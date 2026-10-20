// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APPS, placeOf } from "@/lib/design-routes";
import { AppNavigation } from "./app-navigation";

afterEach(cleanup);

function Navigation({ compact, onVisit }: { compact: boolean; onVisit?: () => void }) {
  const [openApps, setOpenApps] = useState<Record<string, boolean>>({});
  return (
    <div onClick={(event) => event.preventDefault()} onClickCapture={compact ? undefined : (event) => event.preventDefault()}>
      <AppNavigation
        apps={APPS.filter((app) => !app.hidden)}
        place={placeOf("/zcash-network")}
        counts={{}}
        openApps={openApps}
        compact={compact}
        onVisit={onVisit}
        onOpen={(id) => setOpenApps((current) => ({ ...current, [id]: true }))}
        onToggle={(id, fallbackOpen) => setOpenApps((current) => ({ ...current, [id]: !(current[id] ?? fallbackOpen) }))}
      />
    </div>
  );
}

describe("ZCG navigation", () => {
  it("reveals the pages on the first phone tap without following the title link", () => {
    const { container } = render(<Navigation compact />);
    const title = container.querySelector<HTMLAnchorElement>('.rd-side-app-row > a[href="/zcg/participate"]');
    expect(title?.getAttribute("aria-expanded")).toBe("false");

    expect(fireEvent.click(title!)).toBe(false);

    const pages = container.querySelector<HTMLElement>("#nav-zcg");
    expect(pages).not.toBeNull();
    expect(within(pages!).getByRole("link", { name: "Participate" })).toBeTruthy();
    expect(within(pages!).getByRole("link", { name: "Grants" })).toBeTruthy();
    expect(title?.getAttribute("aria-expanded")).toBe("true");
  });

  it("reveals the pages when the title is clicked on desktop", () => {
    const { container } = render(<Navigation compact={false} />);
    const title = container.querySelector<HTMLAnchorElement>('.rd-side-app-row > a[href="/zcg/participate"]');
    expect(title?.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(title!);

    const pages = container.querySelector<HTMLElement>("#nav-zcg");
    expect(pages).not.toBeNull();
    expect(within(pages!).getByRole("link", { name: "Participate" })).toBeTruthy();
    expect(title?.getAttribute("aria-expanded")).toBe("true");
  });
});


describe("Ongoing Test navigation", () => {
  it("toggles the category without navigation and dismisses the drawer on a page selection", () => {
    const onVisit = vi.fn();
    const { container, getByRole, queryByRole } = render(<Navigation compact onVisit={onVisit} />);
    expect(queryByRole("link", { name: "Crosslink" })).toBeNull();
    fireEvent.click(getByRole("button", { name: "Expand Ongoing Test" }));
    const crosslink = getByRole("link", { name: "Crosslink" });
    expect(crosslink.getAttribute("href")).toBe("/ongoing-test/crosslink");
    expect(crosslink.querySelector("img")?.getAttribute("src")).toBe("/logos/shielded-labs.png");
    fireEvent.click(getByRole("button", { name: "Collapse Ongoing Test" }));
    expect(queryByRole("link", { name: "Crosslink" })).toBeNull();
    expect(onVisit).not.toHaveBeenCalled();
    fireEvent.click(getByRole("button", { name: "Expand Ongoing Test" }));
    fireEvent.click(getByRole("link", { name: "Crosslink" }));
    expect(onVisit).toHaveBeenCalledOnce();
    expect(container.querySelector("#nav-ongoing-test")).not.toBeNull();
  });
});
