import "server-only";
import { randomUUID } from "node:crypto";
import type { Q4Proposal } from "./q4";
import type { TopicAnalysis } from "./proposal-topics";
import { analyzeProposalTopics, MAX_TOPIC_INPUT_CHARS, topicInput, topicInputHash, topicModelEnabled } from "./topic-model";
import { topicStore, type TopicStore } from "./topic-store";

/** Paid work runs off the page's response path. Immutable hashes prevent an old
 * completion from applying to an edited proposal; DB leases deduplicate replicas. */
export function createTopicService({ store = topicStore, analyze = analyzeProposalTopics, enabled = topicModelEnabled,
  now = Date.now, report = () => {},
}: { store?: TopicStore; analyze?: typeof analyzeProposalTopics; enabled?: () => boolean; now?: () => number;
  report?: (event: { outcome: string; proposal?: number }) => void } = {}) {
  const cache = new Map<string, { analysis?: TopicAnalysis; until: number }>();
  const queue = new Map<string, Q4Proposal>();
  const pending = new Set<string>();
  const idle = new Set<() => void>();
  let active = 0;
  let storageRetryAt = 0;
  async function readCached(hashes: string[]) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([store.read(hashes), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("TOPIC_CACHE_TIMEOUT")), 1500); timer.unref?.();
      })]);
    } finally { clearTimeout(timer); }
  }
  function remember(hash: string, analysis?: TopicAnalysis) {
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(hash, { analysis, until: analysis ? Infinity : now() + 30_000 });
  }
  async function run(hash: string, proposal: Q4Proposal) {
    const lease = randomUUID();
    let claimed = false;
    try {
      claimed = await store.claim(hash, proposal.number, lease, now());
      if (!claimed) return;
      const analysis = await analyze(proposal);
      if (await store.complete(hash, lease, analysis, now())) remember(hash, analysis);
      report({ outcome: "analyzed", proposal: proposal.number });
    } catch {
      if (claimed) await store.complete(hash, lease, null, now()).catch(() => {});
      report({ outcome: "unavailable", proposal: proposal.number });
    }
  }
  function kick() {
    while (active < 2 && queue.size) {
      const [hash, proposal] = queue.entries().next().value!;
      queue.delete(hash); active++;
      void run(hash, proposal).finally(() => {
        pending.delete(hash); active--; kick();
        if (!active && !queue.size) { for (const resolve of idle) resolve(); idle.clear(); }
      });
    }
  }
  async function enrich(proposals: Q4Proposal[], schedule = true): Promise<Q4Proposal[]> {
    const entries = proposals.map((proposal) => ({ proposal, hash: topicInputHash(proposal) }));
    const missing = entries.filter(({ hash }) => !cache.has(hash) || cache.get(hash)!.until <= now());
    if (missing.length && now() >= storageRetryAt) {
      try {
        const saved = await readCached(missing.map(({ hash }) => hash));
        for (const { proposal, hash } of missing) {
          const analysis = saved.get(hash);
          remember(hash, analysis);
          if (!analysis && schedule && enabled() && proposal.body.trim() && topicInput(proposal).length <= MAX_TOPIC_INPUT_CHARS && !pending.has(hash) && pending.size < 100) {
            pending.add(hash); queue.set(hash, proposal);
          }
        }
        kick();
      } catch { storageRetryAt = now() + 30_000; report({ outcome: "cache-unavailable" }); }
    }
    return entries.map(({ proposal, hash }) => {
      const analysis = cache.get(hash)?.analysis;
      return analysis ? { ...proposal, topicAnalysis: analysis } : pending.has(hash) ? { ...proposal, topicsPending: true } : proposal;
    });
  }
  const drain = () => !active && !queue.size ? Promise.resolve() : new Promise<void>((resolve) => idle.add(resolve));
  return { enrich, drain };
}

// Next's page, route and scheduler bundles share completed work in this process.
const state = globalThis as typeof globalThis & { __coinholderTopicServiceV1?: ReturnType<typeof createTopicService> };
export const proposalTopicService = state.__coinholderTopicServiceV1 ??= createTopicService({ report: (event) => console.info(JSON.stringify({ event: "coinholder.topics", ...event })) });
