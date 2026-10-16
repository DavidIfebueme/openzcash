import { chatEntryNavigation, entryChevron, entryClose, entryMenu, entryTheme } from "./private-chat-entry-navigation";
import { chatEntryStyles } from "./private-chat-entry-styles";

/** Only this document hosts the isolated chat; no portal runtime is loaded. */
export const PRIVATE_CHAT_SERVICE_ORIGIN = "https://private-chat-production-b8bd.up.railway.app";

export function chatServiceOrigin(env: Record<string, string | undefined> = process.env): string {
  // Local preview can point to the local chat, never an arbitrary production host.
  if (env.NODE_ENV === "development" && env.PRIVATE_CHAT_LOCAL_ORIGIN) {
    const url = new URL(env.PRIVATE_CHAT_LOCAL_ORIGIN);
    if (url.protocol === "http:" && url.hostname === "127.0.0.1" &&
        url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash) return url.origin;
    throw new Error("Invalid local chat origin");
  }
  return PRIVATE_CHAT_SERVICE_ORIGIN;
}

export function chatEntryResponse(nonce: string, origin = PRIVATE_CHAT_SERVICE_ORIGIN): Response {
  const policy = ["default-src 'none'", `script-src 'nonce-${nonce}'`,
    `style-src 'nonce-${nonce}'`, `frame-src ${origin}`, "img-src 'self'", "font-src 'self'", "connect-src 'none'",
    "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'", "object-src 'none'"].join("; ");
  return new Response(`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Private Chat · OpenZcash</title><meta name="referrer" content="no-referrer">
<style nonce="${nonce}">${chatEntryStyles}</style>
</head><body>
<a class="skip" href="#private-chat">Skip to chat</a>
<aside class="sidebar" id="navigation" aria-label="OpenZcash navigation">
<div class="banner"><a class="brand" href="/zcg"><img src="/logos/marks/openzcash.png" width="68" height="68" alt=""><span>OpenZcash</span></a><button class="icon-button close-button" id="close-menu" aria-label="Close menu">${entryClose}</button></div>
<nav class="nav" aria-label="Apps">${chatEntryNavigation()}</nav>
<div class="sidebar-foot"><a href="/zcg/methodology">Sources &amp; methodology</a><a href="/zarvis/about">About Zarvis</a></div>
</aside>
<button class="backdrop" id="backdrop" aria-label="Close menu" tabindex="-1"></button>
<div class="body" id="body"><header class="topbar"><button class="icon-button menu-button" id="open-menu" aria-label="Open menu" aria-controls="navigation" aria-expanded="false">${entryMenu}</button><div class="breadcrumb"><a href="/zcg">OpenZcash</a>${entryChevron}<span>Private Chat</span></div><button class="icon-button theme-button" id="theme" aria-label="Switch to dark theme">${entryTheme}</button></header>
<main class="main"><div class="chat-container">
<iframe id="private-chat" title="Private Chat" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-top-navigation-by-user-activation" allow="clipboard-write ${origin}"></iframe>
<div id="status" role="status"><strong>Opening Private Chat…</strong><button id="retry" hidden>Try again</button></div>
</div></main></div>
<noscript>Enable JavaScript to use Private Chat.</noscript>
<script nonce="${nonce}">
(() => {
  const origin = ${JSON.stringify(origin)};
  const frame = document.getElementById('private-chat');
  const status = document.getElementById('status');
  const retry = document.getElementById('retry');
  const sidebar = document.getElementById('navigation');
  const body = document.getElementById('body');
  const menu = document.getElementById('open-menu');
  const themeButton = document.getElementById('theme');
  const compact = window.matchMedia('(max-width: 960px)');
  let pending = null;
  let navigation = null;
  let ready = false;
  let timer;
  let theme = 'light';
  try { if (localStorage.getItem('oz-theme') === 'dark') theme = 'dark'; } catch {}
  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    themeButton.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme');
    themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
    if (ready) frame.contentWindow.postMessage({ type: 'openzcash-chat-theme-v1', theme }, origin);
  }
  applyTheme();
  themeButton.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('oz-theme', theme); } catch {}
    applyTheme();
  });
  function setMenu(open, restoreFocus = true) {
    document.body.dataset.menuOpen = String(open);
    menu.setAttribute('aria-expanded', String(open));
    body.inert = open;
    sidebar.inert = compact.matches && !open;
    if (open) { sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true'); document.getElementById('close-menu').focus(); }
    else { sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal'); if (restoreFocus && compact.matches) menu.focus(); }
  }
  setMenu(false, false);
  menu.addEventListener('click', () => setMenu(true));
  document.getElementById('close-menu').addEventListener('click', () => setMenu(false));
  document.getElementById('backdrop').addEventListener('click', () => setMenu(false));
  compact.addEventListener('change', () => setMenu(false, false));
  sidebar.addEventListener('keydown', event => {
    if (document.body.dataset.menuOpen !== 'true') return;
    if (event.key === 'Escape') { event.preventDefault(); setMenu(false); }
    if (event.key !== 'Tab') return;
    const items = [...sidebar.querySelectorAll('a,button')].filter(el => !el.closest('[hidden]') && el.getClientRects().length);
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  function expand(button, open) {
    document.getElementById(button.getAttribute('aria-controls')).hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', (open ? 'Collapse ' : 'Expand ') + button.dataset.label);
  }
  document.querySelectorAll('.nav-toggle').forEach(button => button.addEventListener('click', () => expand(button, button.getAttribute('aria-expanded') !== 'true')));
  document.querySelectorAll('a[href]').forEach(link => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0 || link.getAttribute('href').startsWith('#')) return;
    const target = new URL(link.href, location.href);
    if (target.origin !== location.origin) return;
    if (link.dataset.expand && compact.matches) {
      const button = link.parentElement.querySelector('.nav-toggle');
      if (button.getAttribute('aria-expanded') === 'false') { event.preventDefault(); expand(button, true); return; }
    }
    if (target.pathname === '/private-chat') { event.preventDefault(); setMenu(false); frame.focus(); return; }
    if (!ready) return;
    event.preventDefault();
    setMenu(false);
    if (navigation) return;
    navigation = { id: crypto.randomUUID(), href: target.href };
    frame.contentWindow.postMessage({ type: 'openzcash-chat-leave-request-v1', id: navigation.id }, origin);
    frame.focus();
  }));
  function capture() {
    const params = new URLSearchParams(location.hash.slice(1));
    const kind = params.has('room') ? 'room' : params.has('invite') ? 'invite' : null;
    if (kind) {
      const token = params.get(kind);
      pending = token && token.length <= 4096 ? { type: 'openzcash-chat-invitation-v1', kind, token } : null;
      history.replaceState(null, '', location.pathname);
    }
    deliver();
  }
  function deliver() {
    if (ready && pending && frame.contentWindow) {
      frame.contentWindow.postMessage(pending, origin);
      pending = null;
    }
  }
  window.addEventListener('message', event => {
    if (event.origin !== origin || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (data?.type === 'openzcash-chat-leave-result-v1') {
      if (!navigation || data.id !== navigation.id || typeof data.approved !== 'boolean' || Object.keys(data).sort().join(',') !== 'approved,id,type') return;
      const href = navigation.href;
      navigation = null;
      if (data.approved) location.assign(href);
      return;
    }
    if (data?.type !== 'openzcash-chat-ready-v1') return;
    ready = true;
    clearTimeout(timer);
    status.hidden = true;
    applyTheme();
    deliver();
  });
  function load() {
    ready = false;
    status.hidden = false;
    retry.hidden = true;
    status.querySelector('strong').textContent = 'Opening Private Chat…';
    frame.src = origin + '/private-chat?embedded=1&shell=portal';
    clearTimeout(timer);
    timer = setTimeout(() => {
      status.querySelector('strong').textContent = 'Chat could not open. Try again.';
      retry.hidden = false;
    }, 20000);
  }
  capture();
  window.addEventListener('hashchange', capture);
  retry.addEventListener('click', load);
  load();
})();
</script></body></html>`, { headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": policy,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-DNS-Prefetch-Control": "off",
    "Permissions-Policy": `camera=(), microphone=(), geolocation=(), browsing-topics=(), clipboard-read=(), clipboard-write=(self "${origin}")`,
  } });
}
