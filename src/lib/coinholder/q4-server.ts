import "server-only";
import { z } from "zod";
import { ghHeaders } from "@/lib/zcg/github-headers";
import { COINHOLDER_REPOSITORY, READY_FOR_VOTE_LABEL, q4Proposals, type Q4Snapshot } from "./q4";
import { proposalTopicService } from "./topic-service";

const issueSchema = z.object({
  number: z.number().int().positive(), title: z.string(),
  state: z.enum(["open", "closed"]),
  created_at: z.iso.datetime(), updated_at: z.iso.datetime(),
  body: z.string().nullable().optional(),
  labels: z.array(z.union([z.string(), z.object({ name: z.string() })])),
  user: z.object({ login: z.string() }).nullable().optional(),
  pull_request: z.unknown().optional(),
});

const FRESH_MS = 5 * 60_000;
const RETRY_MS = 60_000;

/** A complete, validated listing replaces the previous snapshot. Errors and
 * partial pagination cannot turn an unavailable source into zero proposals. */
export function createQ4Reader(fetcher: typeof fetch = fetch, now = Date.now) {
  let snapshot: Q4Snapshot = { status: "unavailable", fetchedAt: null, proposals: null };
  let nextAttempt = 0;
  let inFlight: Promise<Q4Snapshot> | null = null;

  async function refresh(): Promise<Q4Snapshot> {
    try {
      const issues = [];
      for (let page = 1; ; page++) {
        if (page > 10) throw new Error("Incomplete Q4 issue listing");
        const url = new URL(`https://api.github.com/repos/${COINHOLDER_REPOSITORY}/issues`);
        url.search = new URLSearchParams({ state: "open", labels: READY_FOR_VOTE_LABEL, per_page: "100", sort: "created", direction: "desc", page: String(page) }).toString();
        const response = await fetcher(url, { headers: ghHeaders(), cache: "no-store", signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error(`Q4 source returned HTTP ${response.status}`);
        const batch = z.array(issueSchema).parse(await response.json());
        issues.push(...batch);
        if (batch.length < 100) break;
      }
      snapshot = { status: "current", fetchedAt: new Date(now()).toISOString(), proposals: q4Proposals(issues) };
      nextAttempt = now() + FRESH_MS;
    } catch {
      snapshot = { ...snapshot, status: snapshot.proposals === null ? "unavailable" : "stale" };
      nextAttempt = now() + RETRY_MS;
    }
    return snapshot;
  }

  return async function read(): Promise<Q4Snapshot> {
    if (inFlight) return inFlight;
    if (now() < nextAttempt) return snapshot;
    inFlight = refresh();
    try { return await inFlight; } finally { inFlight = null; }
  };
}

const readSource = createQ4Reader();
export async function readQ4(): Promise<Q4Snapshot> {
  const snapshot = await readSource();
  return snapshot.proposals ? { ...snapshot, proposals: await proposalTopicService.enrich(snapshot.proposals, snapshot.status === "current") } : snapshot;
}
