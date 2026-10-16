import "server-only";
import { z } from "zod";
import { projectHistoryDirectory, readProjectHistory } from "@/lib/project-history/data";
import { searchHistoryIdentities } from "@/lib/project-history/identities";
import { eventsInMonth } from "@/lib/project-history/build";
import { projectInsights } from "@/lib/project-history/insights";
import { boundedRead } from "./timeout";
import { pick, type DirectLanguage } from "./language";
import type { Evidence } from "./local";

export const projectHistoryQuerySchema = z.object({ query: z.string().trim().min(1).max(120), month: z.string().regex(/^20\d{2}-(?:0[1-9]|1[0-2])$/).nullable() }).strict();
export const projectHistoryTool = {
  type: "function" as const, name: "query_project_history", strict: true,
  description: "Read a project's source-linked funding history, paid milestones, published releases and evidence gaps. Query an exact project ID or name; ambiguous names return choices. month filters events by UTC event date only, not financial totals or historical knowledge. No project impact score or inferred milestone completion.",
  parameters: { type: "object", properties: { query: { type: "string" }, month: { type: ["string", "null"] } }, required: ["query", "month"], additionalProperties: false },
};

export function directProjectHistoryQuery(question: string): string | undefined {
  if (/\b(?:why|impact|compare|explain|failed|caus\w*|por que|avalie|explique|falhou|impacto|explica)\b/i.test(question)) return;
  const match = question.trim().match(/^(?:(?:show|give me) (?:the )?project history (?:for|of)|(?:mostre|mostrar|ver) (?:a )?(?:ficha hist[oó]rica|hist[oó]rico do projeto) (?:de|do|da)|(?:muestra|mostrar) (?:el )?historial (?:del proyecto|de)) ([\p{L}\p{N} !_.·-]{1,120}?)[.!?]?$/iu);
  return match?.[1].trim();
}

export async function lookupProjectHistory(raw: unknown, signal: AbortSignal): Promise<Evidence> {
  const parsed = projectHistoryQuerySchema.safeParse(raw);
  if (!parsed.success) return { content: JSON.stringify({ error: "Use a project name and an optional YYYY-MM event month." }) };
  signal.throwIfAborted();
  const matches = searchHistoryIdentities(await projectHistoryDirectory(), parsed.data.query);
  if (matches.length !== 1) return { content: JSON.stringify({ data: { kind: "project_history_choices", matchCount: matches.length, choices: matches.slice(0, 15).map(({ id, name }) => ({ id, name, url: `https://openzcash.org/ecosystem/history/${id}` })), note: "Choose a specific identity; never merge these projects or infer no funding from no search match." } }), source: { title: "OpenZcash project histories", url: "https://openzcash.org/ecosystem/history", retrievedAt: new Date().toISOString() } };
  const id = matches[0].id, url = `https://openzcash.org/ecosystem/history/${id}`;
  try {
    const history = await boundedRead(() => readProjectHistory(id), signal, 9000);
    signal.throwIfAborted();
    if (!history) throw new Error("Missing identity");
    const events = parsed.data.month ? eventsInMonth(history.timeline, parsed.data.month) : history.timeline;
    const data = {
      kind: "project_history", ...history,
      insights: projectInsights(history),
      reviews: history.reviews.filter(review => review.linked && !review.supersededBy).slice(0, 8),
      sources: history.sources.slice(0, 20), repositories: history.repositories.slice(0, 10),
      counts: { sources: history.sources.length, repositories: history.repositories.length, grants: history.grants.length, events: events.length,
        publishedReleases: history.timeline.filter(event => event.kind === "release").length,
        paidEntries: history.coverage.paymentsAvailable ? new Set(history.grants.flatMap(grant => grant.milestones.filter(item => item.paymentRecorded).map(item => item.id))).size : null,
        reviewedDeliveries: history.timeline.filter(event => event.evidence === "reviewed_delivery").length },
      grants: history.grants.slice(0, 10).map(grant => ({ ...grant,
        budgetUsdCents: grant.budgetUsdCents.known, paidBudgetUsdCents: grant.paidBudgetUsdCents.known, recordedZecZat: grant.recordedZecZat.known,
        amountCoverage: { budget: grant.budgetUsdCents, paidBudget: grant.paidBudgetUsdCents, paidZec: grant.recordedZecZat },
        milestoneCount: grant.milestones.length, milestones: grant.milestones.slice(0, 5).map(item => ({ ...item, deliverable: item.deliverable?.slice(0, 500) ?? null })) })),
      timeline: events.slice(0, 15), gaps: history.gaps.slice(0, 12),
      excerpt: { sourcesShown: Math.min(20, history.sources.length), repositoriesShown: Math.min(10, history.repositories.length), grantsShown: Math.min(10, history.grants.length), eventsShown: Math.min(15, events.length), milestonesPerGrantLimit: 5,
        month: parsed.data.month, financialBasis: "all-time associated grants; never sum excerpts or shared grants", completeRecordUrl: url },
    };
    return { content: JSON.stringify({ data, sourceUrl: url }), source: { title: `${history.project.name} · project history`, url, retrievedAt: history.assembledAt } };
  } catch { signal.throwIfAborted(); return { content: JSON.stringify({ error: "Project history is unavailable; do not invent status, amounts or completion." }), source: { title: "Project history", url } }; }
}

/** The local route summarizes computed coverage, not a generated project rating. */
export function projectHistoryAnswer(result: Evidence, lang: DirectLanguage): string {
  const data = JSON.parse(result.content).data;
  if (!data) return pick(lang, { en: "This project history is unavailable right now. Missing records do not mean zero funding.", pt: "A ficha está indisponível agora. A falta de registros não significa financiamento zero.", es: "El historial no está disponible ahora. La falta de registros no significa financiación cero." });
  if (data.kind === "project_history_choices") return pick(lang, {
    en: data.matchCount ? "These identities match. Open the specific project:" : "No identity matched in the current catalog. Try its full project name.",
    pt: data.matchCount ? "Encontrei estas identidades. Abra o projeto específico:" : "Não encontrei essa identidade no catálogo atual. Tente o nome completo do projeto.",
    es: data.matchCount ? "Coinciden estas identidades. Abre el proyecto específico:" : "No encontré esa identidad en el catálogo actual. Prueba el nombre completo del proyecto.",
  }) + (data.choices.length ? `\n\n${data.choices.map((item: { name: string; url: string }) => `- [${item.name}](${item.url})`).join("\n")}` : "");
  const url = result.source!.url, count = data.counts;
  const snapshot = data.repositorySnapshotAt.slice(0, 10);
  const workDescription = data.project.communityId ? pick(lang, {
    en: `${data.insights.reportSources} linked community report sources. Their individual claims still need review`,
    pt: `${data.insights.reportSources} fontes de reports comunitários vinculadas. As alegações individuais ainda precisam de revisão`,
    es: `${data.insights.reportSources} fuentes de informes comunitarios vinculadas. Sus afirmaciones individuales todavía requieren revisión`,
  }) : pick(lang, {
    en: `${count.publishedReleases} linked releases (base snapshot ${snapshot}, plus individually reviewed additions)`,
    pt: `${count.publishedReleases} releases vinculados (base de ${snapshot}, com adições revisadas individualmente)`,
    es: `${count.publishedReleases} releases vinculados (base del ${snapshot}, con adiciones revisadas individualmente)`,
  });
  const latest = data.insights?.latestWork;
  const latestLine = latest ? pick(lang, {
    en: `\n\nLatest linked work (${latest.date.slice(0, 10)}): [${latest.title}](${latest.source.url}). ${latest.detail}`,
    pt: `\n\nTrabalho mais recente vinculado (${latest.date.slice(0, 10)}): [${latest.title}](${latest.source.url}). A publicação não comprova o aceite de um marco financiado.`,
    es: `\n\nTrabajo más reciente vinculado (${latest.date.slice(0, 10)}): [${latest.title}](${latest.source.url}). La publicación no prueba la aceptación de un hito financiado.`,
  }) : "";
  return pick(lang, {
    en: `**[${data.project.name} — project history](${url})**\n\n${count.grants} associated grant records; ${count.paidEntries ?? "unavailable"} paid ledger entries; ${workDescription}.${latestLine}\n\nThe history separates requested funding, published decisions, ledger payments and evidence of work. ${count.reviewedDeliveries ? `${count.reviewedDeliveries} reviewed delivery records are linked.` : "No milestone acceptance evidence is linked yet; that is a coverage gap, not proof of non-delivery."} A payment or release does not establish grant completion.\n\nOpen the history for the timeline, amounts, source dates and evidence gaps.${!data.coverage.proposalsAvailable || !data.coverage.paymentsAvailable ? " A financial source is unavailable; dated catalog references are retained." : ""}`,
    pt: `**[${data.project.name} — ficha histórica](${url})**\n\n${count.grants} registros de grants associados; ${count.paidEntries ?? "indisponível"} registros de pagamento; ${workDescription}.${latestLine}\n\nA ficha separa pedidos, decisões publicadas, pagamentos e evidências de trabalho. ${count.reviewedDeliveries ? `Há ${count.reviewedDeliveries} registros de entrega revisados.` : "Ainda não há evidência vinculada de aceite dos marcos; isso é uma lacuna de cobertura, não prova de falta de entrega."} Pagamento ou release não comprova conclusão do grant.\n\nAbra a ficha para ver a linha do tempo, os valores, as datas das fontes e as lacunas.${!data.coverage.proposalsAvailable || !data.coverage.paymentsAvailable ? " Uma fonte financeira está indisponível; mantivemos as referências datadas do catálogo." : ""}`,
    es: `**[${data.project.name} — historial](${url})**\n\n${count.grants} registros de grants asociados; ${count.paidEntries ?? "no disponible"} registros de pago; ${workDescription}.${latestLine}\n\nEl historial separa solicitudes, decisiones, pagos y evidencia de trabajo. ${count.reviewedDeliveries ? `Hay ${count.reviewedDeliveries} registros de entrega revisados.` : "No hay evidencia vinculada de aceptación de hitos; es una brecha de cobertura, no prueba de falta de entrega."} Un pago o release no establece la finalización del grant.\n\nAbre el historial para ver fechas, importes, fuentes y brechas.${!data.coverage.proposalsAvailable || !data.coverage.paymentsAvailable ? " Una fuente financiera no está disponible; se conservan las referencias fechadas del catálogo." : ""}`,
  });
}
