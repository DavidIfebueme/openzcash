import { APPS } from "@/lib/design-routes";
import index from "./public-content.json";
import { KNOWLEDGE, terms } from "./sources";

export type KnowledgeDocument = { id: string; title: string; url: string; text: string; reviewedOn?: string; kind: "reference" | "site documentation" | "navigation" };
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
const navigation: KnowledgeDocument[] = APPS.filter((app)=>!app.admin).flatMap((app)=>[
  {id:`nav:${app.id}`,title:app.label,url:`https://openzcash.org${app.href}`,text:app.sub,kind:"navigation" as const},
  ...app.pages.map((p)=>({id:`nav:${p.href}`,title:`${app.label} · ${p.label}`,url:`https://openzcash.org${p.href}`,text:`${p.label} in ${app.label}.`,kind:"navigation" as const})),
]);
const documents: KnowledgeDocument[] = [
  ...KNOWLEDGE.map((note)=>({id:note.id,title:note.title,url:note.url,reviewedOn:note.reviewedOn,text:`${note.keywords}\n${note.text}`,kind:"reference" as const})),
  ...index.documents.map((doc)=>({...doc,kind:"site documentation" as const})), ...navigation,
];
const normalized=documents.map((doc)=>({doc,title:searchTerms(doc.title).join(" "),tokens:new Set(searchTerms(doc.text))}));
export function searchKnowledge(query: string, limit=4, budget=5000): KnowledgeDocument[] {
  const tokens=searchTerms(query);
  const scored=normalized.map(({doc,title,tokens:body},i)=>({doc,i,score:tokens.reduce((score,t)=>score+(body.has(t)?1:0)+(title.includes(t)?3:0),0)}))
    .filter((x)=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i);
  const selected: KnowledgeDocument[]=[];const perPage=new Map<string,number>();let used=2;
  for(const {doc} of scored) {
    if((perPage.get(doc.url)??0)>=2)continue;
    const size=JSON.stringify(doc).length+(selected.length?1:0);
    if(used+size>budget)continue;
    selected.push(doc);used+=size;perPage.set(doc.url,(perPage.get(doc.url)??0)+1);
    if(selected.length>=limit)break;
  }
  return selected;
}
export const knowledgeCoverage={sourceFiles:index.sourceFiles,chunks:index.documents.length,referenceNotes:KNOWLEDGE.length,revision:index.sourceRevision};
