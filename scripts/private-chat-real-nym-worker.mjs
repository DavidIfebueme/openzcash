/** Node-only adapter for exercising the exact staged browser worker on real Nym.
 * No payload/address/key logging. IndexedDB is isolated and ephemeral per worker.
 */
import "fake-indexeddb/auto";
import { parentPort } from "node:worker_threads";
import { readFile } from "node:fs/promises";

if (!parentPort) throw new Error("Worker context required");
for (const level of ["log", "info", "debug", "warn", "error"])
  console[level] = () => {};
Object.defineProperty(globalThis, "self", { value: globalThis, configurable: true });
globalThis.postMessage = (message) => parentPort.postMessage(message);
globalThis.close = () => process.exit(0);
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.protocol === "file:") {
    const expected = new URL("../public/private-chat-nym/nym_client_wasm_bg.wasm", import.meta.url);
    if (url.href !== expected.href) throw new Error("Unexpected local resource");
    return new Response(await readFile(expected), { headers: { "Content-Type": "application/wasm" } });
  }
  // Audit only the class of network destination; never paths, queries or payloads.
  parentPort.postMessage({ audit: "fetch", approved: url.origin === "https://validator.nymtech.net" });
  return nativeFetch(input, init);
};
await import("../public/private-chat-nym/worker.js");
parentPort.on("message", (message) => globalThis.onmessage?.({ data: message }));
