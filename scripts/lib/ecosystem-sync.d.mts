import type { Registry, Snapshot } from "../../src/lib/ecosystem/types";
export function collectEcosystem(options: {
  registry: Registry;
  previousSnapshot?: Snapshot | null;
  request: (endpoint: string, query?: string) => Promise<unknown>;
  startedAt?: string;
  report?: (message: string) => void;
}): Promise<{ snapshot: Snapshot; publicationIssues: string[] }>;
