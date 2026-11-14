import "server-only";

/** Keyless reads of public sources: identified, bounded in time, never cached by the framework. */
async function request(url: string, init?: RequestInit, timeoutMs = 12_000) {
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json,text/html",
      "User-Agent": "OpenZcash/1.0 (+https://openzcash.org)",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Public source unavailable");
  return res;
}
export async function json(
  url: string,
  init?: RequestInit,
  timeoutMs?: number,
): Promise<unknown> {
  return (await request(url, init, timeoutMs)).json();
}
export async function html(url: string): Promise<string> {
  return (await request(url)).text();
}
