import type { Catalog, Snapshot } from "./types";
import type { EcosystemCheckpoint } from "./checkpoint";

export type StoredEcosystem = { snapshot: Snapshot | null; checkpoint: EcosystemCheckpoint } | null;
/** A short read cache, not a build-time snapshot. Failures keep the last valid value. */
export function createEcosystemReader({ seed, read, validate, now = Date.now, ttl = 60_000, timeout = 3_000 }: {
  seed: Catalog; read: (knownCollectedAt: string) => Promise<StoredEcosystem>; validate: (snapshot: Snapshot, previous: Snapshot) => void;
  now?: () => number; ttl?: number; timeout?: number;
}) {
  let value = { catalog: seed, source: "bundled" as "bundled" | "daily", available: false, checkpoint: null as EcosystemCheckpoint | null };
  let expires = 0;
  let pending: Promise<typeof value> | null = null;
  return function load(): Promise<typeof value> {
    if (pending) return pending;
    if (now() < expires) return Promise.resolve(value);
    pending = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const stored = await Promise.race([read(value.catalog.snapshot.collectedAt), new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Ecosystem read timeout")), timeout);
          timer.unref?.();
        })]);
        const snapshot = stored?.snapshot;
        if (snapshot && Date.parse(snapshot.collectedAt) > Date.parse(value.catalog.snapshot.collectedAt)) {
          if (Date.parse(snapshot.collectedAt) > now()) throw new Error("Future ecosystem snapshot");
          validate(snapshot, value.catalog.snapshot);
          value = { ...value, catalog: { registry: seed.registry, snapshot }, source: "daily" };
        }
        value = { ...value, available: true, checkpoint: stored?.checkpoint ?? null };
      } catch { value = { ...value, available: false }; }
      finally { if (timer) clearTimeout(timer); expires = now() + ttl; }
      return value;
    })().finally(() => { pending = null; });
    return pending;
  };
}
