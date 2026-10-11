import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ pathname: "/monthly" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("./app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => createElement("div", { "data-shell": "" }, children) }));
import { ShellGate } from "./shell-gate";
import { useZarvis } from "./zarvis/zarvis-provider";
function Probe() { const chat = useZarvis(); return createElement("span", { "data-probe": "" }, chat.messages.length); }
const render = (pathname: string) => { state.pathname = pathname; return renderToStaticMarkup(<ShellGate isAdmin={false}><Probe /></ShellGate>); };
describe("ShellGate", () => {
  it("keeps the Zarvis conversation state mounted on bare pages such as Monthly, without the shell", () => {
    const html = render("/monthly");
    expect(html).toContain("data-probe"); expect(html).not.toContain("data-shell");
    expect(render("/monthly/2026-08")).toContain("data-probe");
    const network = render("/zcash-network");
    expect(network).toContain("data-probe"); expect(network).not.toContain("data-shell");
  });
  it("renders the shell around workspace pages", () => {
    const html = render("/zcg");
    expect(html).toContain("data-shell"); expect(html).toContain("data-probe");
  });
});
