import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { TREASURY_ACCOUNT } from "../src/lib/openzcash-treasury/account";
import { buildTreasurySnapshot } from "../src/lib/openzcash-treasury/ledger";
import { readTreasuryFeed, treasurySnapshotPath, writeTreasuryFeed } from "../src/lib/openzcash-treasury/store";
import { acquireTreasuryLock, TreasuryLockLostError, TREASURY_SYNC_TIMEOUT_MS } from "../src/lib/openzcash-treasury/sync-lock";
import { getBlockTime } from "../src/lib/zcash/real/lwd/lwd-client";

// This worker talks only to a dedicated local wallet engine. The public web API
// never proxies GraphQL, accepts keys, imports accounts or triggers scans.
const endpoint = new URL(process.env.OPENZCASH_TREASURY_ENGINE_URL || "http://127.0.0.1:18232/graphql");
if (!["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error("Treasury engine must be a local, dedicated service");
const indexer = new URL(process.env.OPENZCASH_TREASURY_INDEXER || "https://zec.rocks");
if (indexer.protocol !== "https:" || indexer.username || indexer.password) throw new Error("The mainnet indexer must use HTTPS");
const indexerGrpc = `${indexer.hostname}:${indexer.port || "443"}`;
const name = "OpenZcash public treasury";
const watch = process.argv.includes("--watch");
const stop = new AbortController();
process.once("SIGINT", () => stop.abort());
process.once("SIGTERM", () => stop.abort());

async function gql(query: string, variables: Record<string, unknown> = {}, timeout = 30_000): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.any([stop.signal, AbortSignal.timeout(timeout)]),
  });
  if (!response.ok) throw new Error(`Engine HTTP ${response.status}`);
  const body = await response.json();
  if (body.errors?.length || !body.data) throw new Error("Engine rejected the treasury request");
  return body.data;
}

async function startHeight(tip: number) {
  const supplied = process.env.OPENZCASH_TREASURY_BIRTHDAY_HEIGHT;
  let height = supplied ? Number(supplied) : Math.max(419_200, tip - 10_000);
  if (!Number.isSafeInteger(height) || height < 419_200 || height >= tip) throw new Error("Invalid treasury birthday height");
  // Cover the whole owner-confirmed creation day, with an extra UTC day margin.
  const before = Date.parse(`${TREASURY_ACCOUNT.createdOn}T00:00:00Z`) / 1000 - 86_400;
  for (;;) {
    const time = await getBlockTime(indexerGrpc, height);
    if (!Number.isSafeInteger(time) || time <= 0) throw new Error("Could not verify the scan start block");
    if (time <= before) return height;
    if (supplied || height === 419_200) throw new Error("Scan start does not cover the account creation date");
    height = Math.max(419_200, height - 10_000);
  }
}

async function prepareAccount() {
  const { currentHeight } = z.object({ currentHeight: z.number().int().positive() }).parse(await gql("query { currentHeight }"));
  const birth = await startHeight(currentHeight);
  const { accounts } = z.object({ accounts: z.array(z.object({ id: z.number().int().positive(), birth: z.number().int().nonnegative(), incomingOnly: z.literal(false) })) }).parse(await gql("query ($name: String!) { accounts(accountFilter: { name: $name }) { id birth incomingOnly } }", { name }));
  if (accounts.length > 1) throw new Error("Ambiguous treasury account");
  let id: number;
  if (accounts.length === 0) {
    const result = z.object({ createAccount: z.number().int().positive() }).parse(await gql("mutation ($account: NewAccount!) { createAccount(newAccount: $account) }", { account: { name, key: TREASURY_ACCOUNT.viewingKey, aindex: 0, birth, useInternal: false } }));
    id = result.createAccount;
  } else {
    id = accounts[0].id;
    if (accounts[0].birth > birth) throw new Error("Existing scan starts too late; use a fresh dedicated engine database");
  }
  const identity = z.object({ unifiedFullViewingKey: z.literal(TREASURY_ACCOUNT.viewingKey), addressByAccount: z.object({ orchard: z.literal(TREASURY_ACCOUNT.address) }) }).parse(await gql("query ($id: Int!) { unifiedFullViewingKey(idAccount: $id, pools: 7, incoming: false) addressByAccount(idAccount: $id, pools: 4) { orchard } }", { id }));
  if (!identity) throw new Error("Treasury identity mismatch");
  console.log(`Verified public viewing key and donation address. Account ${id}; scan starts at ${accounts[0]?.birth ?? birth}.`);
  return id;
}

const ledgerQuery = `query ($id: Int!) {
  accounts(accountFilter: { id: $id }) { id birth height incomingOnly }
  balanceByAccount(idAccount: $id) { height total }
  transactionsByAccount(idAccount: $id) {
    txid height time value fee
    notes { scope memo }
    outputs { memo }
  }
}`;

async function main() {
  // Refuses to start beside a running worker; recovers the lock a killed one left behind.
  const lock = await acquireTreasuryLock(path.join(path.dirname(treasurySnapshotPath()), "sync.lock"));
  let lastGood = (await readTreasuryFeed()).snapshot;
  try {
    await writeTreasuryFeed("syncing", lastGood);
    const id = await prepareAccount();
    do {
      try {
        // Heartbeat on each side of the long engine call. It fails once the lock is no longer ours.
        await lock.refresh();
        await writeTreasuryFeed("syncing", lastGood);
        const { synchronizeAccount } = z.object({ synchronizeAccount: z.number().int().positive() }).parse(await gql("mutation ($id: Int!) { synchronizeAccount(idAccount: $id, fast: false) }", { id }, TREASURY_SYNC_TIMEOUT_MS));
        await lock.refresh();
        const raw = await gql(ledgerQuery, { id }, 120_000);
        const snapshot = buildTreasurySnapshot(raw, synchronizeAccount, new Date().toISOString());
        await writeTreasuryFeed("synced", snapshot);
        lastGood = snapshot;
        console.log(`Synced block ${snapshot.syncedHeight}; balance ${snapshot.balanceZatoshis} zatoshis; ${snapshot.transactions.length} confirmed transaction(s).`);
      } catch (error) {
        if (stop.signal.aborted) break;
        // Report the failure only while the lock, and so the snapshot, is still this worker's.
        await lock.refresh();
        await writeTreasuryFeed("error", lastGood);
        console.error(`Treasury sync failed (${error instanceof Error ? error.name : "Error"}); last verified snapshot retained.`);
        if (!watch) throw error;
      }
      if (watch) await delay(30_000, undefined, { signal: stop.signal }).catch(() => {});
    } while (watch && !stop.signal.aborted);
  } catch (error) {
    // Without the lock the snapshot belongs to another worker: leave it as it is.
    if (!stop.signal.aborted && !(error instanceof TreasuryLockLostError)) await writeTreasuryFeed("error", lastGood);
    throw error;
  } finally {
    // The next start recovers a lock that could not be removed; the original error stays the one reported.
    await lock.release().catch(() => console.error("Treasury lock could not be removed; the next start recovers it."));
  }
}

main().then(() => process.exit(0)).catch((error) => {
  // No raw request or engine response: those may include account data.
  console.error(`Treasury worker stopped: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(stop.signal.aborted ? 0 : 1);
});
