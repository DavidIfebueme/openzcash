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
    `style-src 'nonce-${nonce}'`, `frame-src ${origin}`, "connect-src 'none'",
    "frame-ancestors 'none'", "base-uri 'none'", "form-action 'none'", "object-src 'none'"].join("; ");
  return new Response(`<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Private Chat · OpenZcash</title><meta name="referrer" content="no-referrer">
<style nonce="${nonce}">html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#faf8f4;color:#24211b;font:16px system-ui}iframe{position:fixed;inset:0;width:100%;height:100%;height:100dvh;border:0}#status{position:fixed;inset:0;display:grid;place-content:center;text-align:center;gap:12px;padding:24px;background:#faf8f4}#status[hidden]{display:none}button{font:inherit;padding:12px 20px;border:1px solid #d5c9b6;border-radius:10px;background:#fff;color:#24211b;cursor:pointer}noscript{position:fixed;inset:0;background:#faf8f4;padding:32px}</style>
</head><body>
<iframe id="private-chat" title="Private Chat" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-top-navigation-by-user-activation" allow="clipboard-write ${origin}"></iframe>
<div id="status" role="status"><strong>Opening Private Chat…</strong><button id="retry" hidden>Try again</button></div>
<noscript>Enable JavaScript to use Private Chat.</noscript>
<script nonce="${nonce}">
(() => {
  const origin = ${JSON.stringify(origin)};
  const frame = document.getElementById('private-chat');
  const status = document.getElementById('status');
  const retry = document.getElementById('retry');
  let pending = null;
  let ready = false;
  let timer;
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
    if (event.origin !== origin || event.source !== frame.contentWindow ||
        event.data?.type !== 'openzcash-chat-ready-v1') return;
    ready = true;
    clearTimeout(timer);
    status.hidden = true;
    deliver();
  });
  function load() {
    ready = false;
    status.hidden = false;
    retry.hidden = true;
    status.querySelector('strong').textContent = 'Opening Private Chat…';
    frame.src = origin + '/private-chat?embedded=1';
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
