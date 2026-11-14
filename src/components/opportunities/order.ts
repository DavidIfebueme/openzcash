/** Fisher–Yates gives each opportunity the same chance at every position. */
export function randomOrder<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Keep the session's mixed order while replacing records with fresh source data. */
export function retainOrder<T extends { id: string }>(items: readonly T[], order: readonly string[]): T[] {
  const positions = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((a, b) =>
    (positions.get(a.id) ?? order.length) - (positions.get(b.id) ?? order.length) || a.id.localeCompare(b.id),
  );
}
