import { describe, expect, it } from "vitest";
import { isPreviewRelease } from "./releases";

describe("release channel labeling", () => {
  it.each(["v7.0.0-rc.0", "v0.1.0-beta.3", "zingo-beta-2.0.23-335", "release/v0.0.59-rc.0", "v1.0.0-alpha1", "nightly"])("recognizes %s even if the maintainer omitted the prerelease flag", tagName => {
    expect(isPreviewRelease({ tagName, isPrerelease: false })).toBe(true);
  });
  it.each(["v1.6.0", "release/v0.0.59", "zingo-2.0.24-320", "@scope/library@1.2.3", "v1.0.0+rcarchive"])("does not infer a preview channel for %s", tagName => {
    expect(isPreviewRelease({ tagName, isPrerelease: false })).toBe(false);
  });
  it("respects a maintainer's explicit prerelease flag", () => {
    expect(isPreviewRelease({ tagName: "v1.6.0", isPrerelease: true })).toBe(true);
  });
});
