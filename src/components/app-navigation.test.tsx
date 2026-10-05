import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APPS, placeOf } from "@/lib/design-routes";
import { AppNavigation } from "./app-navigation";

const render = (path: string, openApps: Record<string, boolean> = {}, counts: Record<string, string> = {}) => renderToStaticMarkup(
  <AppNavigation apps={APPS.filter((app) => !app.hidden)} place={placeOf(path)} counts={counts} openApps={openApps} onOpen={() => {}} onToggle={() => {}} />,
);

const linkTag = (html: string, href: string) => html.match(new RegExp(`<a\\b[^>]*href="${href}"[^>]*>`))?.[0] ?? "";

describe("grouped ecosystem navigation", () => {
  it("interleaves direct destinations in reading order and keeps the curated organization order", () => {
    const html = render("/communities", { "ecosystem:organizations": true }, { "/ecosystem": "127", "/development": "579", "/communities": "27", "/arborist": "133" });
    const links = ["/wallets", "/ecosystem/history", "/communities", "/development", "/arborist", "/zcg/fpf", "/shielded-labs", "/tachyon", "/zf", "/zakura", "/zechub", "/zodl"];
    links.forEach((href, i) => {
      expect(html.split(`href="${href}"`)).toHaveLength(2);
      if (i) expect(html.indexOf(`href="${href}"`)).toBeGreaterThan(html.indexOf(`href="${links[i - 1]}"`));
    });
    expect(html).not.toMatch(/<small class="tnum">(?:127|579|27|133)<\/small>/);
    expect(linkTag(html, "/communities")).toContain('aria-current="page"');
    expect(html).toContain("12% of every block reward");
    expect(html).toContain("8% of every block reward");
  });
  it("opens the correct ancestors on direct organization and nested-page visits", () => {
    const org = render("/zf");
    expect(org).toContain('aria-label="Collapse Ecosystem"');
    expect(org).toContain('role="group" aria-label="Organizations"');
    expect(linkTag(org, '/zf')).toContain('aria-current="page"');
    expect(org.match(/href="\/zf"/g)).toHaveLength(1);
    const page = render("/zechub/copilot");
    expect(page).toContain('aria-label="Collapse ZecHub DAO"');
    expect(linkTag(page, '/zechub/copilot')).toContain('aria-current="page"');
  });
  it("keeps the organization list collapsed by default and honors a user's expansion", () => {
    expect(render("/wallets")).not.toContain('href="/zf"');
    const open = render("/wallets", { "ecosystem:organizations": true });
    expect(open).toContain('href="/zf"');
    expect(linkTag(open, '/wallets')).toContain('aria-current="page"');
    expect(render("/zf", { "ecosystem:organizations": false })).not.toContain('href="/zf"');
  });
  it("keeps Communities directly accessible inside Ecosystem and FPF with the organizations", () => {
    const compact = render("/communities");
    expect(linkTag(compact, '/communities')).toContain('aria-current="page"');
    expect(compact).not.toContain('href="/zcg/fpf"');
    expect(compact).toContain('href="/arborist"');
    const expanded = render("/zcg/fpf");
    expect(expanded).toContain('role="group" aria-label="Organizations"');
    expect(linkTag(expanded, '/zcg/fpf')).toContain('aria-current="page"');
    expect(expanded.match(/href="\/zcg\/fpf"/g)).toHaveLength(1);
    expect(expanded.indexOf('href="/communities"')).toBeLessThan(expanded.indexOf('class="rd-side-org-group"'));
    expect(expanded).not.toContain('src="/logos/marks/ecosystem.png"');
  });
});
