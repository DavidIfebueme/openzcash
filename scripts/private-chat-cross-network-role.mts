/**
 * Ephemeral, line-oriented test role for the real two-host Nym check.
 * Responses go only to the parent process; its report must discard invite tokens.
 * Never use this process as a public service or log its stdin/stdout.
 */
import assert from "node:assert/strict";
import { Worker as NodeWorker } from "node:worker_threads";
import { createInterface } from "node:readline";
import { ChatController } from "../src/lib/private-chat/controller";
import { createNymTransport } from "../src/lib/private-chat/transport";
import { inviteToken } from "../src/lib/private-chat/live-invite";

type Command = { id: number; action: string; token?: string; body?: string };
const alias = process.argv[2];
assert.ok(alias === "Synthetic Alice" || alias === "Synthetic Bob");

const counters = { sends: 0, anonymous: 0, receives: 0, connections: 0, topologyFetches: 0, unexpectedFetches: 0,
  workerFailures: {} as Record<string, number>, workerErrors: 0,
  workerErrorCategories: {} as Record<string, number> };
const workers = new Set<WorkerAdapter>();
class WorkerAdapter {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  private worker = new NodeWorker(new URL("./private-chat-real-nym-worker.mjs", import.meta.url), { execArgv: [] });
  constructor() {
    workers.add(this);
    this.worker.on("message", (data) => {
      if (data?.audit === "fetch") {
        counters.topologyFetches++;
        if (!data.approved) counters.unexpectedFetches++;
        return;
      }
      if (data?.type === "bytes") counters.receives++;
      if (data?.type === "connected") counters.connections++;
      if (data?.type === "failed") {
        const reason = typeof data.reason === "string" && /^(csp|wasm|network|no-address|connect-failed|worker-error|not-connected|submit-failed|timeout)$/.test(data.reason)
          ? data.reason : "unknown";
        counters.workerFailures[reason] = (counters.workerFailures[reason] ?? 0) + 1;
      }
      this.onmessage?.({ data });
    });
    this.worker.on("error", error => {
      counters.workerErrors++;
      const message = String(error?.message ?? "").toLowerCase();
      const category = ["websocket", "indexeddb", "crypto", "fetch", "wasm", "module", "memory", "textencoder", "navigator", "illegal instruction"]
        .find(term => message.includes(term)) ?? "other";
      counters.workerErrorCategories[category] = (counters.workerErrorCategories[category] ?? 0) + 1;
      this.onerror?.({ type: "worker-error" });
    });
  }
  postMessage(data: { type?: string; anonymous?: boolean }) {
    if (data.type === "send") {
      counters.sends++;
      if (data.anonymous) counters.anonymous++;
    }
    this.worker.postMessage(data);
  }
  terminate() { workers.delete(this); void this.worker.terminate(); }
}
Object.defineProperty(globalThis, "Worker", { value: WorkerAdapter, configurable: true });

const chat = new ChatController(createNymTransport);
chat.start();
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(check: () => boolean, label: string, timeoutMs = 120_000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timeout: ${label}`);
    await pause(200);
  }
}
function reply(id: number, result: object) {
  process.stdout.write(`ROLE_JSON ${JSON.stringify({ id, ...result })}\n`);
}
function state() {
  const snapshot = chat.getSnapshot();
  return { link: snapshot.link, contact: snapshot.contact?.status ?? null,
    ready: snapshot.contact?.ready === true, incoming: snapshot.lines.filter(line => line.direction === "in").length,
    delivered: snapshot.lines.filter(line => line.direction === "out" && line.delivery === "delivered").length,
    retry: snapshot.retry, note: snapshot.note };
}
async function run(command: Command): Promise<object> {
  const { action, token, body } = command;
  if (action === "connect") {
    assert.equal(await chat.enter(alias), true);
    chat.connect();
    await until(() => chat.getSnapshot().link === "connected", "Nym connection", 180_000);
    return { state: state() };
  }
  if (action === "invite") {
    const invite = await chat.makeInvite();
    assert.ok(invite);
    return { token: inviteToken(invite), state: state() };
  }
  if (action === "request") {
    assert.ok(token && /^(?:ozc3|ozchat3)\./.test(token));
    await chat.requestChat(token);
    await until(() => chat.getSnapshot().contact !== null, "invite submission");
    return { state: state() };
  }
  if (action === "waitRequest") {
    await until(() => chat.getSnapshot().requests.length === 1, "invite arrival");
    return { state: state() };
  }
  if (action === "accept") {
    const request = chat.getSnapshot().requests[0];
    assert.ok(request);
    await chat.acceptRequest(request.packet.id);
    await until(() => chat.getSnapshot().contact?.ready === true, "accepted conversation");
    return { state: state() };
  }
  if (action === "waitReady") {
    await until(() => chat.getSnapshot().contact?.ready === true, "peer acceptance");
    return { state: state() };
  }
  if (action === "send") {
    assert.ok(body && body.startsWith("Synthetic "));
    assert.equal(await chat.send(body), true);
    await until(() => chat.getSnapshot().lines.some(line => line.direction === "out" && line.body === body && line.delivery === "delivered"), "authenticated receipt");
    return { state: state() };
  }
  if (action === "waitMessage") {
    assert.ok(body && body.startsWith("Synthetic "));
    await until(() => chat.getSnapshot().lines.some(line => line.direction === "in" && line.body === body), "message arrival");
    return { state: state() };
  }
  if (action === "offline") {
    chat.network(false);
    assert.equal(chat.getSnapshot().link, "offline");
    const before = counters.sends;
    assert.equal(await chat.send("Synthetic must remain offline"), false);
    await pause(750);
    assert.equal(counters.sends, before);
    return { state: state() };
  }
  if (action === "reconnect") {
    chat.network(true);
    await until(() => chat.getSnapshot().link === "connected", "Nym reconnection", 180_000);
    await until(() => chat.getSnapshot().contact?.ready === true, "conversation reconnection", 180_000);
    return { state: state() };
  }
  if (action === "end") {
    chat.endConversation();
    return { state: state() };
  }
  if (action === "waitEnd") {
    await until(() => chat.getSnapshot().contact?.status === "ended", "remote end");
    return { state: state() };
  }
  if (action === "stats") {
    assert.equal(counters.unexpectedFetches, 0);
    return { state: state(), counters };
  }
  if (action === "shutdown") {
    chat.dispose();
    for (const worker of workers) worker.terminate();
    setTimeout(() => process.exit(0), 20);
    return { state: state() };
  }
  throw new Error("Unknown action");
}

reply(0, { role: alias, ready: true });
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  try {
    const command = JSON.parse(line) as Command;
    assert.ok(Number.isInteger(command.id) && command.id > 0);
    reply(command.id, { ok: true, ...(await run(command)) });
  } catch (error) {
    const commandId = (() => { try { return JSON.parse(line).id; } catch { return -1; } })();
    reply(Number.isInteger(commandId) ? commandId : -1, {
      ok: false,
      error: error instanceof Error ? error.message.replace(/[1-9A-HJ-NP-Za-km-z]{20,}/g, "[redacted]") : "Unknown failure",
      state: state(),
    });
  }
}
chat.dispose();
for (const worker of workers) worker.terminate();
