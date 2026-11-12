import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { TREASURY_ACCOUNT } from "./account";
import { TREASURY_KEY_SHA256, type TreasurySnapshot } from "./ledger";
import { readTreasuryFeed, writeTreasuryFeed } from "./store";

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))); });
async function location() { const dir = await mkdtemp(path.join(os.tmpdir(), "treasury-test-")); dirs.push(dir); return path.join(dir, "snapshot.json"); }
const snapshot: TreasurySnapshot = { version: 1, network: "mainnet", address: TREASURY_ACCOUNT.address, viewingKeySha256: TREASURY_KEY_SHA256, source: "ZKool · public full viewing key", scanStartHeight: 3500000, syncedHeight: 3500012, tipHeight: 3500012, syncedAt: "2026-11-10T13:10:00.000Z", balanceZatoshis: "0", receivedZatoshis: "0", spentZatoshis: "0", transactions: [] };
const now = Date.parse(snapshot.syncedAt);

it("does not turn a missing, malformed or wrong-account snapshot into zero", async () => {
  const file = await location();
  expect(await readTreasuryFeed(file, now)).toEqual({ status: "unavailable", snapshot: null });
  await writeFile(file, "{");
  expect((await readTreasuryFeed(file, now)).snapshot).toBeNull();
  await writeFile(file, JSON.stringify({ status: "synced", snapshot: { ...snapshot, viewingKeySha256: "another account" } }));
  expect((await readTreasuryFeed(file, now)).snapshot).toBeNull();
});

it("retains the last verified balance when stale or failed and accepts atomic replacements", async () => {
  const file = await location();
  await writeTreasuryFeed("synced", snapshot, file);
  expect((await readTreasuryFeed(file, now + 10_000)).status).toBe("synced");
  expect(await readTreasuryFeed(file, now + 121_000)).toEqual({ status: "stale", snapshot });
  await writeTreasuryFeed("error", snapshot, file);
  expect(await readTreasuryFeed(file, now + 15_000)).toEqual({ status: "error", snapshot });
  await writeTreasuryFeed("synced", { ...snapshot, syncedHeight: 3500013, tipHeight: 3500013 }, file);
  expect((await readTreasuryFeed(file, now)).snapshot?.syncedHeight).toBe(3500013);
});
