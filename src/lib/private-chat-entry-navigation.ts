import { APPS, childAppsOf, overviewEntry, type AppDef, type AppPage } from "./design-routes";

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
const svg = (body: string) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
export const entryChevron = svg('<path d="m9 5 7 7-7 7"/>');
export const entryMenu = svg('<path d="M4 6h16M4 12h16M4 18h16"/>');
export const entryClose = svg('<path d="m6 6 12 12M18 6 6 18"/>');
export const entryTheme = svg('<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z"/>');

function mark(app: AppDef): string {
  if (app.logo) return `<img class="mark${app.logo.includes('/logos/marks/') ? ' glyph' : ''}" src="${escape(app.logo)}" width="20" height="20" alt="">`;
  if (app.icon === "zarvis") return '<svg class="mark" viewBox="17 620 122 133" aria-hidden="true"><image href="/zarvis/ironwood-reference.png" width="1212" height="1297"/></svg>';
  if (app.icon === "private-chat") return svg('<path d="M6 3.5h12a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H8L3 22V6.5a3 3 0 0 1 3-3Z"/><rect x="9" y="10" width="6" height="5.5" rx="1"/><path d="M10 10V8a2 2 0 0 1 4 0v2M12 12.5v.5"/>');
  if (app.icon === "balance") return svg('<path d="M12 3v18M5 7h14M7 7l-3 6a3 3 0 0 0 6 0L7 7Zm10 0-3 6a3 3 0 0 0 6 0l-3-6Z"/>');
  if (app.icon === "chart") return svg('<path d="M3 3v18h18"/><rect x="6.5" y="12" width="3" height="6" rx=".5"/><rect x="11.5" y="8" width="3" height="10" rx=".5"/><rect x="16.5" y="5" width="3" height="13" rx=".5"/>');
  return svg('<path d="m10 10-4-4m8 4 4-4m-8 8-4 4m8-4 4 4"/><circle cx="12" cy="12" r="3"/><circle cx="4.5" cy="4.5" r="2.2"/><circle cx="19.5" cy="4.5" r="2.2"/><circle cx="4.5" cy="19.5" r="2.2"/><circle cx="19.5" cy="19.5" r="2.2"/>');
}

function pageLink(page: AppPage): string {
  return `<a class="nav-link sub-link" href="${escape(page.href)}">${page.mark ? `<img class="mark glyph" src="${escape(page.mark)}" width="18" height="18" alt="">` : ''}<span>${escape(page.label)}</span></a>`;
}

/** Reuse the portal's route model without loading its client runtime in the chat host. */
export function chatEntryNavigation(): string {
  const apps = APPS.filter(app => !app.hidden && !app.admin);
  function render(app: AppDef): string {
    const children = childAppsOf(app, apps);
    const organizations = children.filter(child => child.parentGroup !== "pages");
    const destinations = [
      ...app.pages.filter(page => !page.hidden).map(page => ({ href: page.href, html: pageLink(page) })),
      ...children.filter(child => child.parentGroup === "pages").map(child => ({ href: child.href, html: render(child) })),
    ];
    if (app.navigationOrder) {
      const order = new Map(app.navigationOrder.map((href, index) => [href, index]));
      destinations.sort((a, b) => (order.get(a.href) ?? Infinity) - (order.get(b.href) ?? Infinity));
    }
    const overview = overviewEntry(app);
    const expandable = destinations.length > 0 || organizations.length > 0;
    const active = app.id === "private-chat";
    const open = app.id !== "zcg" && !!app.open;
    const toggle = (id: string, label: string, expanded = false) => `<button class="nav-toggle" type="button" aria-expanded="${expanded}" aria-controls="${id}" aria-label="${expanded ? 'Collapse' : 'Expand'} ${escape(label)}" data-label="${escape(label)}">${entryChevron}</button>`;
    return `<div class="nav-app${active ? ' separated' : ''}"><div class="nav-row"><a class="nav-link" href="${escape(app.id === 'zcg' ? '/zcg/participate' : app.href)}"${active ? ' aria-current="page"' : ''}${expandable ? ` data-expand="nav-${app.id}"` : ''}>${mark(app)}<span>${escape(app.label)}</span>${app.share ? `<small title="${escape(app.share.label)}">${escape(app.share.value)}</small>` : ''}</a>${expandable ? toggle(`nav-${app.id}`, app.label, open) : ''}</div>${expandable ? `<div id="nav-${app.id}" class="nav-pages"${open ? '' : ' hidden'}>${organizations.length ? `<div class="nav-row org-heading"><span>Organizations</span>${toggle(`nav-${app.id}-organizations`, 'Organizations')}</div><div id="nav-${app.id}-organizations" class="nav-pages" hidden>${organizations.map(render).join('')}</div>` : ''}${overview ? pageLink(overview) : ''}${destinations.map(item => item.html).join('')}</div>` : ''}</div>`;
  }
  return apps.filter(app => !app.parentId).map(render).join("");
}
