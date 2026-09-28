import { APPS } from "@/lib/design-routes";
import index from "./public-content.json";
import references from "./reference-content.json";
import zipSnapshot from "./zip-content.json";
import { requestedZips } from "./zip-catalog";
import type { ZipCorpus } from "./zip-source";
import { KNOWLEDGE, terms } from "./sources";

export type KnowledgeDocument = { id: string; title: string; url: string; text: string; section?: string; reviewedOn?: string; retrievedAt?: string; sourceUpdatedOn?: string | null; snapshotNote?: string; kind: "reference" | "site documentation" | "navigation" };
const aliases: Record<string, string[]> = {
  pagamento: ["paid", "payment", "disbursement"], pagamentos: ["paid", "payments", "disbursements"], pago: ["paid"], pagos: ["paid"], gastou: ["paid", "spending"], gastos: ["spending", "budget"],
  projeto: ["project", "grant"], projetos: ["projects", "grants"], beneficiario: ["recipient"], beneficiarios: ["recipients"], proposta: ["proposal"], propostas: ["proposals"],
  tesouro: ["treasury"], tesouros: ["treasuries", "treasury"], saldo: ["balance"], saldos: ["balances"], preco: ["price"], cotacao: ["price"],
  carteira: ["wallet"], carteiras: ["wallets"], privacidade: ["privacy"], blindada: ["shielded"], blindadas: ["shielded"], chave: ["key"], chaves: ["keys"],
  metodologia: ["methodology", "compute"], fontes: ["sources"], dados: ["data"], calculado: ["computed"], calcular: ["compute"], diferenca: ["difference"],
  governanca: ["governance"], reuniao: ["meeting"], reunioes: ["meetings"], eleicao: ["election"], eleicoes: ["elections"], membros: ["members"], comite: ["committee"],
  cerimonia: ["ceremony"], historia: ["history"], mineracao: ["mining"], oferta: ["supply"], orcamento: ["budget"], comunidade: ["community"], comunidades: ["communities"],
  blossom: ["shorter", "target", "spacing"], intervalo: ["spacing"], blocos: ["block"],
  noticias: ["news"], ultimo: ["latest"], ultimos: ["latest"], atual: ["current"], mensal: ["monthly"], relatorio: ["report"], relatorios: ["reports"],
};
export function searchTerms(value: string): string[] {
  return [...new Set(terms(value).flatMap((word)=>[word, ...(Object.hasOwn(aliases, word) ? aliases[word] : [])]))];
}
// Concept expansion is explicit and auditable; no embedding API is needed for this corpus.
const concepts: Array<[string, RegExp, string[]]> = [
  ["viewing-keys", /viewing|visualizacao|\bivk\b|\bfvk\b|\bufvk\b|\buivk\b|read.only|somente leitura|see.*sender|ver.*remetente|can.*viewer/, ["viewing", "key", "sender", "recipient"]],
  ["addresses", /unified|unificad|receiver|recebedor|endereco|address/, ["unified", "addresses", "receiver"]],
  ["privacy", /privac|shield|blindad|anonim|anonym|rastre|trace|hide.*amount|ocult.*valor/, ["privacy", "shielded", "transparent"]],
  ["issuance", /halving|supply|oferta|emissao|issuance|cap.*coins|21.*million|21.*milh|block.*spacing/, ["issuance", "supply", "halving"]],
  ["funding", /dev.?fund|fundo.*desenvolvimento|subsid|funding.*split|alocacao|miners.*25|mineradores.*25/, ["funding", "allocation", "subsidy"]],
  ["ledger", /milestone|marcos|pagamento|pagou|paid|budget|orcamento|orcad|liquidacao|settlement|methodolog|metodolog|\bimport\b|imported|importad/, ["ledger", "methodology", "paid"]],
  ["calculator", /coverage|cobertura|runway|simul|cenario|scenario|\bmeta\b|ownership|participacao|calculad|calculator|cypherpunk|cipherpunk|20[x×]|quanto.*anos|how many years/, ["calculator", "treasury", "scenario"]],
  ["governance", /governan|governanc|ativad|activated|consensus|consenso|votacao|poll|enquete/, ["governance", "activation", "decision"]],
  ["ecosystem", /carteira|wallet|zingo|zashi|zodl|zebra|zaino|ecossistema|ecosystem/, ["ecosystem", "wallet"]],
];
type ReferenceSource = { id: string; title: string; url: string; text: string; retrievedAt: string; sourceUpdatedOn: string | null; note: string };
function referenceChunks(source: ReferenceSource): KnowledgeDocument[] {
  const chunks: Array<{ text: string; section?: string }> = []; let chunk = "";
  const headings: string[] = [], styles: string[] = [];
  const flush = () => { if (chunk.trim()) chunks.push({ text: chunk, ...(headings.length ? { section: headings.filter(Boolean).join(" > ").slice(0, 240) } : {}) }); chunk = ""; };
  const lines = source.text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const paragraph = lines[i];
    // Keep section ancestry attached so rules for one pool are not generalized to another.
    if (source.id.startsWith("zip-") || source.id.startsWith("draft-")) {
      const md = paragraph.match(/^(#{1,6})\s+(.+)/);
      const underline = lines[i + 1]?.trim().match(/^([=~^`+#*-])\1{2,}$/);
      if (md || (underline && paragraph.trim())) {
        flush();
        if (underline && !styles.includes(underline[1])) styles.push(underline[1]);
        const level = md ? md[1].length - 1 : styles.indexOf(underline![1]);
        headings.length = level; headings[level] = md ? md[2] : paragraph.trim();
      }
    }
    for (let offset = 0; offset < paragraph.length; offset += 1300) {
      const piece = paragraph.slice(offset, offset + 1300);
      if (chunk.length + piece.length > 1400) flush();
      chunk += piece + "\n";
    }
  }
  flush();
  // A selected paragraph must retain document-wide key authority assumptions.
  const scope = source.id === "zip-0310"
    ? " Scope: every ZIP 310 example assumes Ian holds Alice's full Sapling viewing key (FVK), even when a step mentions its derived IVK. An incoming viewing key alone cannot derive nullifiers or detect later spends."
    : "";
  return chunks.map(({ text, section }, i) => ({ ...(section ? { section } : {}), id: `reference:${source.id}:${i}`, title: source.title, url: source.url, text, kind: "reference" as const, retrievedAt: source.retrievedAt, sourceUpdatedOn: source.sourceUpdatedOn, snapshotNote: source.note + scope }));
}
const referenceDocs = references.sources.filter((source) => !source.id.startsWith("zip-")).flatMap(referenceChunks);
const navigation: KnowledgeDocument[] = APPS.filter((app)=>!app.admin).flatMap((app)=>[
  {id:`nav:${app.id}`,title:app.label,url:`https://openzcash.org${app.href}`,text:app.sub,kind:"navigation" as const},
  ...app.pages.map((p)=>({id:`nav:${p.href}`,title:`${app.label} · ${p.label}`,url:`https://openzcash.org${p.href}`,text:`${p.label} in ${app.label}.`,kind:"navigation" as const})),
]);
const documents: KnowledgeDocument[] = [
  ...KNOWLEDGE.map((note)=>({id:note.id,title:note.title,url:note.url,reviewedOn:note.reviewedOn,text:`${note.keywords}\n${note.text}`,kind:"reference" as const})),
  ...index.documents.map((doc)=>({...doc,kind:"site documentation" as const})), ...referenceDocs, ...navigation,
];
const indexes = new WeakMap<ZipCorpus, ReturnType<typeof buildSearchIndex>>();
export const bundledZipCorpus = zipSnapshot as ZipCorpus;
function buildSearchIndex(corpus: ZipCorpus) {
  const zipDocs = corpus.documents.flatMap((source) => referenceChunks({ ...source,
    title: source.number === null ? source.title : `ZIP ${source.number}: ${source.title}`,
    retrievedAt: corpus.retrievedAt, sourceUpdatedOn: source.updatedOn,
    note: `Status: ${source.status}. Created: ${source.createdOn ?? "not specified"}. Revision: ${corpus.revision.slice(0, 12)}. Repository snapshot; Created is not first-publication time, and status is not independent activation proof.`,
  }));
  const all = [...documents, ...zipDocs];
  const normalized = all.map((doc) => ({ doc, title: new Set(searchTerms(`${doc.title} ${doc.section ?? ""}`)), tokens: new Set(searchTerms(`${doc.section ?? ""} ${doc.text}`)), length: terms(doc.text).length }));
  const frequency = new Map<string, number>();
  for (const doc of normalized) for (const token of doc.tokens) frequency.set(token, (frequency.get(token) ?? 0) + 1);
  const averageLength = normalized.reduce((sum, item) => sum + item.length, 0) / normalized.length;
  return { normalized, frequency, averageLength, count: all.length, zipChunks: zipDocs.length };
}
export function searchKnowledge(query: string, limit = 4, budget = 5000, corpus: ZipCorpus = bundledZipCorpus): KnowledgeDocument[] {
  let searchIndex = indexes.get(corpus);
  if (!searchIndex) { searchIndex = buildSearchIndex(corpus); indexes.set(corpus, searchIndex); }
  const { normalized, frequency, averageLength, count } = searchIndex;
  const normalizedQuery = query.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const matchingConcepts = concepts.filter(([, pattern]) => pattern.test(normalizedQuery));
  const tokens = [...new Set([...searchTerms(query), ...matchingConcepts.flatMap(([, , words]) => words)])];
  const zips = requestedZips(query);
  const scored = normalized.map(({ doc, title, tokens: body, length }, i) => {
    let score = 0;
    for (const token of tokens) {
      const idf = Math.log(1 + (count - (frequency.get(token) ?? 0) + 0.5) / ((frequency.get(token) ?? 0) + 0.5));
      if (body.has(token)) score += idf * 2.2 / (1 + 1.2 * (0.25 + 0.75 * length / averageLength));
      if (title.has(token)) score += 2 * idf;
    }
    if (matchingConcepts.some(([id]) => id === doc.id)) score += 12;
    if (zips.some((number) => doc.url.endsWith(`zip-${String(number).padStart(4, "0")}`))) score += 30;
    if (doc.kind === "navigation") score *= 0.35;
    return { doc, i, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.i - b.i);
  const selected: KnowledgeDocument[] = []; const perPage = new Map<string, number>(); let used = 2;
  for (const { doc } of scored) {
    if ((perPage.get(doc.url) ?? 0) >= 2) continue;
    const size = JSON.stringify(doc).length + (selected.length ? 1 : 0);
    if (used + size > budget) continue;
    selected.push(doc); used += size; perPage.set(doc.url, (perPage.get(doc.url) ?? 0) + 1);
    if (selected.length >= limit) break;
  }
  return selected;
}
export const knowledgeCoverage = { sourceFiles: index.sourceFiles, chunks: index.documents.length, referenceNotes: KNOWLEDGE.length, referenceSources: references.sources.filter((s) => !s.id.startsWith("zip-")).length + bundledZipCorpus.documents.length, referenceChunks: referenceDocs.length, zipDocuments: bundledZipCorpus.documents.length, zipRevision: bundledZipCorpus.revision, revision: index.sourceRevision };
