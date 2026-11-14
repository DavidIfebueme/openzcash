import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW,
  VIEWS,
  isViewId,
  resolveView,
  viewQuery,
} from "./views";

const params = (query: string) => new URLSearchParams(query);

describe("governance views", () => {
  it("opens on how it works", () => {
    expect(DEFAULT_VIEW).toBe("how");
    expect(VIEWS[0].id).toBe("how");
    expect(resolveView(params(""))).toBe("how");
  });

  it("lists each view once, in menu order", () => {
    expect(VIEWS.map((view) => view.id)).toEqual([
      "how",
      "now",
      "polls",
      "upgrades",
      "who",
    ]);
  });

  it("follows the view named in the address", () => {
    expect(resolveView(params("view=upgrades"))).toBe("upgrades");
    expect(resolveView(params("view=who&question=sprout"))).toBe("who");
  });

  it("falls back to the default for an unknown view", () => {
    expect(resolveView(params("view=admin"))).toBe("how");
    expect(isViewId("admin")).toBe(false);
    expect(isViewId(null)).toBe(false);
    expect(isViewId("polls")).toBe(true);
  });

  it("keeps shared poll comparison links on the polls view", () => {
    expect(resolveView(params("question=sprout"))).toBe("polls");
    expect(resolveView(params("basis=expressed"))).toBe("polls");
    expect(resolveView(params("round=nu7-scope"))).toBe("polls");
  });

  it("changes the view without dropping the other parameters", () => {
    expect(viewQuery(params("question=sprout&basis=expressed"), "now")).toBe(
      "?question=sprout&basis=expressed&view=now",
    );
    expect(viewQuery(params("view=polls"), "how")).toBe("?view=how");
  });
});
