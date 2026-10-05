import { CATEGORIES } from "./catalog";

/** Display areas roll up primary categories; they never infer community membership. */
export function workArea(category: string): string {
  return category === "Community" || category === "Education" ? "Community & education" : category;
}

export function matchesWorkArea(category: string, area: string): boolean {
  return workArea(category) === area;
}

export function compareWorkAreas(a: string, b: string): number {
  const order = [...new Set(CATEGORIES.map(workArea))];
  const rank = (area: string) => { const index = order.indexOf(area); return index < 0 ? order.length : index; };
  return rank(a) - rank(b) || a.localeCompare(b);
}

export function workAreaHref(area: string): string {
  return `/ecosystem/history?${new URLSearchParams({ area })}`;
}

/** Count each reviewed identity once, using its primary category only. */
export function countWorkAreas(identities: readonly { id: string; category: string }[]) {
  const groups = new Map<string, { area: string; category: string; count: number }>();
  const seen = new Set<string>();
  for (const identity of identities) {
    if (seen.has(identity.id)) continue;
    seen.add(identity.id);
    const area = workArea(identity.category);
    const group = groups.get(area) ?? { area, category: area === "Community & education" ? "Community" : identity.category, count: 0 };
    group.count += 1;
    groups.set(area, group);
  }
  return [...groups.values()].sort((a, b) => compareWorkAreas(a.area, b.area));
}
