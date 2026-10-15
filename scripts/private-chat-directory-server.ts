/** Pilot only: native Nym sidecar + anonymous SURB replies. No public HTTP API. */
import { createServer } from "node:http";
import { isAbsolute } from "node:path";
import WebSocket from "ws";
import { DirectoryProvider } from "../src/lib/private-chat/directory-provider";
import { DirectoryStorage, PersistentPresenceStore } from "../src/lib/private-chat/directory-storage";
import { decodeKey, isPublicKey } from "../src/lib/private-chat/keys";
import { nativeSelfAddress, nativeReply, parseNativeFrame } from "../src/lib/private-chat/native-wire";
import { isNymAddress } from "../src/lib/private-chat/nym-address";

async function main() {
  if (process.env.NODE_ENV !== "production") throw new Error("Pilot runtime requires production mode");
  const directory = process.env.PRIVATE_CHAT_DIRECTORY_DATA;
  const storageKey = decodeKey(process.env.PRIVATE_CHAT_DIRECTORY_STORAGE_KEY || "");
  const expectedAddress = process.env.PRIVATE_CHAT_DIRECTORY_ADDRESS || "";
  const expectedPublicKey = process.env.PRIVATE_CHAT_DIRECTORY_PUBLIC_KEY || "";
  const roomsValue: unknown = JSON.parse(process.env.PRIVATE_CHAT_DIRECTORY_ROOMS || "{}");
  if (!directory || !isAbsolute(directory) || !storageKey || !roomsValue ||
      !isNymAddress(expectedAddress) || !isPublicKey(expectedPublicKey) ||
      typeof roomsValue !== "object" || Array.isArray(roomsValue)) throw new Error("Invalid pilot configuration");
  const rooms = new Map(Object.entries(roomsValue) as [string, number][]);
  if (!rooms.size || rooms.size > 2 || [...rooms].some(([id, slots]) =>
      !isPublicKey(id) || !Number.isSafeInteger(slots) || slots < 1 || slots > 10))
    throw new Error("Pilot admits one or two rooms of up to ten participants");
  const url = new URL(process.env.PRIVATE_CHAT_NYM_WEBSOCKET || "ws://127.0.0.1:1977");
  if (url.protocol !== "ws:" || !["127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash)
    throw new Error("Native Nym socket must be loopback");
  const port = Number(process.env.PRIVATE_CHAT_DIRECTORY_HEALTH_PORT || "1978");
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local health port");
  const storage = new DirectoryStorage(directory, storageKey);
  await storage.prepare();
  const unlock = await storage.inheritedLock(process.env.PRIVATE_CHAT_DIRECTORY_LOCK_FD);
  let stopping = false;
  let ready = false;
  let lastProbe = Date.now();
  let address: string | undefined;
  let identity: { publicKey: string; secretKey: Uint8Array } | undefined;
  const store = new PersistentPresenceStore(storage, { allowedRooms: rooms });
  try {
    // Initialization is an explicit operator action. An empty volume cannot
    // silently create a new identity and advertise an unrelated directory.
    if (await storage.read("identity") === null || await storage.read("binding") === null)
      throw new Error("Directory initialization required");
    identity = await storage.identity();
    if (identity.publicKey !== expectedPublicKey) throw new Error("Directory identity changed");
    await store.initialize();
  } catch (error) {
    identity?.secretKey.fill(0);
    storage.destroy();
    await unlock();
    throw error;
  }
  const activeIdentity = identity;
  const provider = new DirectoryProvider(activeIdentity, Date.now, {
    replyMode: "surb", allowedRooms: rooms, store,
    maxRequestsPerMinute: rooms.size * 120, maxPerRoomPerMinute: 120,
  });
  const counts = { received: 0, queued: 0, discarded: 0, failures: 0 };
  const started = Date.now();
  const server = createServer((request, response) => {
    if (request.method !== "GET" || !["/healthz", "/metrics"].includes(request.url || "")) {
      response.writeHead(404).end(); return;
    }
    response.writeHead(ready ? 200 : 503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(request.url === "/healthz" ? { ready } :
      { ready, uptimeSeconds: Math.floor((Date.now() - started) / 1000), ...counts }));
  });
  const socket = new WebSocket(url, { maxPayload: 65_536, perMessageDeflate: false, handshakeTimeout: 10_000 });
  const jobs = new Set<Promise<void>>();
  async function stop(failed = false) {
    if (stopping) return;
    stopping = true; ready = false;
    if (interval) clearInterval(interval);
    socket.terminate();
    server.close();
    await Promise.allSettled([...jobs]);
    try { await store.flush(); } catch { failed = true; }
    activeIdentity.secretKey.fill(0);
    storage.destroy();
    await unlock();
    process.exitCode = failed ? 1 : 0;
  }
  server.on("error", () => { counts.failures++; void stop(true); });
  server.listen(port, "127.0.0.1");
  socket.on("open", () => socket.send(nativeSelfAddress()));
  socket.on("message", (data, binary) => {
    if (stopping) return;
    const frame = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data);
    const event = binary ? parseNativeFrame(frame) : null;
    if (!event) { counts.discarded++; return; }
    if (event.kind === "error") { counts.failures++; void stop(true); return; }
    if (event.kind === "address") {
      if (event.address !== expectedAddress || (address && address !== event.address)) {
        counts.failures++; void stop(true); return;
      }
      lastProbe = Date.now();
      if (address) return;
      address = event.address;
      const job = (async () => {
        // Both the native Nym address and application key must remain stable.
        await storage.bindDescriptor(address!, activeIdentity.publicKey);
        if (!stopping) ready = true;
      })().catch(() => { counts.failures++; void stop(true); }).finally(() => jobs.delete(job));
      jobs.add(job);
      return;
    }
    if (event.kind !== "received" || !ready) return;
    counts.received++;
    // Bound work before any decryption or queue allocation.
    if (!event.replyTag || jobs.size >= 8) { counts.discarded++; return; }
    const job = provider.handle(event.bytes, event.replyTag).then((reply) => {
      if (!reply || !reply.replyTag || stopping) { counts.discarded++; return; }
      if (socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > 512_000) throw new Error("Native socket unavailable");
      socket.send(nativeReply(reply.replyTag, reply.bytes));
      counts.queued++;
    }).catch(() => { counts.failures++; void stop(true); }).finally(() => jobs.delete(job));
    jobs.add(job);
  });
  socket.on("error", () => { counts.failures++; void stop(true); });
  socket.on("close", () => { if (!stopping) { counts.failures++; void stop(true); } });
  const interval = setInterval(() => {
    if (Date.now() - lastProbe > 60_000) { counts.failures++; void stop(true); return; }
    if (socket.readyState === WebSocket.OPEN) socket.send(nativeSelfAddress());
    if (jobs.size < 8) {
      const job = store.flush().catch(() => { counts.failures++; void stop(true); }).finally(() => jobs.delete(job));
      jobs.add(job);
    }
  }, 20_000);
  process.once("SIGINT", () => { void stop(); });
  process.once("SIGTERM", () => { void stop(); });
  process.stdout.write("Private directory starting; health is available on loopback only.\n");
}
main().catch(() => {
  // Do not print errors containing config, room IDs, keys, addresses or payloads.
  process.stderr.write("Directory startup failed. Check private configuration and storage.\n");
  process.exitCode = 1;
});
