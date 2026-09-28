/** Public ZIP source ingestion, shared by the offline sync and bounded runtime refresh. */
import { createHash } from "node:crypto";

export type ZipDocument = {
  id: string; number: number | null; path: string; title: string; status: string;
  createdOn: string | null; updatedOn: string | null; license: string;
  url: string; sourceUrl: string; sha: string; sha256: string; text: string;
};
export type ZipCorpus = {
  version: 1; revision: string; retrievedAt: string; repository: string;
  readme: string; readmeSha: string; license: string; licenseSha: string; documents: ZipDocument[];
};
const repository = "https://github.com/zcash/zips";
const api = "https://api.github.com/repos/zcash/zips";
export const ZIP_PATH = /^zips\/(?:zip-\d{4,6}|draft-[a-z0-9-]+)\.(?:rst|md)$/;
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
export const gitBlobHash = (text: string) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");

export function parseZip(path: string, text: string, sha: string, revision: string): ZipDocument {
  if (!ZIP_PATH.test(path) || !/^[a-f0-9]{40}$/.test(sha) || !/^[a-f0-9]{40}$/.test(revision) || gitBlobHash(text) !== sha) throw new Error("INVALID_ZIP_SOURCE");
  const headers: Record<string, string> = {};
  let field = "", begun = false;
  for (const line of text.split(/\r?\n/).slice(0, 100)) {
    const match = line.match(/^\s*([A-Za-z][A-Za-z-]*):\s*(.*)$/);
    if (match) { field = match[1]; headers[field] = match[2].trim(); begun = true; }
    else if (begun && (!line.trim() || /^\s*```/.test(line))) break;
    else if (begun && /^\s+\S/.test(line) && field) headers[field] += " " + line.trim();
  }
  const numbered = path.match(/\/zip-(\d+)\./);
  const number = numbered ? Number(numbered[1]) : null;
  if (!headers.Title || !headers.Status || (number !== null && Number(headers.ZIP) !== number)) throw new Error(`INVALID_ZIP_HEADERS:${path}`);
  const date = (value?: string) => {
    const result = value?.match(/^\d{4}-\d{2}-\d{2}\b/)?.[0];
    return result && Number.isFinite(Date.parse(result)) && new Date(result).toISOString().slice(0, 10) === result ? result : null;
  };
  const id = path.slice(5).replace(/\.(?:md|rst)$/, "");
  return { id, number, path, title: headers.Title, status: headers.Status,
    createdOn: date(headers.Created), updatedOn: date(headers["Last-Updated"]), license: headers.License || "See repository COPYING and document",
    url: `https://zips.z.cash/${id}`, sourceUrl: `${repository}/blob/${revision}/${path}`, sha, sha256: hash(text), text };
}

async function readPublic(url: string, signal: AbortSignal, maxBytes: number, fetcher: typeof fetch) {
  const response = await fetcher(url, { signal, redirect: "error", cache: "no-store", headers: { Accept: "application/vnd.github+json", "User-Agent": "OpenZcash-Zarvis-public-ZIP-catalog" } });
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > maxBytes) throw new Error("ZIP_SOURCE_UNAVAILABLE");
  const reader = response.body.getReader(); const parts: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.length;
      if (bytes > maxBytes) throw new Error("ZIP_SOURCE_TOO_LARGE");
      parts.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return Buffer.concat(parts).toString("utf8");
}

/** Atomic: nothing replaces the last complete corpus until every changed source is validated. */
export async function refreshZipCorpus(previous?: ZipCorpus, options: { timeoutMs?: number; maxChanged?: number; fetcher?: typeof fetch } = {}): Promise<ZipCorpus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
  const fetcher = options.fetcher ?? fetch;
  const read = (url: string, bytes = 1_000_000) => readPublic(url, controller.signal, bytes, fetcher);
  try {
    const head = JSON.parse(await read(`${api}/commits/main`, 2_000_000));
    const revision = head.sha;
    if (typeof revision !== "string" || !/^[a-f0-9]{40}$/.test(revision)) throw new Error("INVALID_ZIP_REVISION");
    if (previous?.revision === revision) return { ...previous, retrievedAt: new Date().toISOString() };
    const tree = JSON.parse(await read(`${api}/git/trees/${revision}?recursive=1`, 3_000_000));
    if (tree.truncated || !Array.isArray(tree.tree)) throw new Error("INCOMPLETE_ZIP_TREE");
    type Entry = { path: string; sha: string; type: string; size: number };
    const entries: Entry[] = tree.tree.filter((item: Entry) => item.type === "blob" && (ZIP_PATH.test(item.path) || ["README.rst", "COPYING.rst"].includes(item.path)));
    if (entries.length < 3 || entries.length > 402 || entries.some((e) => !/^[a-f0-9]{40}$/.test(e.sha) || !Number.isFinite(e.size) || e.size > 1_000_000) || entries.reduce((n, e) => n + e.size, 0) > 10_000_000) throw new Error("INVALID_ZIP_MANIFEST");
    if (!entries.some((e) => e.path === "README.rst") || !entries.some((e) => e.path === "COPYING.rst")) throw new Error("MISSING_ZIP_INDEX");
    const old = new Map(previous?.documents.map((doc) => [doc.path, doc]) ?? []);
    const texts = new Map<string, string>();
    for (const e of entries) {
      const doc = old.get(e.path);
      if (doc?.sha === e.sha) texts.set(e.path, doc.text);
      if (e.path === "README.rst" && e.sha === previous?.readmeSha) texts.set(e.path, previous.readme);
      if (e.path === "COPYING.rst" && e.sha === previous?.licenseSha) texts.set(e.path, previous.license);
    }
    const changed = entries.filter((e) => !texts.has(e.path));
    if (changed.length > (options.maxChanged ?? 12)) throw new Error("ZIP_OFFLINE_SYNC_REQUIRED");
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, changed.length) }, async () => {
      while (next < changed.length) {
        const item = changed[next++];
        const text = await read(`https://raw.githubusercontent.com/zcash/zips/${revision}/${item.path}`);
        if (gitBlobHash(text) !== item.sha) throw new Error("ZIP_SOURCE_HASH_MISMATCH");
        texts.set(item.path, text);
      }
    }));
    const readme = texts.get("README.rst")!;
    if (!readme.includes("Index of ZIPs")) throw new Error("INVALID_ZIP_INDEX");
    const documents = entries.filter((e) => ZIP_PATH.test(e.path)).map((e) => parseZip(e.path, texts.get(e.path)!, e.sha, revision)).sort((a, b) => a.id.localeCompare(b.id));
    const numbers = documents.filter((d) => d.number !== null).map((d) => d.number);
    if (new Set(numbers).size !== numbers.length) throw new Error("DUPLICATE_ZIP_NUMBER");
    // Every numbered document linked by the official index must be present.
    for (const match of readme.matchAll(/zips\/(zip-\d{4,6})\.(?:rst|md)/g)) if (!documents.some((d) => d.id === match[1])) throw new Error("INCOMPLETE_ZIP_CATALOG");
    return { version: 1, repository, revision, retrievedAt: new Date().toISOString(), readme, readmeSha: entries.find((e) => e.path === "README.rst")!.sha,
      license: texts.get("COPYING.rst")!, licenseSha: entries.find((e) => e.path === "COPYING.rst")!.sha, documents };
  } finally { controller.abort(); clearTimeout(timeout); }
}

export const ZIP_REFRESH_MS = 6 * 60 * 60 * 1_000;
/** Per-process public cache; coalesces refreshes and backs off after a source failure. No conversation data. */
export function createZipStore(initial: ZipCorpus, refresh: typeof refreshZipCorpus = refreshZipCorpus, clock = Date.now) {
  let corpus = initial, pending: Promise<void> | undefined, retryAfter = 0;
  return { async get() {
    const age = clock() - Date.parse(corpus.retrievedAt);
    if ((!Number.isFinite(age) || age < -60_000 || age >= ZIP_REFRESH_MS) && clock() >= retryAfter) {
      pending ??= refresh(corpus).then((value) => { corpus = value; }).catch(() => { retryAfter = clock() + 60_000; }).finally(() => { pending = undefined; });
      await pending;
    }
    const currentAge = clock() - Date.parse(corpus.retrievedAt);
    return { corpus, stale: !Number.isFinite(currentAge) || currentAge < -60_000 || currentAge >= ZIP_REFRESH_MS };
  } };
}
