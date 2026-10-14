import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APPS, placeOf } from "@/lib/design-routes";
import { AppNavigation } from "./app-navigation";

const render = (path: string, openApps: Record<string, boolean> = {}, counts: Record<string, string> = {}) => renderToStaticMarkup(
  <AppNavigation apps={APPS.filter((app) => !app.hidden)} place={placeOf(path)} counts={counts} openApps={openApps} onOpen={() => {}} onToggle={() => {}} />,
);

const linkTag = (html: string, href: string) => html.match(new RegExp(`<a\\b[^>]*href="${href}"[^>]*>`))?.[0] ?? "";

describe("grouped ecosystem navigation", () => {
  it("places the Network destination immediately after ZCG and before Ecosystem", () => {
    const html = render("/zcash-network", { zcg: false });
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1]);
    const index = links.indexOf("/zcash-network");
    expect(index).toBeGreaterThan(0);
    expect(links.slice(index - 1, index + 2)).toEqual(["/zcg/participate", "/zcash-network", "/ecosystem"]);
    expect(linkTag(html, "/zcash-network")).toContain('aria-current="page"');
  });
  it("starts ZCG collapsed and sends its title to Participate", () => {
    const html = render("/zcg/participate");
    expect(html).toContain('aria-label="Expand ZCG"');
    expect(html).not.toContain('id="nav-zcg"');
    expect(linkTag(html, "/zcg/participate")).toContain('aria-current="page"');
    expect(html.match(/href="\/zcg\/participate"/g)).toHaveLength(1);

    const expanded = render("/zcg/participate", { zcg: true });
    expect(expanded).toContain('aria-label="Collapse ZCG"');
    expect(expanded).toContain('id="nav-zcg"');
    expect(expanded).toContain('href="/zcg/grants"');
  });
  it("interleaves direct destinations in reading order and keeps the curated organization order", () => {
    const html = render("/communities", { "ecosystem:organizations": true }, { "/ecosystem": "127", "/development": "579", "/communities": "27", "/arborist": "133" });
    const links = ["/zcg/fpf", "/shielded-labs", "/tachyon", "/zf", "/zakura", "/zechub", "/zodl", "/wallets", "/ecosystem/history", "/communities", "/development", "/arborist"];
    links.forEach((href, i) => {
      expect(html.split(`href="${href}"`)).toHaveLength(2);
      if (i) expect(html.indexOf(`href="${href}"`)).toBeGreaterThan(html.indexOf(`href="${links[i - 1]}"`));
    });
    const ecosystem = html.slice(html.indexOf('id="nav-ecosystem"'));
    expect(ecosystem.indexOf('class="rd-side-org-group"')).toBeLessThan(ecosystem.indexOf('>Overview</span>'));
    expect(ecosystem.indexOf('href="/zodl"')).toBeLessThan(ecosystem.indexOf('>Overview</span>'));
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
    expect(expanded.indexOf('class="rd-side-org-group"')).toBeLessThan(expanded.indexOf('href="/communities"'));
    expect(expanded).not.toContain('src="/logos/marks/ecosystem.png"');
  });
});
