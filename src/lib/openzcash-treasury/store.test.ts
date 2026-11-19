import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { TREASURY_ACCOUNT } from "./account";
import { TREASURY_KEY_SHA256, type TreasurySnapshot } from "./ledger";
import { publishedTreasurySnapshotPath, readTreasuryFeed, writeTreasuryFeed } from "./store";

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
async function location() { const dir = await mkdtemp(path.join(os.tmpdir(), "treasury-test-")); dirs.push(dir); return path.join(dir, "snapshot.json"); }
const snapshot: TreasurySnapshot = { version: 1, scanScope: "external-and-internal", network: "mainnet", address: TREASURY_ACCOUNT.address, viewingKeySha256: TREASURY_KEY_SHA256, source: "ZKool · public full viewing key", scanStartHeight: 3500000, syncedHeight: 3500012, tipHeight: 3500012, syncedAt: "2026-11-10T13:10:00.000Z", balanceZatoshis: "0", receivedZatoshis: "0", spentZatoshis: "0", transactions: [] };
const now = Date.parse(snapshot.syncedAt);
/** No published snapshot: these tests are about the live file alone. */
const NONE = path.join(os.tmpdir(), "treasury-test-no-published-snapshot.json");

it("does not turn a missing, malformed or wrong-account snapshot into zero", async () => {
  const file = await location();
  expect(await readTreasuryFeed(file, now, NONE)).toEqual({ status: "unavailable", snapshot: null });
  const { scanScope: _legacy, ...externalOnly } = snapshot;
  await writeFile(file, JSON.stringify({ status: "synced", snapshot: externalOnly }));
  expect((await readTreasuryFeed(file, now, NONE)).snapshot).toBeNull();
  await writeFile(file, "{");
  expect((await readTreasuryFeed(file, now, NONE)).snapshot).toBeNull();
  await writeFile(file, JSON.stringify({ status: "synced", snapshot: { ...snapshot, viewingKeySha256: "another account" } }));
  expect((await readTreasuryFeed(file, now, NONE)).snapshot).toBeNull();
});

it("retains the last verified balance when stale or failed and accepts atomic replacements", async () => {
  const file = await location();
  await writeTreasuryFeed("synced", snapshot, file);
  expect((await readTreasuryFeed(file, now + 10_000, NONE)).status).toBe("synced");
  expect(await readTreasuryFeed(file, now + 121_000, NONE)).toEqual({ status: "stale", snapshot });
  await writeTreasuryFeed("error", snapshot, file);
  expect(await readTreasuryFeed(file, now + 15_000, NONE)).toEqual({ status: "error", snapshot });
  await writeTreasuryFeed("synced", { ...snapshot, syncedHeight: 3500013, tipHeight: 3500013 }, file);
  expect((await readTreasuryFeed(file, now, NONE)).snapshot?.syncedHeight).toBe(3500013);
});

const published: TreasurySnapshot = { ...snapshot, syncedHeight: 3500020, tipHeight: 3500020, syncedAt: "2026-11-10T13:20:00.000Z" };
const later = Date.parse(published.syncedAt) + 60_000;
async function publishedAt(content: unknown) { const file = await location(); await writeFile(file, typeof content === "string" ? content : JSON.stringify(content)); return file; }

it("shows the published snapshot as the last known balance when there is no live reading, never as live", async () => {
  const dated = await publishedAt({ status: "synced", snapshot: published });
  expect(await readTreasuryFeed(await location(), later, dated)).toEqual({ status: "stale", snapshot: published });
  const starting = await location();
  await writeTreasuryFeed("syncing", null, starting);
  expect(await readTreasuryFeed(starting, later, dated)).toEqual({ status: "stale", snapshot: published });
});

it("prefers the live reading as soon as it is at least as recent as the published snapshot", async () => {
  const dated = await publishedAt({ status: "synced", snapshot: published });
  const live = await location();
  await writeTreasuryFeed("synced", published, live);
  expect(await readTreasuryFeed(live, later, dated)).toEqual({ status: "synced", snapshot: published });
  const newer = { ...published, syncedHeight: 3500030, tipHeight: 3500030 };
  await writeTreasuryFeed("synced", newer, live);
  expect((await readTreasuryFeed(live, later, dated)).snapshot?.syncedHeight).toBe(3500030);
});

it("keeps the published snapshot while the live one is older, and says when the update is failing", async () => {
  const dated = await publishedAt({ status: "synced", snapshot: published });
  const live = await location();
  await writeTreasuryFeed("synced", snapshot, live);
  expect(await readTreasuryFeed(live, later, dated)).toEqual({ status: "stale", snapshot: published });
  await writeTreasuryFeed("error", null, live);
  expect(await readTreasuryFeed(live, later, dated)).toEqual({ status: "error", snapshot: published });
});

it("ignores a published snapshot that is malformed, empty, for another account or dated in the future", async () => {
  const live = await location();
  for (const content of ["{", { status: "synced", snapshot: null }, { status: "synced", snapshot: { ...published, viewingKeySha256: "another account" } }, { status: "synced", snapshot: { ...published, syncedAt: "2030-01-01T00:00:00.000Z" } }]) {
    expect(await readTreasuryFeed(live, later, await publishedAt(content))).toEqual({ status: "unavailable", snapshot: null });
  }
});

it("serves the snapshot committed in data/ as a valid last known balance", async () => {
  expect(publishedTreasurySnapshotPath()).toBe(path.join(process.cwd(), "data/openzcash-treasury/snapshot.json"));
  const feed = await readTreasuryFeed(await location());
  expect(feed.status).toBe("stale");
  expect(feed.snapshot?.address).toBe(TREASURY_ACCOUNT.address);
  expect(feed.snapshot?.transactions.length).toBeGreaterThan(0);
});
