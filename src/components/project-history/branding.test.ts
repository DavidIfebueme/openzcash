import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import registry from "@/data/ecosystem/registry.json";
import type { Project } from "@/lib/ecosystem/types";
import { COMMUNITIES } from "@/lib/communities/data";
import { BrandMark } from "@/components/ecosystem/identity";
import { historyBrand } from "./branding";

const project = (id: string) => registry.projects.find(item => item.id === id)! as Project;

describe("history identity logos", () => {
  it("restores curated community logos without attributing them to a software project", () => {
    const brand = historyBrand({ project: null, communityId: "zcash-arabia" });
    expect(brand).toEqual({ src: "/community-logos/zcash-arabia.png", name: "Zcash Arabia", kind: "community", sourceUrl: "https://x.com/ZcashArabia" });
    const html = renderToStaticMarkup(createElement(BrandMark, { brand, category: "Community" }));
    expect(html).toContain('src="/community-logos/zcash-arabia.png"');
    expect(html).toContain('alt="Zcash Arabia community logo"');
  });

  it("resolves all existing curated community assets to actual local files", () => {
    for (const community of COMMUNITIES.filter(item => item.logo)) {
      const brand = historyBrand({ project: null, communityId: community.id });
      expect(brand?.src).toBe(community.logo);
      expect(existsSync(join(process.cwd(), "public", brand!.src))).toBe(true);
      expect(brand?.kind).toBe("community");
    }
  });

  it("preserves dedicated project logos and correctly labels maintainer marks", () => {
    expect(historyBrand({ project: project("zodl-wallet"), communityId: null })).toMatchObject({ src: "/wallet-logos/zodl.png", kind: "project" });
    expect(historyBrand({ project: project("zaino"), communityId: null })).toMatchObject({ name: "Zingo Labs", kind: "maintainer" });
    expect(historyBrand({ project: project("tachyon-protocol"), communityId: null })).toMatchObject({ src: "/logos/ecosystem/tachyon.png", kind: "maintainer" });
    expect(historyBrand({ project: project("zechub"), communityId: "zechub" })).toMatchObject({ src: "/logos/ecosystem/zechub.jpg", kind: "project" });
  });

  it("does not invent logos for missing or unknown community identities", () => {
    for (const community of COMMUNITIES.filter(item => !item.logo)) {
      expect(historyBrand({ project: null, communityId: community.id })).toBeNull();
    }
    expect(historyBrand({ project: null, communityId: "__proto__" })).toBeNull();
    expect(historyBrand({ project: null, communityId: null })).toBeNull();
    expect(historyBrand({ project: project("zecrocks"), communityId: null })).toBeNull();
  });
});
