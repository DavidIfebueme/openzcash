import { describe, expect, it } from "vitest";
import { participationService, isParticipationReadyMessage, participationViewMessage, participationThemeMessage, participationWorkspaceUrl } from "./config";

describe("participation service boundary", () => {
  it("only exposes an OpenZcash path when its private upstream is configured", () => {
    expect(participationService(true)).toEqual({ url: "/participate" });
    expect(participationService(false)).toBeNull();
  });
  it("recognizes only the versioned readiness handshake", () => {
    expect(isParticipationReadyMessage({ type: "participate:ready", version: 1 })).toBe(true);
    for (const invalid of [null, "ready", { type: "participate:ready", version: 2 }, { type: "participate:balance", version: 1 }]) expect(isParticipationReadyMessage(invalid)).toBe(false);
  });
  it("only allows the fixed public views, never navigation URLs or account actions", () => {
    for (const view of ["proposals", "history", "committee", "about"] as const) expect(participationViewMessage({ type: "participate:view", version: 1, view })).toBe(view);
    for (const data of [null, "history", { type: "participate:view", version: 2, view: "history" }, { type: "participate:auth", version: 1, view: "history" }, { type: "participate:view", version: 1, view: "https://example.test" }, { type: "participate:view", version: 1, view: "sign-in" }]) expect(participationViewMessage(data)).toBeNull();
  });
  it("keeps every workspace view on the participation service", () => {
    const base = "/participate";
    expect(participationWorkspaceUrl(base, "proposals")).toBe(base);
    expect(participationWorkspaceUrl(base, "history")).toBe(`${base}?view=history`);
    expect(participationWorkspaceUrl(base, "committee")).toBe(`${base}/committee`);
  });
  it("only retains an explicit versioned appearance preference", () => {
    expect(participationThemeMessage({ type: "participate:theme", version: 1, theme: "dark" })).toBe("dark");
    for (const data of [null, { type: "participate:theme", version: 2, theme: "dark" }, { type: "participate:auth", version: 1, theme: "light" }, { type: "participate:theme", version: 1, theme: "system" }]) expect(participationThemeMessage(data)).toBeNull();
  });
});
