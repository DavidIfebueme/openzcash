import { z } from "zod";
import { safeSourceUrl } from "./sources";
import type { ZipCorpus } from "./zip-source";

const amount = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER / 100);
const dated = z.string().refine((s) => Number.isFinite(Date.parse(s)) && Date.parse(s) <= Date.now() + 60_000);
const zcgSchema = z.object({ zec: amount.nullable(), cashUsd: amount.nullable(), snapshotAt: dated, importedAt: dated, updatesRequired: z.boolean() });
const lockboxSchema = z.object({ estimatedZec: amount, estimateThroughBlock: z.number().int().positive(), sourceAnchorBlock: z.number().int().positive(), sourceAnchorDate: dated, importedAt: dated, updatesRequired: z.boolean() });
const quoteSchema = z.object({ cents: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), quotedAt: dated, stale: z.boolean() });
const time = (s: string, pt: boolean) => new Intl.DateTimeFormat(pt ? "pt-BR" : "en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }).format(new Date(s)) + " UTC";
const plain = (s: string) => s.replace(/[\\[\]<>*`|]/g, "").replace(/\s+/g, " ").trim();

/** Render only validated fields, never missing values as zero or a report timestamp as a live quote. */
export function treasuryAnswer(content: string, fund: "zcg" | "lockbox" | "both", pt: boolean): string {
  const n = (v: number) => new Intl.NumberFormat(pt ? "pt-BR" : "en-US", { maximumFractionDigits: 8 }).format(v);
  const usd = (v: number) => new Intl.NumberFormat(pt ? "pt-BR" : "en-US", { style: "currency", currency: "USD" }).format(v);
  let data;
  try { data = JSON.parse(content).data; } catch { /* handled as unavailable */ }
  const zcg = zcgSchema.safeParse(data?.funds?.zcg);
  const lockbox = lockboxSchema.safeParse(data?.funds?.lockbox);
  const quote = quoteSchema.safeParse(data?.price);
  const lines: string[] = [];
  const pools: number[] = [];
  let cash = 0, complete = true;
  if (fund !== "lockbox") {
    if (zcg.success) {
      const d = zcg.data;
      lines.push(pt ? `**ZCG — saldo reportado:** ${d.zec === null ? "ZEC não informado" : `${n(d.zec)} ZEC`} + ${d.cashUsd === null ? "caixa em USD não informado" : `${usd(d.cashUsd)} em caixa USD`}.` : `**ZCG — reported holdings:** ${d.zec === null ? "ZEC not reported" : `${n(d.zec)} ZEC`} + ${d.cashUsd === null ? "USD cash not reported" : `${usd(d.cashUsd)} USD cash`}.`);
      lines.push(pt ? `Relatório de ${time(d.snapshotAt, pt)}; importado em ${time(d.importedAt, pt)}.` : `Report dated ${time(d.snapshotAt, pt)}; imported ${time(d.importedAt, pt)}.`);
      if (d.updatesRequired) lines.push(pt ? "A fonte do ZCG está marcada como precisando de atualização." : "The ZCG source is marked as needing updates.");
      if (d.zec === null || d.cashUsd === null) complete = false;
      else { pools.push(d.zec); cash += d.cashUsd; }
    } else { complete = false; lines.push(pt ? "O saldo reportado do ZCG está indisponível; isso não significa saldo zero." : "Reported ZCG holdings are unavailable; this does not mean a zero balance."); }
  }
  if (fund !== "zcg") {
    if (lockbox.success) {
      const d = lockbox.data;
      lines.push(pt ? `**Lockbox — estimativa:** ${n(d.estimatedZec)} ZEC até o bloco **${n(d.estimateThroughBlock)}**.` : `**Lockbox — estimate:** ${n(d.estimatedZec)} ZEC through block **${n(d.estimateThroughBlock)}**.`);
      lines.push(pt ? `Referência: bloco ${n(d.sourceAnchorBlock)}, relatório de ${time(d.sourceAnchorDate, pt)}. O saldo adiciona acúmulos programados por bloco; não é uma leitura atual de carteira. Saídas posteriores podem exigir reconciliação.` : `Anchor: block ${n(d.sourceAnchorBlock)}, report dated ${time(d.sourceAnchorDate, pt)}. The estimate adds scheduled block accruals; it is not a fresh wallet reading. Later outflows may require reconciliation.`);
      if (d.updatesRequired) lines.push(pt ? "A fonte do Lockbox está marcada como precisando de atualização." : "The Lockbox source is marked as needing updates.");
      pools.push(d.estimatedZec);
    } else { complete = false; lines.push(pt ? "A estimativa do Lockbox está indisponível; isso não significa saldo zero." : "The Lockbox estimate is unavailable; this does not mean a zero balance."); }
  }
  if (quote.success && complete) {
    const q = quote.data;
    const value = (pools.reduce((sum, zec) => sum + Math.round(zec * (q.cents / 100) * 100), 0) + Math.round(cash * 100)) / 100;
    const stale = q.stale || Date.now() - Date.parse(q.quotedAt) >= 600_000;
    if (Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER / 100) {
      lines.push(pt ? `**Valor bruto estimado${fund === "both" ? " combinado" : ""}: ${usd(value)}**, usando ${usd(q.cents / 100)} por ZEC, cotação de ${time(q.quotedAt, pt)}${stale ? " (em cache; não confirmada como atual)" : ""}.` : `**Estimated ${fund === "both" ? "combined " : ""}gross value: ${usd(value)}**, using ${usd(q.cents / 100)} per ZEC, quoted ${time(q.quotedAt, pt)}${stale ? " (cached; not confirmed current)" : ""}.`);
    }
  } else if (complete) lines.push(pt ? "Não foi possível validar uma cotação em USD para valorar esses saldos." : "A valid USD quote is unavailable for valuing these holdings.");
  lines.push(pt ? "A cotação de mercado não é a cotação do relatório. ZCG e Lockbox têm restrições de gasto separadas; valor bruto não equivale a um único caixa disponível." : "The market quote is not the report's price. ZCG and Lockbox have separate spending restrictions; gross value is not one pool of spendable cash.");
  lines.push(...(fund !== "lockbox" ? ["[ZCG · sources and balances](https://openzcash.org/zcg/reconciliation)"] : []), ...(fund !== "zcg" ? ["[Lockbox · estimate](https://openzcash.org/lockbox)"] : []));
  return lines.join("\n\n");
}

export function numberedZipAnswer(number: number, overview: boolean, corpus: ZipCorpus, stale: boolean, pt: boolean): string | undefined {
  if (stale || !dated.safeParse(corpus.retrievedAt).success) return;
  const d = corpus.documents.find((item) => item.number === number);
  if (!d || !safeSourceUrl(d.sourceUrl)) return;
  const header = `**[ZIP ${number}: ${plain(d.title)}](${d.sourceUrl})**`;
  const status = pt ? `Status no documento: **${plain(d.status)}**. Created: **${d.createdOn ?? "não informado"}**.${d.updatedOn ? ` Last-Updated: **${d.updatedOn}**.` : ""}` : `Document status: **${plain(d.status)}**. Created: **${d.createdOn ?? "not specified"}**.${d.updatedOn ? ` Last-Updated: **${d.updatedOn}**.` : ""}`;
  // Quote the first official abstract paragraph; never fabricate a technical summary from a title.
  const paragraph = d.text.match(/(?:^|\n)(?:#{1,6} +Abstract[^\S\n]*\n|Abstract[^\S\n]*\n[=-]{3,}[^\S\n]*\n)\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*\n|$)/i)?.[1];
  const raw = paragraph ? plain(paragraph.replace(/\[(?:#|\^)[^\]]+\]_?/g, "")) : "";
  const abstract = raw.length > 600 ? raw.slice(0, 600).replace(/\s+\S*$/, "") + "…" : raw;
  const summary = overview && abstract ? `${pt ? "Trecho do resumo oficial (em inglês)" : "Official abstract excerpt"}:\n> ${abstract}` : "";
  const provenance = pt ? `Catálogo verificado em ${time(corpus.retrievedAt, pt)}, revisão ${corpus.revision.slice(0, 12)}. Created é a data declarada de criação, não a primeira publicação. O status do documento não comprova ativação na rede.` : `Catalog checked ${time(corpus.retrievedAt, pt)}, revision ${corpus.revision.slice(0, 12)}. Created is the declared creation date, not first publication. Document status does not establish network activation.`;
  return [header, status, summary, provenance].filter(Boolean).join("\n\n");
}
