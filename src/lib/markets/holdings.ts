import type { Disclosure, Holder } from "./model";

export type HoldingDisclosure = { data: Disclosure; stale: boolean };
export type HoldingRow = Holder & {
  addressZec: number | null;
  disclosure?: HoldingDisclosure;
};

/** One entity per row; issuer positions and observed addresses are never added. */
export function holdingRows(
  holders: Holder[],
  disclosures: HoldingDisclosure[],
): HoldingRow[] {
  const rows = new Map<string, HoldingRow>(
    holders.map((holder) => [holder.id, { ...holder, addressZec: holder.zec }]),
  );
  for (const disclosure of disclosures) {
    const { data } = disclosure;
    const existing = rows.get(data.id);
    if (existing?.disclosure && existing.disclosure.data.asOf > data.asOf) continue;
    rows.set(data.id, {
      id: data.id,
      name: data.name,
      kind: data.kind,
      zec: data.zec,
      addresses: existing?.addresses ?? [],
      missing: existing?.missing ?? 0,
      addressZec: existing?.addressZec ?? null,
      disclosure,
    });
  }
  return [...rows.values()].sort((a, b) => (b.zec ?? -1) - (a.zec ?? -1));
}
