import "server-only";
import { createHash } from "node:crypto";
import registryData from "@/data/ecosystem/registry.json";
import snapshotData from "@/data/ecosystem/snapshot.json";
import type { Catalog, Snapshot } from "./types";
import { validateCatalog } from "./catalog";
import { snapshotPublicationIssues } from "../../../scripts/lib/ecosystem-collection.mjs";

export const ecosystemSeed = { registry: registryData, snapshot: snapshotData } as unknown as Catalog;
export const ecosystemRegistry = ecosystemSeed.registry;
export const ecosystemRegistryHash = createHash("sha256").update(JSON.stringify(ecosystemRegistry)).digest("hex");
export function validateEcosystemSnapshot(snapshot: Snapshot, previousSnapshot: Snapshot = ecosystemSeed.snapshot): void {
  if (snapshot.registryHash !== ecosystemRegistryHash) throw new Error("Ecosystem registry mismatch");
  validateCatalog({ registry: ecosystemRegistry, snapshot });
  const issues = snapshotPublicationIssues(snapshot, {
    requiredRepositories: [...ecosystemRegistry.projects.flatMap(project => project.repositories), ...ecosystemRegistry.selectedRepositories],
    previousSnapshot,
  });
  if (issues.length) throw new Error("Incomplete ecosystem collection");
  const expectedOwners = ecosystemRegistry.owners.filter(owner => owner.scope === "all");
  if (snapshot.owners.length !== expectedOwners.length || expectedOwners.some(owner =>
    !snapshot.owners.some(found => found.login.toLowerCase() === owner.login.toLowerCase() && found.complete)))
    throw new Error("Incomplete ecosystem owner coverage");
}
validateEcosystemSnapshot(ecosystemSeed.snapshot);
