import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { ecosystemPublicSnapshots } from "@/lib/db/schema";
import { claimCheckpoint, completeCheckpoint, emptyCheckpoint, readCheckpoint, type EcosystemCheckpoint } from "./checkpoint";
import type { Snapshot } from "./types";

// The registry hash isolates deployments with different reviewed inventories.
// Transactions only protect checkpoints/publication, never the GitHub requests.
async function change<T>(registryHash: string, update: (row: EcosystemCheckpoint) => {
  row: EcosystemCheckpoint; value: T; snapshot?: Snapshot;
}): Promise<T> {
  return getDb().transaction(async tx => {
    await tx.execute(sql`set local statement_timeout = '5000ms'`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'ecosystem-public:' + registryHash}))`);
    const rows = await tx.select({ checkpoint: ecosystemPublicSnapshots.checkpoint }).from(ecosystemPublicSnapshots)
      .where(eq(ecosystemPublicSnapshots.registryHash, registryHash));
    const before = rows.length ? readCheckpoint(rows[0].checkpoint) : emptyCheckpoint();
    const result = update(before);
    if (result.row !== before) {
      const values = { checkpoint: result.row, updatedAt: new Date(), ...(result.snapshot ? { snapshot: result.snapshot, collectedAt: new Date(result.snapshot.collectedAt) } : {}) };
      await tx.insert(ecosystemPublicSnapshots).values({ registryHash, ...values })
        .onConflictDoUpdate({ target: ecosystemPublicSnapshots.registryHash, set: values });
    }
    return result.value;
  });
}
export async function readEcosystemSnapshot(registryHash: string, knownCollectedAt?: string) {
  // Errors propagate to the reader/collector, which retain their last valid data.
  return getDb().transaction(async tx => {
    await tx.execute(sql`set local statement_timeout = '5000ms'`);
    // Do not transfer/parse the complete release history when this process
    // already has the current publication. Status remains fresh on every read.
    const [row] = await tx.select({ checkpoint: ecosystemPublicSnapshots.checkpoint,
      snapshot: knownCollectedAt
        ? sql<Snapshot | null>`case when ${ecosystemPublicSnapshots.collectedAt} > ${knownCollectedAt}::timestamptz then ${ecosystemPublicSnapshots.snapshot} else null end`
        : ecosystemPublicSnapshots.snapshot,
    }).from(ecosystemPublicSnapshots).where(eq(ecosystemPublicSnapshots.registryHash, registryHash));
    return row ? { snapshot: row.snapshot, checkpoint: readCheckpoint(row.checkpoint) } : null;
  });
}
export const ecosystemSnapshotStore = {
  read: readEcosystemSnapshot,
  claim: (hash: string, day: string, at: string, id: string) => change(hash, row => {
    const claim = claimCheckpoint(row, day, at, id);
    return { row: claim.row, value: claim };
  }),
  complete: (hash: string, id: string, at: string, snapshot: Snapshot | null) => change(hash, row => {
    if (row.lease?.id !== id) return { row, value: { committed: false } };
    if (snapshot && (snapshot.registryHash !== hash || snapshot.collectedAt !== row.lease?.startedAt))
      throw new Error("Ecosystem collection does not match its lease");
    const completed = completeCheckpoint(row, id, at, snapshot !== null);
    return { row: completed, value: { committed: completed !== row }, ...(completed !== row && snapshot ? { snapshot } : {}) };
  }),
};
