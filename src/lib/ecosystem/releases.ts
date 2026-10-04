import type { Release } from "./types";

/** Preserve GitHub's flag; also expose an explicit preview marker in the tag. */
export function isPreviewRelease(release: Pick<Release, "tagName" | "isPrerelease">): boolean {
  return release.isPrerelease || /(?:^|[./_-])(?:alpha|beta|rc|pre|preview|nightly|dev)(?:[.\d/_-]|$)/i.test(release.tagName);
}
