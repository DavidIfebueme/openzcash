import type { ZipCorpus, ZipDocument } from "./zip-source";
export const isZipQuestion = (query: string) => /\bzips?\b|\bdraft-[a-z0-9-]+\b/i.test(query);
export function requestedZips(query: string): number[] {
  const groups = [...query.matchAll(/\bZIPs?[ -]*((?:\d{1,6})(?:\s*(?:,|and|e|&|versus|vs\.?)\s*(?:ZIP[ -]*)?\d{1,6})*)\b/gi)];
  return [...new Set(groups.flatMap((m) => [...m[1].matchAll(/\d+/g)].map((n) => Number(n[0]))))];
}
const row = ({ number, id, title, status, createdOn, updatedOn, url, sourceUrl }: ZipDocument) => ({ number, id, title, status, createdOn, updatedOn, url, sourceUrl });
export function zipCatalogEvidence(query: string, corpus: ZipCorpus, stale: boolean) {
  const numbered = corpus.documents.filter((d) => d.number !== null);
  const requested = requestedZips(query);
  const sortedCreated = numbered.filter((d) => d.createdOn).sort((a, b) => b.createdOn!.localeCompare(a.createdOn!) || a.number! - b.number!);
  const selected = requested.length ? numbered.filter((d) => requested.includes(d.number!)) : sortedCreated.slice(0, 5);
  const highest = [...numbered].sort((a, b) => b.number! - a.number!)[0];
  return { content: JSON.stringify({ sourceUrl: "https://zips.z.cash/", retrievedAt: corpus.retrievedAt, data: {
    kind: "official_zip_catalog", stale, revision: corpus.revision, repository: corpus.repository,
    numberedDocuments: numbered.length, unnumberedDrafts: corpus.documents.length - numbered.length,
    missingCreatedDates: numbered.filter((d) => !d.createdOn).length,
    selected: selected.slice(0, 6).map(row), selectedBy: requested.length ? "explicit ZIP number" : "Created header descending (not publication date)",
    partialSelection: selected.length > 6, missingNumbers: requested.filter((n) => !numbered.some((d) => d.number === n)),
    highestNumber: highest ? row(highest) : null,
    mostRecentCreatedDate: sortedCreated[0]?.createdOn ?? null,
    sameMostRecentCreatedDate: sortedCreated.filter((d) => d.createdOn === sortedCreated[0]?.createdOn).map((d) => d.number),
    notes: "Complete numbered/draft source inventory at this repository revision; selected rows/excerpts are bounded. Created is the author's creation date, NOT verified first publication. Last-Updated can be absent/outdated; it is not the repository commit time. Highest number is not newest. Reserved may contain only headers. Preserve revision-specific statuses. Draft/Proposed is not activated. Use pinned sourceUrl if the rendered site lags the repository. Fresh cached catalog metadata is sufficient for title/status/Created questions; do not run web research merely to repeat it.",
  } }), source: { title: "Official Zcash ZIP catalog", url: "https://zips.z.cash/", retrievedAt: corpus.retrievedAt } };
}

/** Only a plain, fresh one-turn catalog question uses this zero-model shortcut. */
export function latestZipAnswer(query: string, corpus: ZipCorpus, stale: boolean, pt: boolean): string | undefined {
  const q = query.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[?!.,]/g, "").trim();
  if (!/^(?:qual (?:e )?(?:o )?(?:ultimo|mais recente) zip|(?:what is|what's|whats) (?:the )?(?:latest|newest|last) zip)$/.test(q) || stale) return;
  const docs = corpus.documents.filter((d) => d.number !== null && d.createdOn).sort((a, b) => b.createdOn!.localeCompare(a.createdOn!));
  const doc = docs[0];
  if (!doc || docs.some((d) => d !== doc && d.createdOn === doc.createdOn)) return;
  const asOf = new Date(corpus.retrievedAt).toLocaleString(pt ? "pt-BR" : "en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }) + " UTC";
  const title = doc.title.replace(/[\[\]<>*`]/g, "");
  return pt
    ? `Pelo campo **Created** dos ZIPs numerados no catálogo oficial, o mais recente é o **[ZIP ${doc.number}: ${title}](${doc.sourceUrl})**, criado em **${doc.createdOn}**, com status **${doc.status}**. Catálogo verificado em ${asOf}.\n\nEssa é a data de criação declarada no documento, não uma confirmação da primeira publicação. Alguns ZIPs não informam essa data; o maior número também não indica o mais recente. O status do documento não comprova ativação na rede.`
    : `By the **Created** field among numbered documents in the official catalog, the most recent is **[ZIP ${doc.number}: ${title}](${doc.sourceUrl})**, created **${doc.createdOn}**, with status **${doc.status}**. Catalog checked ${asOf}.\n\nThis is the document's declared creation date, not verified first publication. Some ZIPs have no Created date; the highest number does not mean newest. Document status does not establish network activation.`;
}
