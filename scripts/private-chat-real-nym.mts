/** Real-mixnet integration test using two independent Nym WASM workers.
 * Run: node --import tsx scripts/private-chat-real-nym.mts
 * This tests the controller/worker/network, not browser rendering or two devices.
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { Worker as NodeWorker } from "node:worker_threads";
import { createHash } from "node:crypto";
import { ChatController } from "../src/lib/private-chat/controller";
import { createNymTransport } from "../src/lib/private-chat/transport";
import { createLiveInvite, inviteToken } from "../src/lib/private-chat/live-invite";
import { createDeviceIdentity, wipeIdentity } from "../src/lib/private-chat/identity";

const report = {
  startedAt: new Date().toISOString(),
  finishedAt: "",
  sources: {} as Record<string, string>,
  sdk: "@nymproject/nym-client-wasm@1.4.1",
  topology: "two independent WASM workers on one host and one network",
  checks: [] as { name: string; durationMs: number }[],
  transport: { submitted: 0, anonymous: 0, received: 0, connections: 0, topologyRequests: 0, unexpectedFetches: 0 },
  success: false,
  failure: "",
};
const workers = new Set<WorkerAdapter>();
class WorkerAdapter {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  private worker = new NodeWorker(new URL("./private-chat-real-nym-worker.mjs", import.meta.url), { execArgv: [] });
  constructor() {
    workers.add(this);
    this.worker.on("message", (data) => {
      if (data?.audit === "fetch") {
        report.transport.topologyRequests++;
        if (!data.approved) report.transport.unexpectedFetches++;
        return;
      }
      if (data?.type === "bytes") report.transport.received++;
      if (data?.type === "connected") report.transport.connections++;
      this.onmessage?.({ data });
    });
    this.worker.on("error", () => this.onerror?.({ type: "worker-error" }));
  }
  postMessage(data: { type?: string; anonymous?: boolean }) {
    if (data.type === "send") {
      report.transport.submitted++;
      if (data.anonymous) report.transport.anonymous++;
    }
    this.worker.postMessage(data);
  }
  terminate() { workers.delete(this); void this.worker.terminate(); }
}
Object.defineProperty(globalThis, "Worker", { value: WorkerAdapter, configurable: true });
const output = process.env.PRIVATE_CHAT_TEST_REPORT;
for (const file of ["src/lib/private-chat/controller.ts", "src/lib/private-chat/protocol.ts", "src/lib/private-chat/ratchet.ts", "src/lib/private-chat/envelope.ts", "package-lock.json", "scripts/private-chat-nym-worker.js", "public/private-chat-nym/nym_client_wasm_bg.wasm"]) {
  report.sources[file] = createHash("sha256").update(await readFile(file)).digest("hex");
}
let bobSubmissions = 0;
const alice = new ChatController(createNymTransport);
const bob = new ChatController((listener) => {
  const transport = createNymTransport(listener);
  return { ...transport, send(input) { bobSubmissions++; transport.send(input); } };
});
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check: () => boolean, label: string, timeout = 120_000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error(`Timeout: ${label}`);
    await pause(200);
  }
}
async function step(name: string, work: () => Promise<void>) {
  const start = Date.now();
  process.stdout.write(`START ${name}\n`);
  await work();
  report.checks.push({ name, durationMs: Date.now() - start });
  process.stdout.write(`PASS ${name}\n`);
}
function ready() {
  return alice.getSnapshot().contact?.ready === true && bob.getSnapshot().contact?.ready === true;
}
async function exchange(sender: ChatController, receiver: ChatController, body: string) {
  assert.equal(await sender.send(body), true, "Message submission refused");
  await until(() => receiver.getSnapshot().lines.some((line) => line.direction === "in" && line.body === body), "message delivery");
  await until(() => sender.getSnapshot().lines.some((line) => line.direction === "out" && line.body === body && line.delivery === "delivered"), "authenticated receipt");
}
const deadline = setTimeout(() => {
  process.stderr.write("FAIL overall test deadline\n");
  alice.dispose(); bob.dispose();
  for (const worker of workers) worker.terminate();
  process.exitCode = 1;
}, 12 * 60_000);
try {
  alice.start(); bob.start();
  await step("Two independent Nym routes with round-trip probes", async () => {
    assert.equal(await alice.enter("Nym Test Alice"), true);
    assert.equal(await bob.enter("Nym Test Bob"), true);
    alice.connect();
    await until(() => alice.getSnapshot().link === "connected", "Alice route");
    bob.connect();
    await until(() => bob.getSnapshot().link === "connected", "Bob route");
  });
  await step("Invitation and explicit acceptance over real Nym", async () => {
    const invite = await alice.makeInvite();
    assert.ok(invite);
    await bob.requestChat(inviteToken(invite));
    await until(() => alice.getSnapshot().requests.length === 1, "invite request");
    assert.notEqual(bob.getSnapshot().contact?.status, "active", "Conversation activated before consent");
    await alice.acceptRequest(alice.getSnapshot().requests[0].packet.id);
    await until(ready, "mutual conversation ready");
  });
  await step("Ten alternating messages with authenticated delivery receipts", async () => {
    for (let i = 0; i < 5; i++) {
      await exchange(alice, bob, `Synthetic Alice ${i} 🔐`);
      await exchange(bob, alice, `Synthetic Bob ${i} 🛡️`);
    }
  });
  await step("Network interruption fails closed", async () => {
    bob.network(false);
    assert.equal(bob.getSnapshot().link, "offline");
    const before = bobSubmissions;
    assert.equal(await bob.send("Must stay offline"), false);
    await pause(750);
    assert.equal(bobSubmissions, before, "An offline client submitted a packet");
  });
  await step("Reconnection preserves the conversation and exchanges new messages", async () => {
    bob.network(true);
    await until(() => bob.getSnapshot().link === "connected", "reconnected Nym route");
    await until(ready, "reconnected conversation");
    await exchange(bob, alice, "Synthetic message after reconnect 🔄");
    await exchange(alice, bob, "Synthetic reconnect acknowledged ✅");
  });
  await step("Explicit ending reaches the peer", async () => {
    alice.endConversation();
    await until(() => bob.getSnapshot().contact?.status === "ended", "end notification");
    bob.endConversation();
  });
  await step("Invitation refusal reaches the requester", async () => {
    const invite = await alice.makeInvite();
    assert.ok(invite);
    await bob.requestChat(inviteToken(invite));
    await until(() => alice.getSnapshot().requests.length === 1, "second invite");
    await alice.rejectRequest(alice.getSnapshot().requests[0].packet.id);
    await until(() => bob.getSnapshot().contact === null, "refusal notification");
    assert.equal(alice.getSnapshot().contact, null);
  });
  await step("Expired signed invitation is refused before transmission", async () => {
    const identity = await createDeviceIdentity();
    try {
      const fresh = await alice.makeInvite();
      assert.ok(fresh);
      const expired = await createLiveInvite(identity, "Expired Synthetic", fresh.address, Date.now() - 600_000);
      const before = bobSubmissions;
      await bob.requestChat(inviteToken(expired));
      assert.equal(bob.getSnapshot().contact, null);
      assert.equal(bobSubmissions, before);
    } finally { wipeIdentity(identity); }
  });
  assert.equal(report.transport.unexpectedFetches, 0, "Unexpected direct HTTP destination");
  report.success = true;
} catch (error) {
  report.failure = error instanceof Error ? error.message : "Unknown failure";
  process.stderr.write(`FAIL ${report.failure}\n`);
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  report.finishedAt = new Date().toISOString();
  alice.dispose(); bob.dispose();
  for (const worker of workers) worker.terminate();
  if (output) await writeFile(output, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
