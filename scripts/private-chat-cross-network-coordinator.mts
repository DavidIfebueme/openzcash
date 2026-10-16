/** Real Nym integration: Mac and non-production Railway Linux, one client each.
 * Run only after staging the identical source and npm dependencies on the remote
 * temporary path. Synthetic invitation tokens remain in child pipes, never logs.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

type Reply = { id: number; ok?: boolean; ready?: boolean; token?: string; error?: string; state?: object; counters?: object };
const remoteRoot = process.argv[2];
assert.ok(remoteRoot && /^\/tmp\/openzcash-nym-crosshost-[a-z0-9-]+$/.test(remoteRoot));
const startedAt = new Date().toISOString();
const sources: Record<string, string> = {};
for (const file of [
  "scripts/private-chat-cross-network-role.mts", "scripts/private-chat-real-nym-worker.mjs",
  "src/lib/private-chat/controller.ts", "src/lib/private-chat/protocol.ts", "src/lib/private-chat/ratchet.ts",
  "src/lib/private-chat/live-invite.ts", "src/lib/private-chat/invite-codec.ts",
  "src/lib/private-chat/envelope.ts", "src/lib/private-chat/transport.ts",
  "public/private-chat-nym/worker.js", "public/private-chat-nym/nym_client_wasm_bg.wasm",
  "package-lock.json",
]) sources[file] = createHash("sha256").update(await readFile(file)).digest("hex");
const report: {
  startedAt: string; finishedAt?: string; success: boolean; failure?: string;
  topology: string; sdk: string; sources: Record<string, string>;
  checks: { name: string; durationMs: number }[]; clients?: object;
} = {
  startedAt, success: false,
  topology: "Mac local network and Railway redesign non-production Linux network; two independent Nym WASM clients; isolated Node 26.5.0 on Linux",
  sdk: "@nymproject/nym-client-wasm@1.4.1, @matrix-org/matrix-sdk-crypto-wasm@18.9.0",
  sources, checks: [],
};

class Role {
  private child: ChildProcessWithoutNullStreams;
  private next = 1;
  private pending = new Map<number, { resolve: (reply: Reply) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private ready: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (error: Error) => void;
  private buffer = "";
  private exited = false;

  constructor(private name: string, command: string, args: string[]) {
    this.ready = new Promise((resolve, reject) => { this.readyResolve = resolve; this.readyReject = reject; });
    this.child = spawn(command, args, { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.buffer += chunk;
      for (let index; (index = this.buffer.indexOf("\n")) !== -1;) {
        const line = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + 1);
        if (!line.startsWith("ROLE_JSON ")) continue;
        let reply: Reply;
        try { reply = JSON.parse(line.slice("ROLE_JSON ".length)); } catch { continue; }
        if (reply.id === 0 && reply.ready) { this.readyResolve(); continue; }
        const wait = this.pending.get(reply.id);
        if (wait) { clearTimeout(wait.timer); this.pending.delete(reply.id); wait.resolve(reply); }
      }
    });
    // Railway CLI diagnostic text and app output may contain addresses. Never echo.
    this.child.stderr.resume();
    this.child.once("exit", (code) => {
      this.exited = true;
      const error = new Error(`${this.name} test role exited (${code ?? "signal"})`);
      this.readyReject(error);
      for (const wait of this.pending.values()) { clearTimeout(wait.timer); wait.reject(error); }
      this.pending.clear();
    });
    this.child.once("error", error => {
      const code = "code" in error && typeof error.code === "string" ? error.code : "unknown";
      this.readyReject(new Error(`${this.name} test role failed to start: ${code}`));
    });
  }

  async waitReady() { await this.ready; }
  async call(action: string, extra: { token?: string; body?: string } = {}, timeoutMs = 190_000): Promise<Reply> {
    if (this.exited) throw new Error(`${this.name} role already exited`);
    const id = this.next++;
    const reply = new Promise<Reply>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${this.name} ${action} timed out`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
    });
    this.child.stdin.write(`${JSON.stringify({ id, action, ...extra })}\n`);
    const result = await reply;
    if (!result.ok) throw new Error(`${this.name} ${action} failed: ${result.error ?? "unknown"}; ${JSON.stringify(result.state ?? {})}`);
    return result;
  }
  stop() { this.child.stdin.end(); if (!this.exited) this.child.kill("SIGTERM"); }
}

const remote = new Role("Linux", "railway", ["ssh", "-p", "5476eada-862a-47bd-9166-49be9933d33c", "-s", "zbo", "-e", "redesign", "--", "sh", "-lc", `cd ${remoteRoot} && LD_LIBRARY_PATH=${remoteRoot}/syslib/usr/lib/x86_64-linux-gnu ${remoteRoot}/node_modules/node/bin/node --import tsx scripts/private-chat-cross-network-role.mts 'Synthetic Bob'`]);
const local = new Role("Mac", process.execPath, ["--import", "tsx", "scripts/private-chat-cross-network-role.mts", "Synthetic Alice"]);
async function step(name: string, action: () => Promise<void>) {
  const time = Date.now();
  process.stdout.write(`START ${name}\n`);
  await action();
  report.checks.push({ name, durationMs: Date.now() - time });
  process.stdout.write(`PASS ${name}\n`);
}
const overall = setTimeout(() => { remote.stop(); local.stop(); process.exitCode = 1; }, 20 * 60_000);
try {
  await step("Independent test processes on Mac and Railway Linux", async () => {
    await Promise.all([local.waitReady(), remote.waitReady()]);
  });
  await step("Both clients connect to the actual Nym mixnet", async () => {
    await Promise.all([local.call("connect"), remote.call("connect")]);
  });
  await step("Signed invitation requires explicit acceptance across networks", async () => {
    const invite = await local.call("invite");
    assert.ok(invite.token && /^(?:ozc3|ozchat3)\./.test(invite.token));
    await remote.call("request", { token: invite.token });
    await local.call("waitRequest");
    await local.call("accept");
    await remote.call("waitReady");
  });
  await step("Ten alternating encrypted messages and authenticated receipts", async () => {
    for (let i = 0; i < 5; i++) {
      const fromMac = `Synthetic Mac ${i} ${randomBytes(4).toString("hex")} 🔐`;
      await local.call("send", { body: fromMac });
      await remote.call("waitMessage", { body: fromMac });
      const fromLinux = `Synthetic Linux ${i} ${randomBytes(4).toString("hex")} 🛡️`;
      await remote.call("send", { body: fromLinux });
      await local.call("waitMessage", { body: fromLinux });
    }
  });
  await step("Linux network interruption blocks sending", async () => { await remote.call("offline"); });
  await step("Linux reconnects through Nym and exchanges new messages", async () => {
    await remote.call("reconnect");
    const reply = `Synthetic Linux resumed ${randomBytes(4).toString("hex")} 🔄`;
    await remote.call("send", { body: reply });
    await local.call("waitMessage", { body: reply });
    const ack = `Synthetic Mac acknowledged ${randomBytes(4).toString("hex")} ✅`;
    await local.call("send", { body: ack });
    await remote.call("waitMessage", { body: ack });
  });
  await step("Ending the conversation propagates across networks", async () => {
    await local.call("end");
    await remote.call("waitEnd");
  });
  const macStats = await local.call("stats");
  const linuxStats = await remote.call("stats");
  report.clients = { mac: { state: macStats.state, counters: macStats.counters }, linux: { state: linuxStats.state, counters: linuxStats.counters } };
  report.success = true;
} catch (error) {
  report.failure = error instanceof Error ? error.message : "Unknown failure";
  process.stderr.write(`FAIL ${report.failure}\n`);
  process.exitCode = 1;
} finally {
  clearTimeout(overall);
  if (!report.clients) {
    const snapshots = await Promise.allSettled([local.call("stats", {}, 5_000), remote.call("stats", {}, 5_000)]);
    report.clients = {
      mac: snapshots[0].status === "fulfilled" ? { state: snapshots[0].value.state, counters: snapshots[0].value.counters } : { unavailable: true },
      linux: snapshots[1].status === "fulfilled" ? { state: snapshots[1].value.state, counters: snapshots[1].value.counters } : { unavailable: true },
    };
  }
  await Promise.allSettled([local.call("shutdown", {}, 5_000), remote.call("shutdown", {}, 5_000)]);
  local.stop(); remote.stop();
  report.finishedAt = new Date().toISOString();
  const output = process.env.PRIVATE_CHAT_TEST_REPORT;
  if (output) await writeFile(output, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
