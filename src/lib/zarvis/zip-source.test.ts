import { describe, expect, it, vi } from "vitest";
import snapshot from "./zip-content.json";
import { createZipStore, gitBlobHash, parseZip, refreshZipCorpus, ZIP_PATH, ZIP_REFRESH_MS, type ZipCorpus } from "./zip-source";
const revision = "a".repeat(40), nextRevision = "b".repeat(40);
const text = "```\nZIP: 259\nTitle: Deployment of NU7\nStatus: Draft\nCreated: 2026-09-15\nLicense: MIT\n```\n\n# Abstract\nA proposal, not activation.";
const doc = parseZip("zips/zip-0259.md", text, gitBlobHash(text), revision);
const initial: ZipCorpus = { version: 1, repository: "https://github.com/zcash/zips", revision, retrievedAt: "2026-09-28T00:00:00Z", documents: [doc], readme: "Index of ZIPs\nzips/zip-0259.md", readmeSha: "c".repeat(40), license: "MIT", licenseSha: gitBlobHash("MIT") };
const json = (value: unknown) => new Response(JSON.stringify(value));

describe("Complete official ZIP source snapshot", () => {
  it("retains every numbered/draft source and verifies its original bytes and metadata", () => {
    const corpus = snapshot as ZipCorpus;
    expect(corpus.documents.length).toBeGreaterThan(100);
    expect(corpus.license).toContain("Permission is hereby granted");
    for (const source of corpus.documents) {
      expect(ZIP_PATH.test(source.path)).toBe(true);
      expect(parseZip(source.path, source.text, source.sha, corpus.revision)).toEqual(source);
    }
    for (const match of corpus.readme.matchAll(/zips\/(zip-\d{4,6})\.(?:md|rst)/g)) expect(corpus.documents.some((d) => d.id === match[1])).toBe(true);
  });
  it("retains multi-revision statuses and does not invent absent creation dates", () => {
    const corpus = snapshot as ZipCorpus;
    expect(corpus.documents.find((d) => d.number === 316)?.status).toMatch(/Active.*Withdrawn.*Draft/);
    expect(corpus.documents.find((d) => d.number === 1)).toMatchObject({ status: "Reserved", createdOn: null });
  });
  it("rejects different document numbers, changed bytes and arbitrary paths", () => {
    expect(() => parseZip("zips/zip-0258.md", text, gitBlobHash(text), revision)).toThrow();
    expect(() => parseZip("zips/zip-0259.md", text + "changed", gitBlobHash(text), revision)).toThrow();
    expect(() => parseZip("../../.env", text, gitBlobHash(text), revision)).toThrow();
  });
});

describe("Bounded and atomic public catalog refresh", () => {
  it("uses one public metadata request when the repository revision has not changed", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ sha: revision }));
    const result = await refreshZipCorpus(initial, { fetcher });
    expect(result.documents).toBe(initial.documents);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error", cache: "no-store" });
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(/Authorization|messages|apiKey/);
  });
  it("fetches only changed documents pinned to the exact new commit", async () => {
    const changed = text.replace("Status: Draft", "Status: Proposed");
    const tree = [{ path: doc.path, type: "blob", sha: gitBlobHash(changed), size: changed.length }, { path: "README.rst", type: "blob", sha: initial.readmeSha, size: 200 }, { path: "COPYING.rst", type: "blob", sha: initial.licenseSha, size: 3 }];
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ sha: nextRevision })).mockResolvedValueOnce(json({ tree, truncated: false })).mockResolvedValueOnce(new Response(changed));
    const result = await refreshZipCorpus(initial, { fetcher });
    expect(result.documents[0].status).toBe("Proposed");
    expect(initial.documents[0].status).toBe("Draft");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[2][0]).toBe(`https://raw.githubusercontent.com/zcash/zips/${nextRevision}/${doc.path}`);
  });
  it.each([true, false])("preserves previous data on incomplete tree or hash mismatch (%s)", async (truncated) => {
    const tree = [{ path: doc.path, type: "blob", sha: "f".repeat(40), size: 500 }, { path: "README.rst", type: "blob", sha: initial.readmeSha, size: 200 }, { path: "COPYING.rst", type: "blob", sha: initial.licenseSha, size: 3 }];
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ sha: nextRevision })).mockResolvedValueOnce(json({ tree, truncated })).mockResolvedValueOnce(new Response(text));
    await expect(refreshZipCorpus(initial, { fetcher })).rejects.toThrow();
    expect(initial.revision).toBe(revision); expect(initial.documents[0].status).toBe("Draft");
  });
  it("does not download an unbounded change set during a chat", async () => {
    const tree = [{ path: doc.path, type: "blob", sha: "f".repeat(40), size: 500 }, { path: "README.rst", type: "blob", sha: initial.readmeSha, size: 200 }, { path: "COPYING.rst", type: "blob", sha: initial.licenseSha, size: 3 }];
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ sha: nextRevision })).mockResolvedValueOnce(json({ tree }));
    await expect(refreshZipCorpus(initial, { fetcher, maxChanged: 0 })).rejects.toThrow("ZIP_OFFLINE_SYNC_REQUIRED");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("cancels a stalled source at its refresh deadline", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => { options?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true }); }));
    await expect(refreshZipCorpus(initial, { fetcher, timeoutMs: 20 })).rejects.toThrow("aborted");
  });
});

describe("Freshness without model searches", () => {
  const now = Date.parse(initial.retrievedAt);
  it("serves fresh data without HTTP and coalesces expired refreshes", async () => {
    let time = now;
    const refresh = vi.fn().mockImplementation(async (old: ZipCorpus) => ({ ...old, retrievedAt: new Date(time).toISOString() }));
    const store = createZipStore(initial, refresh, () => time);
    expect((await store.get()).stale).toBe(false); expect(refresh).not.toHaveBeenCalled();
    time += ZIP_REFRESH_MS;
    const values = await Promise.all([store.get(), store.get(), store.get()]);
    expect(refresh).toHaveBeenCalledTimes(1); expect(values.every((v) => !v.stale)).toBe(true);
  });
  it("labels a failed refresh stale, preserves the corpus and backs off", async () => {
    let time = now + ZIP_REFRESH_MS;
    const refresh = vi.fn().mockRejectedValue(new Error("unavailable"));
    const store = createZipStore(initial, refresh, () => time);
    const result = await store.get(); await store.get();
    expect(result).toEqual({ corpus: initial, stale: true }); expect(refresh).toHaveBeenCalledTimes(1);
    time += 60_001; await store.get(); expect(refresh).toHaveBeenCalledTimes(2);
  });
});
