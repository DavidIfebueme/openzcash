import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEGAL_ITEMS, LEGAL_SOURCES } from "@/lib/legal/curated";
import type { LegalFeed } from "@/lib/legal/types";
const location = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(location.query) }));
import { LegalNewsroom } from "./newsroom";
import { LegalPage } from "./page";
const feed: LegalFeed = { items: LEGAL_ITEMS, sources: [{ id: "pgp", name: "Pretty Good Policy for Zcash", url: "https://pgpz.org/updates", mode: "live", role: "Advocacy & analysis" }, ...LEGAL_SOURCES], fetchedAt: null, pgpStatus: "unavailable", pgpLastSuccessAt: null };
beforeEach(() => { location.query = ""; });
describe("Legal newsroom", () => {
  it("restores the regional filter from a shared URL and excludes other jurisdictions", () => {
    location.query = "region=latam";
    const html = renderToStaticMarkup(<LegalNewsroom feed={feed}/>);
    expect(html).toContain('aria-pressed="true">LATAM');
    expect(html).toContain("Brazil adds reporting");
    expect(html).toContain("Argentina regulates");
    expect(html).not.toContain("SEC proposes");
  });
  it("filters PGP records within the unified Updates page", () => {
    location.query = "source=pgp";
    const html = renderToStaticMarkup(<LegalNewsroom feed={feed}/>);
    expect(html).toContain("Weekly Policy Memo");
    expect(html).not.toContain("Brazil adds reporting");
  });
  it("features PGP before the shared feed and links signup to its official site", () => {
    const html = renderToStaticMarkup(<LegalPage feed={feed}/>);
    expect(html).toContain('id="pgp"');
    expect(html.indexOf('id="pgp"')).toBeLessThan(html.indexOf('id="brasil"'));
    expect(html.indexOf('id="brasil"')).toBeLessThan(html.indexOf('id="updates"'));
    expect(html).toContain('https://community.pgpz.org/signin?callbackUrl=%2F&amp;reason=signup');
    expect(html).toContain('Join PGP by email');
    expect(html).toContain('Memos and reports are public.');
    expect(html).not.toContain('href="/legal/pgp"');
  });
  it("labels updated timestamps distinctly from publication", () => {
    const html = renderToStaticMarkup(<LegalNewsroom feed={{ ...feed, items: [{ ...LEGAL_ITEMS[0], dateBasis: "updated" }] }}/>);
    expect(html).toContain("Updated ");
    expect(html).toContain("24 Jul 2026");
    expect(html).toContain('rel="noopener noreferrer"');
  });
  it("reports an individual upstream failure without declaring every feed down", () => {
    const html = renderToStaticMarkup(<LegalPage feed={{ ...feed, sourceHealth: [{ sourceId: "bcb", status: "cached", fetchedAt: "2026-10-05", lastSuccessAt: "2026-10-04" }] }}/>);
    expect(html).toContain("Temporarily unavailable. Showing the last successful retrieval.");
    expect(html).toContain("04 Oct 2026");
    expect(html).toContain("Sources &amp; coverage");
  });
  it("supports every registered source and intersects it with region, topic and search", () => {
    location.query = "source=bcb&region=latam&topic=Privacy&q=self-custody";
    const html = renderToStaticMarkup(<LegalNewsroom feed={feed}/>);
    expect(html).toContain("Brazil adds reporting");
    expect(html).not.toContain("Argentina regulates"); expect(html).not.toContain("Weekly Policy Memo");
    expect(html).toContain('<option value="bcb" selected="">');
  });
  it("shows memo periods in both the feature and article without implying a publication date", () => {
    const item = { ...LEGAL_ITEMS[1], dateBasis: "reporting-period" as const };
    const html = renderToStaticMarkup(<LegalPage feed={{ ...feed, items: [item] }}/>);
    expect(html.match(/Week of 28 Sept? 2026/g)).toHaveLength(2);
  });

});
