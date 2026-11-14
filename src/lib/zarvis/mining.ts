import "server-only";
import { z } from "zod";
import { locale, pick, type DirectLanguage } from "./language";
import { targetSpacingSeconds } from "@/lib/funding/consensus";

export const MINING_SOURCE = "https://api.zcashinfo.com/api/v1/mining/overview";
const METHOD = "https://zcashinfo.com/learn/solrate/";
const MAX_AGE_MS = 15 * 60_000;
const MAX_BYTES = 2 * 1024 * 1024;
const positive = z.number().finite().positive();
const block = z.object({ height: z.number().int().min(653_600), time: positive, difficulty: positive, status: z.string().nullish() });
/** Solutions of work per unit of difficulty in the publisher's formula. */
const WORK_PER_DIFFICULTY = 8192;
const overview = z.object({
  info: z.object({ best_block: z.number().int(), chain_tip: z.number().int(), status: z.string(), target_block_spacing_secs: positive.nullish(), work_per_difficulty: positive.nullish() }),
  recent_blocks: z.array(block).length(20),
});
export const miningSnapshotSchema = z.object({
  solrate: positive, unit: z.literal("Sol/s"), blockCount: z.literal(20),
  /** The divisor of the estimate: 75 from Blossom, 25 since NU7 (ZIP 218). */
  targetSpacingSeconds: z.union([z.literal(75), z.literal(25)]),
  fromHeight: z.number().int().positive(), toHeight: z.number().int().positive(),
  observedFrom: z.iso.datetime(), observedTo: z.iso.datetime(), retrievedAt: z.iso.datetime(),
  stale: z.boolean(),
});
export type MiningSnapshot = z.infer<typeof miningSnapshotSchema>;
let cached: MiningSnapshot | undefined;

/**
 * Match the publisher's formula, difficulty × 8192 ÷ target block spacing, with
 * source heights and times intact. The spacing comes from the consensus rules
 * at the sampled height; a source that reports another one is not used.
 */
export function miningSnapshot(value: unknown, now = Date.now()): MiningSnapshot {
  const data = overview.parse(value);
  const blocks = [...data.recent_blocks].sort((a, b) => a.height - b.height);
  if (data.info.status !== "synced" || data.info.chain_tip - data.info.best_block > 2 || data.info.chain_tip < data.info.best_block
    || blocks.at(-1)!.height !== data.info.best_block
    || blocks.some((b, i) => b.status?.toUpperCase() === "STALE" || (i > 0 && b.height !== blocks[i - 1].height + 1))) throw new Error("MINING_INCOMPLETE");
  const times = blocks.map(b => b.time * 1000);
  const from = Math.min(...times), to = Math.max(...times);
  if (from < Date.UTC(2019, 11, 11) || to > now + 120_000) throw new Error("MINING_INVALID_TIME");
  const difficulty = blocks.reduce((sum, b) => sum + b.difficulty, 0) / blocks.length;
  const spacing = targetSpacingSeconds(blocks.at(-1)!.height);
  const { target_block_spacing_secs: reportedSpacing, work_per_difficulty: reportedWork } = data.info;
  if ((reportedSpacing != null && reportedSpacing !== spacing) || (reportedWork != null && reportedWork !== WORK_PER_DIFFICULTY)) throw new Error("MINING_SPACING_MISMATCH");
  return miningSnapshotSchema.parse({
    solrate: difficulty * WORK_PER_DIFFICULTY / spacing, unit: "Sol/s", blockCount: 20, targetSpacingSeconds: spacing,
    fromHeight: blocks[0].height, toHeight: blocks.at(-1)!.height,
    observedFrom: new Date(from).toISOString(), observedTo: new Date(to).toISOString(),
    retrievedAt: new Date(now).toISOString(), stale: now - to > MAX_AGE_MS,
  });
}

/** Fixed public endpoint only. Never forward the question, visitor headers or credentials. */
export async function readMiningSnapshot(signal: AbortSignal): Promise<MiningSnapshot> {
  signal.throwIfAborted();
  const now = Date.now();
  if (cached && now - Date.parse(cached.retrievedAt) < 60_000) return { ...cached, stale: now - Date.parse(cached.observedTo) > MAX_AGE_MS };
  const response = await fetch(MINING_SOURCE, {
    headers: { Accept: "application/json", "User-Agent": "OpenZcash/1.0 (+https://openzcash.org)" },
    redirect: "error", cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json") || !response.body) throw new Error("MINING_UNAVAILABLE");
  const reader = response.body.getReader(); let total = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error("MINING_TOO_LARGE");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  signal.throwIfAborted();
  cached = miningSnapshot(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  return cached;
}

export function miningAnswer(content: string, lang: DirectLanguage): string {
  const unavailable = pick(lang, {
    en: "I could not verify Zcash's current network hashrate. Check [ZcashInfo](https://zcashinfo.com/pools/) or [ZecStats](https://zecstats.com/chart/hashrate), including the estimate's time and averaging window. This does not mean the hashrate is zero.",
    pt: "Não consegui confirmar o hashrate atual da rede Zcash. Confira o [ZcashInfo](https://zcashinfo.com/pools/) ou o [ZecStats](https://zecstats.com/chart/hashrate), observando a data e a janela da estimativa. Isso não significa que o hashrate seja zero.",
    es: "No pude confirmar el hashrate actual de la red Zcash. Consulta [ZcashInfo](https://zcashinfo.com/pools/) o [ZecStats](https://zecstats.com/chart/hashrate), observando la fecha y la ventana de la estimación. Esto no significa que el hashrate sea cero.",
  });
  let data: MiningSnapshot;
  try { data = miningSnapshotSchema.parse(JSON.parse(content).data); } catch { return unavailable; }
  if (Date.parse(data.observedTo) > Date.now() + 120_000 || data.toHeight - data.fromHeight !== 19) return unavailable;
  const stale = data.stale || Date.now() - Date.parse(data.observedTo) > MAX_AGE_MS;
  const number = new Intl.NumberFormat(locale(lang), { maximumFractionDigits: 2 }).format(data.solrate / 1e9);
  const date = (value: string) => new Intl.DateTimeFormat(locale(lang), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
  const text = pick(lang, {
    en: `${stale ? "Last available reference (outdated):" : "Estimated Zcash network hashrate:"} **${number} GSol/s**. Average difficulty over **20 blocks**, from ${data.fromHeight} to ${data.toHeight}, timestamped between ${date(data.observedFrom)} and ${date(data.observedTo)}. Retrieved ${date(data.retrievedAt)}.\n\n${stale ? "I could not verify a current reading. " : ""}Estimate: average difficulty × 8192 ÷ ${data.targetSpacingSeconds}, following ZcashInfo's methodology. It is not a machine count or a 24-hour average.`,
    pt: `${stale ? "Última referência disponível (desatualizada):" : "Hashrate estimado da rede Zcash:"} **${number} GSol/s**. Média da dificuldade de **20 blocos**, de ${data.fromHeight} a ${data.toHeight}, com horários entre ${date(data.observedFrom)} e ${date(data.observedTo)}. Consultado em ${date(data.retrievedAt)}.\n\n${stale ? "Não consegui confirmar uma leitura atual. " : ""}Estimativa: dificuldade média × 8192 ÷ ${data.targetSpacingSeconds}, conforme a metodologia do ZcashInfo. Não é contagem de máquinas nem uma média das últimas 24 horas.`,
    es: `${stale ? "Última referencia disponible (desactualizada):" : "Hashrate estimado de la red Zcash:"} **${number} GSol/s**. Dificultad promedio de **20 bloques**, del ${data.fromHeight} al ${data.toHeight}, con marcas de tiempo entre ${date(data.observedFrom)} y ${date(data.observedTo)}. Consultado el ${date(data.retrievedAt)}.\n\n${stale ? "No pude confirmar una lectura actual. " : ""}Estimación: dificultad promedio × 8192 ÷ ${data.targetSpacingSeconds}, según la metodología de ZcashInfo. No es un conteo de máquinas ni un promedio de 24 horas.`,
  });
  return `${text}\n\n[ZcashInfo · API](${MINING_SOURCE}) · [${pick(lang, { en: "Methodology", pt: "Metodologia", es: "Metodología" })}](${METHOD})`;
}
