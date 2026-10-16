import "server-only";
import { randomUUID } from "node:crypto";
import { collectEcosystem } from "../../../scripts/lib/ecosystem-sync.mjs";
import { ecosystemSnapshotStore } from "./snapshot-store";
import { ecosystemSeed, validateEcosystemSnapshot } from "./seed";
import { createEcosystemGithubRequest } from "./github";
import type { Catalog, Snapshot } from "./types";

export const ECOSYSTEM_COLLECTION_TIMEOUT_MS = 20 * 60_000;
export type EcosystemCollectionOutcome = {
  ok: boolean; day: string;
  outcome: "collected" | "already-collected" | "locked" | "retry-later" | "unavailable" | "disabled" | "superseded";
  repositories?: number; collectedAt?: string;
};
export function createEcosystemCollector({
  store = ecosystemSnapshotStore, collect = collectEcosystem, seed = ecosystemSeed,
  validate = validateEcosystemSnapshot, now = Date.now, id = randomUUID,
  request = (signal: AbortSignal) => createEcosystemGithubRequest({ token: process.env.GITHUB_TOKEN ?? "", signal }),
  onStart = () => {},
}: {
  store?: typeof ecosystemSnapshotStore; collect?: typeof collectEcosystem; seed?: Catalog;
  validate?: (snapshot: Snapshot, previous: Snapshot) => void; now?: () => number; id?: () => string;
  request?: (signal: AbortSignal) => (endpoint: string, query?: string) => Promise<unknown>;
  onStart?: (day: string) => void;
} = {}) {
  return async ({ day, at }: { day: string; at: string }): Promise<EcosystemCollectionOutcome> => {
    const hash = seed.snapshot.registryHash, leaseId = id();
    let claimed = false;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), ECOSYSTEM_COLLECTION_TIMEOUT_MS);
    timer.unref?.();
    try {
      const claim = await store.claim(hash, day, at, leaseId);
      if (claim.status !== "claimed") return { ok: claim.status !== "retry-later", day, outcome: claim.status };
      claimed = true;
      onStart(day);
      // Read after claiming, so competing workers cannot collect against an old baseline.
      const stored = await store.read(hash);
      let previous = seed.snapshot;
      if (stored?.snapshot && Date.parse(stored.snapshot.collectedAt) > Date.parse(previous.collectedAt)) {
        validate(stored.snapshot, previous);
        previous = stored.snapshot;
      }
      const result = await collect({ registry: seed.registry, previousSnapshot: previous, request: request(abort.signal), startedAt: at });
      abort.signal.throwIfAborted();
      if (result.publicationIssues.length || Date.parse(result.snapshot.collectedAt) <= Date.parse(previous.collectedAt))
        throw new Error("Incomplete or outdated ecosystem collection");
      validate(result.snapshot, previous);
      const completed = await store.complete(hash, leaseId, new Date(now()).toISOString(), result.snapshot);
      return completed.committed
        ? { ok: true, outcome: "collected", day, repositories: result.snapshot.repositories.length, collectedAt: result.snapshot.collectedAt }
        : { ok: false, outcome: "superseded", day };
    } catch {
      if (claimed) {
        try { await store.complete(hash, leaseId, new Date(now()).toISOString(), null); } catch { /* The lease expires after a database outage. */ }
      }
      return { ok: false, outcome: "unavailable", day };
    } finally { clearTimeout(timer); }
  };
}
export const collectEcosystemDaily = createEcosystemCollector({ onStart(day) {
  console.info(JSON.stringify({ event: "ecosystem.collection", day, outcome: "started" }));
} });
