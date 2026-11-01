type SourceEntry = {
  name: string;
  detail: string;
  url: string;
  amount?: number | null;
  amountLabel?: string;
};

/** Keep the numeric value and its stated financial meaning in separate columns. */
export function monthlySourceCsv(entries: readonly SourceEntry[]) {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return [
    "Name,Detail,Amount USD,Amount label,Source",
    ...entries.map((entry) => [
      entry.name,
      entry.detail,
      entry.amount == null ? "" : String(entry.amount),
      entry.amountLabel ?? "",
      entry.url,
    ].map(quote).join(",")),
  ].join("\r\n");
}
