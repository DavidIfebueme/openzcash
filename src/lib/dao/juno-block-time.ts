import "server-only";
import { z } from "zod";

const REST = "https://rest.cosmos.directory/juno";
const RETRY_MS = 60_000;
const MAX_BLOCKS = 50;
const headerSchema = z.object({
  chain_id: z.literal("juno-1"),
  height: z.string().regex(/^\d+$/),
  time: z.iso.datetime({ offset: true }),
});
const blockSchema = z.object({ header: headerSchema });
const responseSchema = z.object({
  block: blockSchema.nullish(),
  sdk_block: blockSchema.nullish(),
});

// Block times are immutable. Share in-flight requests and retain successes;
// retry unavailable/pruned blocks after a minute, within a bounded cache.
const blocks = new Map<number, { promise: Promise<string>; retryAt: number }>();

async function readBlockTime(height: number): Promise<string> {
  try {
    const response = await fetch(`${REST}/cosmos/base/tendermint/v1beta1/blocks/${height}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (!response.ok) return "";
    const body = responseSchema.parse(await response.json());
    const header = (body.sdk_block ?? body.block)?.header;
    if (!header || Number(header.height) !== height) return "";
    const time = Date.parse(header.time);
    if (!Number.isFinite(time) || time > Date.now()) return "";
    return new Date(time).toISOString();
  } catch {
    return "";
  }
}

/** Exact creation-block time, or unknown. Never estimate from vote expiration. */
export async function junoBlockTime(height: number | undefined): Promise<string> {
  if (height == null || !Number.isSafeInteger(height) || height <= 0) return "";
  const cached = blocks.get(height);
  if (cached && Date.now() < cached.retryAt) return cached.promise;

  const entry = { promise: readBlockTime(height), retryAt: Date.now() + RETRY_MS };
  blocks.set(height, entry);
  if (blocks.size > MAX_BLOCKS) blocks.delete(blocks.keys().next().value!);
  const time = await entry.promise;
  if (time) entry.retryAt = Infinity;
  return time;
}
