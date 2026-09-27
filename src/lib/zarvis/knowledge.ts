import { APPS } from "@/lib/design-routes";
import index from "./public-content.json";
import references from "./reference-content.json";
import { KNOWLEDGE, terms } from "./sources";

export type KnowledgeDocument = { id: string; title: string; url: string; text: string; reviewedOn?: string; retrievedAt?: string; sourceUpdatedOn?: string | null; snapshotNote?: string; kind: "reference" | "site documentation" | "navigation" };
const aliases: Record<string, string[]> = {
  pagamento: ["paid", "payment", "disbursement"], pagamentos: ["paid", "payments", "disbursements"], pago: ["paid"], pagos: ["paid"], gastou: ["paid", "spending"], gastos: ["spending", "budget"],
  projeto: ["project", "grant"], projetos: ["projects", "grants"], beneficiario: ["recipient"], beneficiarios: ["recipients"], proposta: ["proposal"], propostas: ["proposals"],
  tesouro: ["treasury"], tesouros: ["treasuries", "treasury"], saldo: ["balance"], saldos: ["balances"], preco: ["price"], cotacao: ["price"],
  carteira: ["wallet"], carteiras: ["wallets"], privacidade: ["privacy"], blindada: ["shielded"], blindadas: ["shielded"], chave: ["key"], chaves: ["keys"],
  metodologia: ["methodology", "compute"], fontes: ["sources"], dados: ["data"], calculado: ["computed"], calcular: ["compute"], diferenca: ["difference"],
  governanca: ["governance"], reuniao: ["meeting"], reunioes: ["meetings"], eleicao: ["election"], eleicoes: ["elections"], membros: ["members"], comite: ["committee"],
  cerimonia: ["ceremony"], historia: ["history"], mineracao: ["mining"], oferta: ["supply"], orcamento: ["budget"], comunidade: ["community"], comunidades: ["communities"],
  noticias: ["news"], ultimo: ["latest"], ultimos: ["latest"], atual: ["current"], mensal: ["monthly"], relatorio: ["report"], relatorios: ["reports"],
};
export function searchTerms(value: string): string[] {
  return [...new Set(terms(value).flatMap((word)=>[word, ...(aliases[word]??[])]))];
}
// Concept expansion is explicit and auditable; no embedding API is needed for this corpus.
const concepts: Array<[string, RegExp, string[]]> = [
  ["viewing-keys", /viewing|visualizacao|\bivk\b|\bfvk\b|\bufvk\b|\buivk\b|read.only|somente leitura|see.*sender|ver.*remetente|can.*viewer/, ["viewing", "key", "sender", "recipient"]],
  ["addresses", /unified|unificad|receiver|recebedor|endereco|address/, ["unified", "addresses", "receiver"]],
  ["privacy", /privac|shield|blindad|anonim|anonym|rastre|trace|hide.*amount|ocult.*valor/, ["privacy", "shielded", "transparent"]],
  ["issuance", /halving|supply|oferta|emissao|issuance|cap.*coins|21.*million|21.*milh|block.*spacing/, ["issuance", "supply", "halving"]],
  ["funding", /dev.?fund|fundo.*desenvolvimento|subsid|funding.*split|alocacao|miners.*25|mineradores.*25/, ["funding", "allocation", "subsidy"]],
  ["ledger", /milestone|marcos|pagamento|pagou|paid|budget|orcamento|orcad|liquidacao|settlement|methodolog|metodolog|imported|importad/, ["ledger", "methodology", "paid"]],
  ["calculator", /coverage|cobertura|runway|simul|cenario|scenario|\bmeta\b|ownership|participacao|calculad|calculator|cypherpunk|cipherpunk|20[x×]|quanto.*anos|how many years/, ["calculator", "treasury", "scenario"]],
  ["governance", /governan|governanc|ativad|activated|consensus|consenso|votacao|poll|enquete/, ["governance", "activation", "decision"]],
  ["ecosystem", /carteira|wallet|zingo|zashi|zodl|zebra|zaino|ecossistema|ecosystem/, ["ecosystem", "wallet"]],
];
const referenceDocs: KnowledgeDocument[] = references.sources.flatMap((source) => {
  const chunks: string[] = []; let chunk = "";
  for (const paragraph of source.text.split("\n")) {
    for (let offset = 0; offset < paragraph.length; offset += 1300) {
      const piece = paragraph.slice(offset, offset + 1300);
      if (chunk.length + piece.length > 1400) { chunks.push(chunk); chunk = ""; }
      chunk += piece + "\n";
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks.map((text, i) => ({ id: `reference:${source.id}:${i}`, title: source.title, url: source.url, text, kind: "reference" as const, retrievedAt: source.retrievedAt, sourceUpdatedOn: source.sourceUpdatedOn, snapshotNote: source.note }));
});
const navigation: KnowledgeDocument[] = APPS.filter((app)=>!app.admin).flatMap((app)=>[
  {id:`nav:${app.id}`,title:app.label,url:`https://openzcash.org${app.href}`,text:app.sub,kind:"navigation" as const},
  ...app.pages.map((p)=>({id:`nav:${p.href}`,title:`${app.label} · ${p.label}`,url:`https://openzcash.org${p.href}`,text:`${p.label} in ${app.label}.`,kind:"navigation" as const})),
]);
const documents: KnowledgeDocument[] = [
  ...KNOWLEDGE.map((note)=>({id:note.id,title:note.title,url:note.url,reviewedOn:note.reviewedOn,text:`${note.keywords}\n${note.text}`,kind:"reference" as const})),
  ...index.documents.map((doc)=>({...doc,kind:"site documentation" as const})), ...referenceDocs, ...navigation,
];
const normalized = documents.map((doc) => ({ doc, title: new Set(searchTerms(doc.title)), tokens: new Set(searchTerms(doc.text)), length: terms(doc.text).length }));
const frequency = new Map<string, number>();
for (const doc of normalized) for (const token of doc.tokens) frequency.set(token, (frequency.get(token) ?? 0) + 1);
const averageLength = normalized.reduce((sum, item) => sum + item.length, 0) / normalized.length;
export function searchKnowledge(query: string, limit = 4, budget = 5000): KnowledgeDocument[] {
  const normalizedQuery = query.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const matchingConcepts = concepts.filter(([, pattern]) => pattern.test(normalizedQuery));
  const tokens = [...new Set([...searchTerms(query), ...matchingConcepts.flatMap(([, , words]) => words)])];
  const zip = normalizedQuery.match(/\bzip[ -]*0*(\d+)\b/);
  const scored = normalized.map(({ doc, title, tokens: body, length }, i) => {
    let score = 0;
    for (const token of tokens) {
      const idf = Math.log(1 + (documents.length - (frequency.get(token) ?? 0) + 0.5) / ((frequency.get(token) ?? 0) + 0.5));
      if (body.has(token)) score += idf * 2.2 / (1 + 1.2 * (0.25 + 0.75 * length / averageLength));
      if (title.has(token)) score += 2 * idf;
    }
    if (matchingConcepts.some(([id]) => id === doc.id)) score += 12;
    if (zip && doc.url.endsWith(`zip-${zip[1].padStart(4, "0")}`)) score += 30;
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
export const knowledgeCoverage = { sourceFiles: index.sourceFiles, chunks: index.documents.length, referenceNotes: KNOWLEDGE.length, referenceSources: references.sources.length, referenceChunks: referenceDocs.length, revision: index.sourceRevision };
