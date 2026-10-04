import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { APPS, placeOf } from "@/lib/design-routes";
import { AppNavigation } from "./app-navigation";

const render = (path: string, openApps: Record<string, boolean> = {}) => renderToStaticMarkup(
  <AppNavigation apps={APPS.filter((app) => !app.hidden)} place={placeOf(path)} counts={{}} openApps={openApps} onOpen={() => {}} onToggle={() => {}} />,
);

const linkTag = (html: string, href: string) => html.match(new RegExp(`<a\\b[^>]*href="${href}"[^>]*>`))?.[0] ?? "";

describe("grouped ecosystem navigation", () => {
  it("opens the correct ancestors on direct organization and nested-page visits", () => {
    const org = render("/zf");
    expect(org).toContain('aria-label="Collapse Ecosystem"');
    expect(org).toContain('role="group" aria-label="Teams &amp; organizations"');
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
    expect(expanded).toContain('role="group" aria-label="Teams &amp; organizations"');
    expect(linkTag(expanded, '/zcg/fpf')).toContain('aria-current="page"');
    expect(expanded.match(/href="\/zcg\/fpf"/g)).toHaveLength(1);
    expect(expanded.indexOf('href="/communities"')).toBeLessThan(expanded.indexOf('class="rd-side-org-group"'));
    expect(expanded).not.toContain('src="/logos/marks/ecosystem.png"');
  });
});
