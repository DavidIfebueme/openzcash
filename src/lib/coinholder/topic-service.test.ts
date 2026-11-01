import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createTopicService } from "./topic-service";
import { topicInputHash } from "./topic-model";
import { TOPIC_ANALYSIS_VERSION, type TopicAnalysis } from "./proposal-topics";
import type { Q4Proposal } from "./q4";
import type { TopicStore } from "./topic-store";

const proposal: Q4Proposal = { number: 71, title: "Delivered work", category: "Research & Development", body: "We found and responsibly disclosed a Zebra vulnerability.", applicant: "example", organization: null, summary: null, requestedUsdCents: 15000000, createdAt: "2026-10-30T12:00:00Z", updatedAt: "2026-10-30T12:00:00Z", url: "https://github.com/example/71" };
const analysis: TopicAnalysis = { version: TOPIC_ANALYSIS_VERSION, model: "gpt-5-mini", analyzedAt: "2026-11-01T12:00:00Z", tags: [{ id: "security-research", confidence: 0.98, evidence: proposal.body }] };
function storage() {
  const saved = new Map<string, TopicAnalysis>();
  const store: TopicStore = {
    read: vi.fn(async (hashes: string[]) => new Map(hashes.filter((h) => saved.has(h)).map((h) => [h, saved.get(h)!]))),
    claim: vi.fn(async () => true),
    complete: vi.fn(async (hash, _lease, value) => { if (value) saved.set(hash, value); return true; }),
  };
  return { store, saved };
}
describe("automatic proposal topic pipeline", () => {
  it("returns pending cards without awaiting the model and reuses durable results after restart", async () => {
    const { store, saved } = storage();
    let finish!: (result: TopicAnalysis) => void;
    const analyze = vi.fn(() => new Promise<TopicAnalysis>((resolve) => { finish = resolve; }));
    const service = createTopicService({ store, analyze, enabled: () => true });
    expect(await service.enrich([proposal])).toEqual([{ ...proposal, topicsPending: true }]);
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    await service.enrich([proposal]); expect(analyze).toHaveBeenCalledTimes(1);
    finish(analysis); await service.drain();
    expect(saved.get(topicInputHash(proposal))).toEqual(analysis);
    expect((await service.enrich([proposal]))[0].topicAnalysis).toEqual(analysis);
    const restarted = createTopicService({ store, analyze, enabled: () => true });
    expect((await restarted.enrich([proposal]))[0].topicAnalysis).toEqual(analysis);
    expect(analyze).toHaveBeenCalledTimes(1);
  });
  it("automatically analyzes new proposals and edited content, without applying old tags", async () => {
    const { store, saved } = storage(); saved.set(topicInputHash(proposal), analysis);
    const updated = { ...proposal, body: "We built a wallet with shielded sending and receiving." };
    const next = { ...updated, number: 72, title: "New wallet proposal" };
    const wallet: TopicAnalysis = { ...analysis, tags: [{ id: "wallets", confidence: 0.97, evidence: updated.body }] };
    const analyze = vi.fn(async () => wallet);
    const service = createTopicService({ store, analyze, enabled: () => true });
    const first = await service.enrich([updated, next]);
    expect(first.every((p) => !p.topicAnalysis)).toBe(true);
    await service.drain();
    expect(analyze).toHaveBeenCalledTimes(2);
    expect((await service.enrich([updated, next])).every((p) => p.topicAnalysis?.tags[0].id === "wallets")).toBe(true);
    expect((await service.enrich([proposal]))[0].topicAnalysis).toEqual(analysis);
  });
  it("does not call the model when persistence is down, the lease is held, disabled, or the source is stale", async () => {
    for (const condition of ["db-down", "lease", "disabled", "stale"]) {
      const { store } = storage(); const analyze = vi.fn(async () => analysis);
      if (condition === "db-down") vi.mocked(store.read).mockRejectedValue(new Error("offline"));
      if (condition === "lease") vi.mocked(store.claim).mockResolvedValue(false);
      const service = createTopicService({ store, analyze, enabled: () => condition !== "disabled" });
      await service.enrich([proposal], condition !== "stale"); await service.drain();
      expect(analyze).not.toHaveBeenCalled();
    }
  });
  it("keeps source data available after analysis failure and releases the lease for a later retry", async () => {
    const { store } = storage(); const analyze = vi.fn(async () => { throw new Error("model unavailable"); });
    const service = createTopicService({ store, analyze, enabled: () => true });
    await service.enrich([proposal]); await service.drain();
    expect(await service.enrich([proposal])).toEqual([proposal]);
    expect(store.complete).toHaveBeenCalledWith(topicInputHash(proposal), expect.any(String), null, expect.any(Number));
  });
  it("bounds a hanging cache read and backs off without delaying subsequent source reads", async () => {
    vi.useFakeTimers();
    try {
      const { store } = storage();
      vi.mocked(store.read).mockImplementation(() => new Promise(() => {}));
      const service = createTopicService({ store, enabled: () => true });
      const read = service.enrich([proposal]);
      await vi.advanceTimersByTimeAsync(1500);
      expect(await read).toEqual([proposal]);
      expect(await service.enrich([proposal])).toEqual([proposal]);
      expect(store.read).toHaveBeenCalledTimes(1);
      expect(store.claim).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it("limits model concurrency while draining all queued proposals", async () => {
    const { store } = storage(); const releases: Array<() => void> = [];
    const analyze = vi.fn(() => new Promise<TopicAnalysis>((resolve) => { releases.push(() => resolve(analysis)); }));
    const service = createTopicService({ store, analyze, enabled: () => true });
    await service.enrich(Array.from({ length: 5 }, (_, i) => ({ ...proposal, number: i + 1, title: `Proposal ${i}` })));
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));
    releases.shift()!(); releases.shift()!();
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(4));
    releases.shift()!(); releases.shift()!();
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(5));
    releases.shift()!(); await service.drain();
  });
});
