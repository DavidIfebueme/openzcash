import "server-only";
import { z } from "zod";

export const MINING_SOURCE = "https://api.zcashinfo.com/api/v1/mining/overview";
const METHOD = "https://zcashinfo.com/learn/solrate/";
const MAX_AGE_MS = 15 * 60_000;
const MAX_BYTES = 2 * 1024 * 1024;
const positive = z.number().finite().positive();
const block = z.object({ height: z.number().int().min(653_600), time: positive, difficulty: positive, status: z.string().nullish() });
const overview = z.object({
  info: z.object({ best_block: z.number().int(), chain_tip: z.number().int(), status: z.string() }),
  recent_blocks: z.array(block).length(20),
});
export const miningSnapshotSchema = z.object({
  solrate: positive, unit: z.literal("Sol/s"), blockCount: z.literal(20),
  fromHeight: z.number().int().positive(), toHeight: z.number().int().positive(),
  observedFrom: z.iso.datetime(), observedTo: z.iso.datetime(), retrievedAt: z.iso.datetime(),
  stale: z.boolean(),
});
export type MiningSnapshot = z.infer<typeof miningSnapshotSchema>;
let cached: MiningSnapshot | undefined;

/** Match the publisher's post-Blossom formula, with source heights and times intact. */
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
  return miningSnapshotSchema.parse({
    solrate: difficulty * 8192 / 75, unit: "Sol/s", blockCount: 20,
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

export function miningAnswer(content: string, pt: boolean): string {
  const unavailable = pt
    ? "Não consegui confirmar o hashrate atual da rede Zcash. Confira o [ZcashInfo](https://zcashinfo.com/pools/) ou o [ZecStats](https://zecstats.com/chart/hashrate), observando a data e a janela da estimativa. Isso não significa que o hashrate seja zero."
    : "I could not verify Zcash's current network hashrate. Check [ZcashInfo](https://zcashinfo.com/pools/) or [ZecStats](https://zecstats.com/chart/hashrate), including the estimate's time and averaging window. This does not mean the hashrate is zero.";
  let data: MiningSnapshot;
  try { data = miningSnapshotSchema.parse(JSON.parse(content).data); } catch { return unavailable; }
  if (Date.parse(data.observedTo) > Date.now() + 120_000 || data.toHeight - data.fromHeight !== 19) return unavailable;
  const stale = data.stale || Date.now() - Date.parse(data.observedTo) > MAX_AGE_MS;
  const number = new Intl.NumberFormat(pt ? "pt-BR" : "en-US", { maximumFractionDigits: 2 }).format(data.solrate / 1e9);
  const date = (value: string) => new Intl.DateTimeFormat(pt ? "pt-BR" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC";
  const text = pt
    ? `${stale ? "Última referência disponível (desatualizada):" : "Hashrate estimado da rede Zcash:"} **${number} GSol/s**. Média da dificuldade de **20 blocos**, de ${data.fromHeight} a ${data.toHeight}, com horários entre ${date(data.observedFrom)} e ${date(data.observedTo)}. Consultado em ${date(data.retrievedAt)}.\n\n${stale ? "Não consegui confirmar uma leitura atual. " : ""}Estimativa: dificuldade média × 8192 ÷ 75, conforme a metodologia do ZcashInfo. Não é contagem de máquinas nem uma média das últimas 24 horas.`
    : `${stale ? "Last available reference (outdated):" : "Estimated Zcash network hashrate:"} **${number} GSol/s**. Average difficulty over **20 blocks**, from ${data.fromHeight} to ${data.toHeight}, timestamped between ${date(data.observedFrom)} and ${date(data.observedTo)}. Retrieved ${date(data.retrievedAt)}.\n\n${stale ? "I could not verify a current reading. " : ""}Estimate: average difficulty × 8192 ÷ 75, following ZcashInfo's methodology. It is not a machine count or a 24-hour average.`;
  return `${text}\n\n[ZcashInfo · API](${MINING_SOURCE}) · [${pt ? "Metodologia" : "Methodology"}](${METHOD})`;
}
