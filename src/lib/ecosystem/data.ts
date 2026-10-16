import "server-only";
import { ecosystemSeed, ecosystemRegistryHash, ecosystemRegistry, validateEcosystemSnapshot } from "./seed";
import { readEcosystemSnapshot } from "./snapshot-store";
import { createEcosystemReader } from "./snapshot-reader";

export { ecosystemRegistry };
export const readEcosystemState = createEcosystemReader({
  seed: ecosystemSeed, read: knownCollectedAt => readEcosystemSnapshot(ecosystemRegistryHash, knownCollectedAt), validate: validateEcosystemSnapshot,
});
// Requests read the published public snapshot; they never run GitHub collection.
export async function loadEcosystemCatalog() { return (await readEcosystemState()).catalog; }

/**
 * The registry's line about an organisation, as its page shows it under the
 * name, kept to the whole sentences that fit in `max` characters (link
 * previews cut longer descriptions).
 */
export function organizationDescription(
  id: string,
  max = 200,
): string | undefined {
  const line = ecosystemRegistry.organizations.find((o) => o.id === id)?.description;
  if (!line || line.length <= max) return line;
  const sentences = line.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [line];
  let fitted = "";
  for (const sentence of sentences) {
    if ((fitted + sentence).trim().length > max) break;
    fitted += sentence;
  }
  return fitted.trim() || `${line.slice(0, line.lastIndexOf(" ", max - 1))}…`;
}
