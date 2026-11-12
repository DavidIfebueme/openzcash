import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { treasuryFeedSchema, treasurySnapshotSchema, TREASURY_STALE_MS, type TreasuryFeed, type TreasurySnapshot } from "./ledger";

export function treasurySnapshotPath() {
  return process.env.OPENZCASH_TREASURY_SNAPSHOT_PATH || path.join(process.cwd(), ".cache/openzcash-treasury/snapshot.json");
}

export async function readTreasuryFeed(file = treasurySnapshotPath(), now = Date.now()): Promise<TreasuryFeed> {
  try {
    // Runtime volume, never a bundled build asset (or a trace of the repository).
    const content = await readFile(/* turbopackIgnore: true */ file, "utf8");
    if (content.length > 10_000_000) throw new Error("Snapshot exceeds limit");
    const stored = treasuryFeedSchema.parse(JSON.parse(content));
    const snapshot = stored.snapshot;
    if (snapshot && Date.parse(snapshot.syncedAt) > now + 30_000) throw new Error("Future synchronization timestamp");
    if (stored.status === "error") return { status: "error", snapshot };
    if (stored.status === "syncing" && !snapshot) return { status: "syncing", snapshot: null };
    if (!snapshot) return { status: "unavailable", snapshot: null };
    const stale = now - Date.parse(snapshot.syncedAt) > TREASURY_STALE_MS || snapshot.tipHeight - snapshot.syncedHeight > 3;
    return { status: stale ? "stale" : "synced", snapshot };
  } catch {
    return { status: "unavailable", snapshot: null };
  }
}

/** Only the offline worker calls this. Readers see either the old or new complete file. */
export async function writeTreasuryFeed(status: "syncing" | "synced" | "error", snapshot: TreasurySnapshot | null, file = treasurySnapshotPath()) {
  if (snapshot) treasurySnapshotSchema.parse(snapshot);
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ status, snapshot })}\n`, { mode: 0o600 });
  await rename(temporary, file);
}
