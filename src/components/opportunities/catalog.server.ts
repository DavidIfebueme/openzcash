import "server-only";
import { curatedItems, type Catalog } from "./catalog";
import { loadBounties } from "./feed";

// Cache only the allowlisted public projection, never raw profiles or API data.
// An expired cache is replaced even on failure, so closed/removed listings cannot
// remain advertised indefinitely during an upstream outage.
let cached: { expires: number; value: Catalog } | undefined;
let pending: Promise<Catalog> | undefined;
function availableNow(catalog: Catalog): Catalog {
  const now = Date.now();
  return { ...catalog, items: catalog.items.filter((item) => !item.deadline || Date.parse(item.deadline) > now) };
}
export async function getCatalog(): Promise<Catalog> {
  if (cached && cached.expires > Date.now()) return availableNow(cached.value);
  if (pending) return pending;
  pending = (async () => {
    const signal = AbortSignal.timeout(12000);
    const feed = await loadBounties(async (url) => {
      const response = await fetch(url, { cache: "no-store", signal, headers: { Accept: "application/json" }, redirect: "error" });
      if (!response.ok) throw new Error("Source unavailable");
      return response.json();
    });
    const value: Catalog = { items: [...curatedItems, ...feed.items], sources: [feed.source, { id: "gleyo", status: "curated", checkedAt: curatedItems[0].checkedAt }] };
    cached = { value, expires: Date.now() + (feed.source.status === "available" ? 15 * 60_000 : 60_000) };
    return value;
  })();
  try { return await pending; } finally { pending = undefined; }
}
