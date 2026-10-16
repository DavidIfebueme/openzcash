import { z } from "zod";

export const ECOSYSTEM_TIME_ZONE = "America/Sao_Paulo";
export const ECOSYSTEM_LEASE_MS = 30 * 60_000;
export const ECOSYSTEM_RETRY_MS = 60 * 60_000;
const iso = z.string().datetime();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const checkpointSchema = z.object({
  schemaVersion: z.literal(1), successfulDay: day.nullable(),
  lastAttemptAt: iso.nullable(), lastSuccessAt: iso.nullable(), nextRetryAt: iso.nullable(),
  outcome: z.enum(["collected", "source-unavailable"]).nullable(),
  lease: z.object({ id: z.string().min(1), day, startedAt: iso, expiresAt: iso }).nullable(),
});
export type EcosystemCheckpoint = z.infer<typeof checkpointSchema>;
export function readCheckpoint(value: unknown): EcosystemCheckpoint { return checkpointSchema.parse(value); }
export function emptyCheckpoint(): EcosystemCheckpoint {
  return { schemaVersion: 1, successfulDay: null, lastAttemptAt: null, lastSuccessAt: null, nextRetryAt: null, outcome: null, lease: null };
}
const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: ECOSYSTEM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export function ecosystemCollectionDay(at: number | Date): string {
  const parts = formatter.formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function claimCheckpoint(row: EcosystemCheckpoint, day: string, at: string, id: string) {
  const now = Date.parse(iso.parse(at));
  if (ecosystemCollectionDay(now) !== day || !id) throw new Error("Invalid ecosystem collection day");
  if (row.successfulDay && row.successfulDay >= day) return { status: "already-collected" as const, row };
  if (row.lease && Date.parse(row.lease.expiresAt) > now) return { status: "locked" as const, row };
  if (row.nextRetryAt && Date.parse(row.nextRetryAt) > now) return { status: "retry-later" as const, row };
  return { status: "claimed" as const, row: { ...row, lastAttemptAt: at,
    lease: { id, day, startedAt: at, expiresAt: new Date(now + ECOSYSTEM_LEASE_MS).toISOString() } } };
}
export function completeCheckpoint(row: EcosystemCheckpoint, id: string, at: string, success: boolean): EcosystemCheckpoint {
  const now = Date.parse(iso.parse(at));
  if (!row.lease || row.lease.id !== id || now < Date.parse(row.lease.startedAt) || now >= Date.parse(row.lease.expiresAt)) return row;
  return { ...row, lease: null, outcome: success ? "collected" : "source-unavailable",
    successfulDay: success ? row.lease.day : row.successfulDay,
    lastSuccessAt: success ? at : row.lastSuccessAt,
    nextRetryAt: success ? null : new Date(now + ECOSYSTEM_RETRY_MS).toISOString() };
}
